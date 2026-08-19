import { useCallback, useEffect, useMemo, useState } from 'react'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faShareNodes, faXmark } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@ensdomains/thorin'
import {
  useVotersWithMatch,
  useNudgeGating,
  useViewerRole,
  SelectionFlow,
  UnlockMatchmakingBanner,
  MatchmakingPitch,
  pitchCopy,
  pitchDisconnectedCopy,
} from '@/features/matchmaking'
import { useWalletState } from '@/features/wallet/useWalletState'
import { openWalletModal } from '@/features/wallet/openWalletModal'
import { useVoterEnsNames } from '@/features/ens/useVoterEnsNames'
import { useStats } from '@/features/stats/useStats'
import { tokens, fadeInUp, ErrorMessage } from '@/styles'
import { VoterCardsSkeleton, StatsBarSkeleton } from '@/components/shared/PageSkeletons'
import { VoterCard } from './components/VoterCard'
import { SortControls, type SortState } from './components/SortControls'
import { StatsBar } from './components/StatsBar'

const Page = styled.div`
  width: 100%;
  max-width: 1120px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tokens.spacing['2xl']};
  animation: ${fadeInUp} 0.4s ease both;

  @media (min-width: 768px) {
    gap: 64px;
  }
`

const CardsAndFilters = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['2xl']};
  width: 100%;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tokens.spacing.lg};

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }

  > * {
    animation: ${fadeInUp} 0.35s ease both;
  }

  ${Array.from({ length: 12 }, (_, i) => `
    > *:nth-child(${i + 1}) { animation-delay: ${i * 0.04}s; }
  `).join('')}
`

const TopSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing['4xl']};
  width: 100%;
`

const HeaderBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
`

const EyebrowPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid ${tokens.color.white};
  border-radius: 14px;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkGray};
  line-height: 20px;
`

const PageTitle = styled.h1`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0;
  text-align: center;
  max-width: 800px;
  text-wrap: balance;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['5xl']};
  }
`

const Description = styled.p`
  font-size: ${tokens.font.size.lg};
  line-height: 1.4;
  color: ${tokens.color.darkGray};
  margin: 0;
  max-width: 564px;
  text-align: center;
  text-wrap: pretty;
`

const StatsBarWrapper = styled.div`
  width: 100%;
`

const ShareStrip = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 14px 16px;
  background: ${tokens.color.lightBlueOpacity};
  border: 1px solid ${tokens.color.lightBlue};
  border-radius: 12px;

  @media (min-width: 720px) {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }
`

const ShareStripCopy = styled.p`
  margin: 0;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkBlue};
  line-height: 1.5;
`

const ShareStripCopyStrong = styled.span`
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.blue};
`

const ShareStripLink = styled.a`
  text-decoration: none;

  @media (max-width: 719px) {
    width: 100%;

    button {
      width: 100%;
      justify-content: center;
    }
  }
`

/* ─── Toolbar ─── */

const FilterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.spacing.lg};
  flex-wrap: wrap;
`

const SearchRow = styled.div`
  position: relative;
  width: 100%;
  flex-shrink: 0;

  @media (min-width: 768px) {
    max-width: 400px;
  }
`

const SearchIcon = styled.span`
  position: absolute;
  left: ${tokens.spacing.md};
  top: 50%;
  transform: translateY(-50%);
  color: ${tokens.color.darkGray};
  font-size: ${tokens.font.size.lg};
  pointer-events: none;
`

const SearchInput = styled.input`
  width: 100%;
  padding: 12px 16px 12px 44px;
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 9999px;
  background: ${tokens.color.surface};
  font-size: ${tokens.font.size.base};
  color: ${tokens.color.darkBlue};
  font-family: ${tokens.font.family};
  transition: all ${tokens.transition.fast};

  &::placeholder {
    color: ${tokens.color.textSecondary};
  }

  &:hover {
    border-color: ${tokens.color.middleGray};
  }

  &:focus {
    outline: none;
    border-color: ${tokens.color.blue};
    box-shadow: 0 0 0 3px ${tokens.color.lightBlueOpacity};
  }
`

const ClearButton = styled.button`
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: ${tokens.color.borderLight};
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  cursor: pointer;
  color: ${tokens.color.darkGray};
  font-size: ${tokens.font.size.xs};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.middleGray};
    color: ${tokens.color.darkBlue};
  }
`

const EmptyState = styled.div`
  padding: ${tokens.spacing['4xl']} ${tokens.spacing.xl};
  background: ${tokens.color.surface};
  border: 1px dashed ${tokens.color.borderLight};
  border-radius: ${tokens.radius.md};
  text-align: center;
  color: ${tokens.color.darkGray};
  line-height: 1.6;
`

const EmptyTitle = styled.h3`
  margin: 0 0 ${tokens.spacing.xs};
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
`

const ResetLink = styled.button`
  background: none;
  border: none;
  color: ${tokens.color.blue};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.bold};
  cursor: pointer;
  margin-top: ${tokens.spacing.md};

  &:hover {
    text-decoration: none;
    opacity: 0.8;
  }
`

/**
 * Tiny seeded PRNG (Bret Mulberry's mulberry32). Deterministic for a given
 * seed — used so the random sort stays stable across re-renders and the
 * `useMemo` deps can be honest. The seed itself is random per visit (see
 * `randomSeed`), so each page load shows a fresh order; pressing "Shuffle"
 * picks a new seed.
 */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return function () {
    t = (t + 0x6d2b79f5) >>> 0
    let r = t
    r = Math.imul(r ^ (r >>> 15), r | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Fresh random seed for the shuffle. Called lazily on mount (so every visit
 * gets a new order) and again whenever the user hits "Shuffle". Anything
 * non-constant works here — the deterministic part lives in mulberry32.
 */
function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff)
}

function shuffled<T>(voters: T[], seed: number): T[] {
  const copy = [...voters]
  const rand = mulberry32(seed + 1) // avoid seed 0 (mulberry32 still works, but +1 keeps things less degenerate)
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const GridWrap = styled.div`
  position: relative;
  width: 100%;
`

const Blurred = styled.div<{ $blur: boolean }>`
  ${({ $blur }) =>
    $blur ? 'filter: blur(6px); pointer-events: none; user-select: none;' : ''}
`

const Overlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: ${tokens.spacing['4xl']};
  z-index: 2;
`

const OverlayCard = styled.div`
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 20px;
  box-shadow: ${tokens.shadow.lg};
  padding: ${tokens.spacing['4xl']};
  max-width: ${tokens.maxWidth.md};
  width: 100%;

  @media (max-width: 640px) {
    padding: ${tokens.spacing['2xl']};
  }
`

export function VotersPage() {
  const { voters: data, loading, error, viewerHasSelected } = useVotersWithMatch()
  const { map: resolvedEnsNames, report: reportResolvedEns } = useVoterEnsNames(data)
  const { data: stats, loading: statsLoading } = useStats()
  const [sort, setSort] = useState<SortState>({ field: 'random', direction: 'desc' })
  const [sortTouched, setSortTouched] = useState(false)
  // Lazy initializer: a new random seed on every mount, so every visit to the
  // page gets a different order. Was previously a constant 0, which made the
  // "random" sort deterministic and identical across visits.
  const [shuffleSeed, setShuffleSeed] = useState(randomSeed)
  const [search, setSearch] = useState('')

  // Matchmaking unselected-viewer states (the page always renders — no hard gate).
  const wallet = useWalletState()
  const disconnected = wallet.status === 'disconnected'
  const { connectedNotSelected, dismissed, dismiss } = useNudgeGating()
  const { role } = useViewerRole()
  const [flowOpen, setFlowOpen] = useState(false)
  // Blocked hero shows for anyone who hasn't matched yet — disconnected OR
  // connected-not-selected — until dismissed. Dismissal is ephemeral (per visit),
  // so the hero re-opens on every entry/reload until they select. The hero IS the
  // pitch (flag design); its CTA connects (disconnected) or jumps to Select.
  // "Not now" → the quieter inline banner for the rest of this visit.
  const notSelected = disconnected || connectedNotSelected
  const showOverlay = notSelected && !dismissed
  const showBanner = notSelected && dismissed
  const heroCopy = disconnected ? pitchDisconnectedCopy : pitchCopy[role ?? 'holder']
  const onHeroPrimary = disconnected
    ? () => void openWalletModal()
    : () => setFlowOpen(true)

  // Resolved state defaults to Match-sorted — until the user picks a sort.
  useEffect(() => {
    if (viewerHasSelected && !sortTouched) {
      setSort({ field: 'match', direction: 'desc' })
    }
  }, [viewerHasSelected, sortTouched])

  const handleSortChange = useCallback((v: SortState) => {
    setSortTouched(true)
    setSort(v)
  }, [])
  const handleShuffle = useCallback(() => {
    setSortTouched(true)
    setShuffleSeed(randomSeed())
  }, [])

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '#'
    const text = encodeURIComponent(
      "Delegate your ENS to an active voter to help keep governance active. You earn rewards from the ENS DAO. The more people delegate, the bigger the reward pool for everyone.",
    )
    const url = encodeURIComponent(window.location.origin)
    return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
  }, [])

  const voters = useMemo(() => {
    if (!data) return null

    let filtered = [...data]

    // Search filter
    const q = search.trim().toLowerCase()
    if (q.length > 0) {
      filtered = filtered.filter((v) => {
        const apiEns = v.ensName?.toLowerCase() ?? ''
        const lowerAddr = v.address.toLowerCase()
        const resolved = (resolvedEnsNames.get(lowerAddr) ?? '').toLowerCase()
        return (
          apiEns.includes(q) ||
          resolved.includes(q) ||
          lowerAddr.includes(q)
        )
      })
    }

    // Sort
    if (sort.field === 'random') {
      filtered = shuffled(filtered, shuffleSeed)
    } else {
      const dir = sort.direction === 'desc' ? -1 : 1
      if (sort.field === 'votingPower') {
        filtered.sort((a, b) => (Number(a.votingPower) - Number(b.votingPower)) * dir)
      } else if (sort.field === 'activity') {
        filtered.sort((a, b) => (a.votesInLast10 - b.votesInLast10) * dir)
      } else if (sort.field === 'activeSince') {
        filtered.sort((a, b) => {
          const aT = a.activeSince ? new Date(a.activeSince).getTime() : 0
          const bT = b.activeSince ? new Date(b.activeSince).getTime() : 0
          return (aT - bT) * dir
        })
      } else if (sort.field === 'match') {
        // Unselected delegates (no match) sort last regardless of direction.
        filtered.sort((a, b) => {
          const aM = a.match?.percent ?? -1
          const bM = b.match?.percent ?? -1
          return (aM - bM) * dir
        })
      }
    }

    return filtered
  }, [data, sort, shuffleSeed, search, resolvedEnsNames])

  const hasFilters = search.length > 0

  const resetFilters = () => {
    setSearch('')
  }

  return (
    <Page>
        <TopSection>
          <HeaderBlock>
            <EyebrowPill>Delegate &amp; earn</EyebrowPill>
            <PageTitle>Pick an active voter. Earn ENS automatically.</PageTitle>
            <Description>
              Active voters cast on at least 7 of the last 10 proposals.<br />
              Delegate to one to start earning ENS rewards.
            </Description>
          </HeaderBlock>

          <StatsBarWrapper>
            {statsLoading ? (
              <StatsBarSkeleton />
            ) : (
              <StatsBar
                activeVoterCount={stats?.activeVoterCount}
                totalDelegatedEns={stats?.totalDelegatedEns}
                holdersEarning={stats?.holdersEarning}
              />
            )}
          </StatsBarWrapper>

          <ShareStrip>
            <ShareStripCopy>
              <ShareStripCopyStrong>More delegators, bigger reward pool for everyone.</ShareStripCopyStrong>
              {' '}Share the program to help it grow.
            </ShareStripCopy>
            <ShareStripLink
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                size="small"
                colorStyle="bluePrimary"
                prefix={<FontAwesomeIcon icon={faShareNodes} />}
              >
                Share the program
              </Button>
            </ShareStripLink>
          </ShareStrip>
        </TopSection>

        <CardsAndFilters>
          <FilterRow>
            <SearchRow>
              <SearchIcon aria-hidden>
                <FontAwesomeIcon icon={faMagnifyingGlass} />
              </SearchIcon>
              <SearchInput
                type="search"
                placeholder="Search by ENS name or 0x address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search voters"
              />
              {search.length > 0 && (
                <ClearButton type="button" onClick={() => setSearch('')} aria-label="Clear search">
                  <FontAwesomeIcon icon={faXmark} />
                </ClearButton>
              )}
            </SearchRow>

            <SortControls
              value={sort}
              onChange={handleSortChange}
              onShuffle={handleShuffle}
              showMatch={viewerHasSelected}
            />
          </FilterRow>

          {loading && <VoterCardsSkeleton />}

          {error && <ErrorMessage>Failed to load voters: {error}</ErrorMessage>}

          {voters && voters.length === 0 && hasFilters && (
            <EmptyState>
              <EmptyTitle>No voters match your search</EmptyTitle>
              <div>Try a different ENS name or address.</div>
              <ResetLink type="button" onClick={resetFilters}>Clear search</ResetLink>
            </EmptyState>
          )}

          {showBanner && (
            <UnlockMatchmakingBanner
              onSelect={onHeroPrimary}
              ctaLabel={disconnected ? 'Connect wallet' : undefined}
            />
          )}

          {voters && voters.length > 0 && (
            <GridWrap>
              <Blurred $blur={showOverlay}>
                <Grid>
                  {voters.map((v) => (
                    <VoterCard
                      key={v.address}
                      voter={v}
                      resolvedEnsName={resolvedEnsNames.get(v.address.toLowerCase()) ?? null}
                      onEnsResolved={reportResolvedEns}
                      match={v.match}
                      viewerHasSelected={viewerHasSelected}
                      degraded={showBanner}
                    />
                  ))}
                </Grid>
              </Blurred>
              {showOverlay && (
                <Overlay>
                  <OverlayCard>
                    <MatchmakingPitch
                      title={heroCopy.title}
                      body={heroCopy.body}
                      primaryLabel={heroCopy.cta}
                      onPrimary={onHeroPrimary}
                      onSecondary={dismiss}
                    />
                  </OverlayCard>
                </Overlay>
              )}
            </GridWrap>
          )}
        </CardsAndFilters>

        {flowOpen && role && (
          <SelectionFlow
            open
            role={role}
            initialStep="select"
            onClose={() => setFlowOpen(false)}
          />
        )}
    </Page>
  )
}
