import { useCallback, useState } from 'react'
import styled, { css } from 'styled-components'
import { Button } from '@ensdomains/thorin'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck, faArrowTrendUp } from '@fortawesome/free-solid-svg-icons'

import { api } from '@/api'
import type { TierEntry, TierProgressionResponse } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { useWalletState } from '@/features/wallet/useWalletState'
import { DelegationModal } from '@/features/delegate/components/DelegationModal'
import { contracts } from '@/config/contracts'
import { tokens } from '@/styles/tokens'
import { fadeInUp } from '@/styles/primitives'
import { ErrorMessage } from '@/styles'
import { LandingPageSkeleton } from '@/components/shared/PageSkeletons'
import { formatPool } from '@/utils/dashboard'

/** griff.eth — resolved on mainnet. The page exists to grow delegation to him. */
const GRIFF_ADDRESS = '0x839395e20bbB182fa440d08F850E6c7A8f6F0780' as `0x${string}`
const GRIFF_ENS = 'griff.eth'
const GRIFF_AVATAR = 'https://metadata.ens.domains/mainnet/avatar/griff.eth'

/** '12.50' → '12.5%', '54.00' → '54%' */
function fmtApy(pct: string | null | undefined): string {
  if (pct == null) return '—'
  const n = Number(pct)
  if (!Number.isFinite(n)) return '—'
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`
}

function growthBand(t: TierEntry): string {
  const min = Math.round(Number(t.momGrowthMinPct))
  const max = t.momGrowthMaxPct != null ? Number(t.momGrowthMaxPct) : null
  return max != null && Number.isFinite(max) ? `+${min}–${Math.round(max)}%` : `+${min}% and up`
}

// ── layout ──────────────────────────────────────────────────────

const Hero = styled.section`
  padding: 64px ${tokens.spacing.xl} 48px;
  text-align: center;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(56, 137, 255, 0.2) 0%, rgba(255, 255, 255, 0.2) 60%),
    ${tokens.color.white};
  border-bottom: 1px solid ${tokens.color.borderLight};

  @media (min-width: 768px) {
    padding: 88px ${tokens.spacing['4xl']} 64px;
  }
`

const HeroInner = styled.div`
  max-width: 720px;
  margin: 0 auto;
  animation: ${fadeInUp} 0.5s ease both;
`

const Avatar = styled.img`
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 3px solid ${tokens.color.white};
  box-shadow: 0 4px 20px rgba(56, 137, 255, 0.25);
  margin-bottom: ${tokens.spacing.lg};
`

const Title = styled.h1`
  font-size: clamp(28px, 5vw, 44px);
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.text};
  margin: 0 0 ${tokens.spacing.md};
  line-height: 1.15;
`

const Sub = styled.p`
  font-size: clamp(15px, 2.2vw, 18px);
  color: ${tokens.color.textSecondary};
  line-height: 1.6;
  margin: 0 auto ${tokens.spacing.xl};
  max-width: 560px;
`

const StatRow = styled.div`
  display: flex;
  gap: ${tokens.spacing.md};
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: ${tokens.spacing.xl};
`

const Stat = styled.div<{ $accent?: boolean }>`
  padding: ${tokens.spacing.md} ${tokens.spacing.xl};
  border-radius: 14px;
  background: ${({ $accent }) => ($accent ? 'rgba(56, 137, 255, 0.10)' : tokens.color.white)};
  border: 1px solid
    ${({ $accent }) => ($accent ? 'rgba(56, 137, 255, 0.35)' : tokens.color.borderLight)};
  min-width: 130px;
`

const StatK = styled.div`
  font-size: 12px;
  color: ${tokens.color.textSecondary};
  margin-bottom: 2px;
`

const StatV = styled.div<{ $blue?: boolean }>`
  font-size: 22px;
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $blue }) => ($blue ? tokens.color.blue : tokens.color.text)};
`

const CtaWrap = styled.div`
  display: flex;
  justify-content: center;

  @media (max-width: 767px) {
    button { width: 100%; justify-content: center; }
  }
`

const Fine = styled.p`
  margin-top: ${tokens.spacing.md};
  font-size: 12.5px;
  color: ${tokens.color.textSecondary};
`

// ── how it works ────────────────────────────────────────────────

const Body = styled.section`
  padding: ${tokens.spacing['4xl']} ${tokens.spacing.xl};
  background: linear-gradient(to bottom, ${tokens.color.white} 0%, ${tokens.color.surfaceAlt} 100%);

  @media (min-width: 768px) {
    padding: ${tokens.spacing['6xl']} ${tokens.spacing['4xl']};
  }
`

const BodyInner = styled.div`
  max-width: 860px;
  margin: 0 auto;
`

const H2 = styled.h2`
  font-size: clamp(22px, 3.4vw, 30px);
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.text};
  text-align: center;
  margin: 0 0 ${tokens.spacing.md};
`

const Lead = styled.p`
  text-align: center;
  color: ${tokens.color.textSecondary};
  font-size: 15.5px;
  line-height: 1.65;
  max-width: 640px;
  margin: 0 auto ${tokens.spacing['3xl']};
`

// ── tier ladder (their table language + an APY column) ─────────

const Ladder = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.sm};
`

const LadderHead = styled.div`
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr 0.9fr;
  gap: ${tokens.spacing.md};
  padding: 0 ${tokens.spacing.lg};
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${tokens.color.textSecondary};

  @media (max-width: 640px) {
    grid-template-columns: 0.8fr 1.3fr 1fr 0.9fr;
    gap: ${tokens.spacing.sm};
  }
`

const TierRow = styled.div<{ $isCurrent: boolean; $isLocked: boolean }>`
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr 0.9fr;
  gap: ${tokens.spacing.md};
  align-items: center;
  padding: ${tokens.spacing.md} ${tokens.spacing.lg};
  border-radius: 12px;
  background: ${tokens.color.white};
  border: 1px solid ${tokens.color.borderLight};
  opacity: ${({ $isLocked }) => ($isLocked ? 0.55 : 1)};
  transition: opacity 0.2s ease;

  ${({ $isCurrent }) =>
    $isCurrent &&
    css`
      border: 2px solid ${tokens.color.blue};
      background: rgba(56, 137, 255, 0.06);
      opacity: 1;
      box-shadow: 0 2px 14px rgba(56, 137, 255, 0.18);
    `}

  @media (max-width: 640px) {
    grid-template-columns: 0.8fr 1.3fr 1fr 0.9fr;
    gap: ${tokens.spacing.sm};
    padding: ${tokens.spacing.md} ${tokens.spacing.md};
  }
`

const TierName = styled.div<{ $isCurrent: boolean }>`
  font-weight: ${({ $isCurrent }) =>
    $isCurrent ? tokens.font.weight.bold : tokens.font.weight.semibold};
  color: ${tokens.color.text};
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
`

const NowBadge = styled.span`
  font-size: 10px;
  font-weight: ${tokens.font.weight.bold};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${tokens.color.white};
  background: ${tokens.color.blue};
  border-radius: 999px;
  padding: 2px 8px;
`

const Cell = styled.div`
  font-size: 13.5px;
  color: ${tokens.color.textSecondary};
`

const PoolCell = styled.div`
  font-size: 14px;
  font-weight: ${tokens.font.weight.semibold};
  color: ${tokens.color.text};
`

const ApyCell = styled.div<{ $isCurrent: boolean }>`
  font-size: 15px;
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $isCurrent }) => ($isCurrent ? tokens.color.blue : tokens.color.text)};
`

// ── why griff ───────────────────────────────────────────────────

const WhyCard = styled.div`
  margin-top: ${tokens.spacing['3xl']};
  padding: ${tokens.spacing.xl};
  border-radius: 16px;
  background: ${tokens.color.white};
  border: 1px solid ${tokens.color.borderLight};
`

const WhyTitle = styled.h3`
  margin: 0 0 ${tokens.spacing.sm};
  font-size: 17px;
  color: ${tokens.color.text};
`

const WhyText = styled.p`
  margin: 0;
  color: ${tokens.color.textSecondary};
  font-size: 14.5px;
  line-height: 1.65;
`

const BottomCta = styled.div`
  margin-top: ${tokens.spacing['3xl']};
  text-align: center;
`

// ── page ────────────────────────────────────────────────────────

function GriffContent({ tierData }: { tierData: TierProgressionResponse }) {
  const [modalOpen, setModalOpen] = useState(false)
  const walletState = useWalletState()

  const current = tierData.tiers.find((t) => t.isCurrent) ?? tierData.tiers[0]
  const next = tierData.tiers.find((t) => t.index === current.index + 1)
  const growthPct = Number(tierData.currentGrowthPct).toFixed(1)
  const isDelegated = walletState.status === 'delegated'

  return (
    <>
      <Hero>
        <HeroInner>
          <Avatar src={GRIFF_AVATAR} alt="griff.eth avatar" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          <Title>Delegate your ENS to Griff</Title>
          <Sub>
            Your tokens stay in your wallet. Your voting power goes to work with one of
            the most active delegates in ENS governance. And here's the part people miss:
            every new delegation pushes the whole pool up a tier, so the APY rises for
            everyone already in. Delegating doesn't just earn you rewards, it raises your
            neighbor's too.
          </Sub>
          <StatRow>
            <Stat $accent>
              <StatK>Current APY</StatK>
              <StatV $blue>{fmtApy(current.estimatedAprPct)}</StatV>
            </Stat>
            <Stat>
              <StatK>Current tier</StatK>
              <StatV>Tier {current.index + 1} of {tierData.tiers.length}</StatV>
            </Stat>
            <Stat>
              <StatK>Delegation growth this round</StatK>
              <StatV>+{growthPct}%</StatV>
            </Stat>
            <Stat>
              <StatK>Top tier pays</StatK>
              <StatV>{fmtApy(tierData.maxTokenHolderAprPct)}</StatV>
            </Stat>
          </StatRow>
          <CtaWrap>
            {isDelegated ? (
              <Button colorStyle="greenSecondary" prefix={<FontAwesomeIcon icon={faCircleCheck} />} aria-disabled>
                You're delegated
              </Button>
            ) : (
              <Button colorStyle="bluePrimary" onClick={() => setModalOpen(true)}>
                Delegate to griff.eth
              </Button>
            )}
          </CtaWrap>
          <Fine>Free and gasless for most holders. You can re-delegate or undo it any time.</Fine>
        </HeroInner>
      </Hero>

      <Body>
        <BodyInner>
          <H2>
            <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: tokens.color.blue, marginRight: 10 }} />
            More delegation, bigger pool, higher APY
          </H2>
          <Lead>
            The monthly reward pool is sized by how much total delegation grew that month.
            Right now we're at +{growthPct}%, which puts the pool in tier {current.index + 1}
            {next ? `. Reach tier ${next.index + 1} and the pool jumps from ${formatPool(current.poolSizeEns)} to ${formatPool(next.poolSizeEns)} ENS, and everyone's APY climbs with it` : ", the top of the ladder"}.
            These are the official tiers from the ENS delegation incentives program.
          </Lead>

          <Ladder>
            <LadderHead>
              <span>Tier</span>
              <span>Delegation growth</span>
              <span>Monthly pool</span>
              <span>Est. APY</span>
            </LadderHead>
            {tierData.tiers.map((t) => (
              <TierRow key={t.index} $isCurrent={t.isCurrent} $isLocked={!t.isUnlocked && !t.isCurrent}>
                <TierName $isCurrent={t.isCurrent}>
                  Tier {t.index + 1}
                  {t.isCurrent && <NowBadge>now</NowBadge>}
                </TierName>
                <Cell>{growthBand(t)}</Cell>
                <PoolCell>{formatPool(t.poolSizeEns)} ENS</PoolCell>
                <ApyCell $isCurrent={t.isCurrent}>{fmtApy(t.estimatedAprPct)}</ApyCell>
              </TierRow>
            ))}
          </Ladder>

          <WhyCard>
            <WhyTitle>Why Griff?</WhyTitle>
            <WhyText>
              Griff Green has been in Ethereum since 2015. He led the community response to
              TheDAO hack, co-founded the White Hat Group that rescued a tenth of all ETH in
              circulation, and founded Giveth. As a delegate he actually shows up: he votes,
              he explains his reasoning in public, and he's been doing it across ENS,
              Optimism, Gitcoin and Arbitrum for years. Delegation is a trust decision.
              His record is easy to check.
            </WhyText>
          </WhyCard>

          <BottomCta>
            {!isDelegated && (
              <Button colorStyle="bluePrimary" onClick={() => setModalOpen(true)}>
                Delegate to griff.eth
              </Button>
            )}
          </BottomCta>
        </BodyInner>
      </Body>

      {modalOpen && (
        <DelegationModal
          open
          onClose={() => setModalOpen(false)}
          delegateAddress={GRIFF_ADDRESS}
          delegateEnsName={GRIFF_ENS}
          delegateAvatarUrl={GRIFF_AVATAR}
          tokenAddress={contracts.ensToken}
        />
      )}
    </>
  )
}

export function GriffPage() {
  const fetchTiers = useCallback(() => api.tierProgression(), [])
  const tiers = useAsync(fetchTiers)

  if (tiers.loading) return <LandingPageSkeleton />
  if (tiers.error || !tiers.data) {
    return <ErrorMessage>Failed to load tier data: {tiers.error}</ErrorMessage>
  }
  return <GriffContent tierData={tiers.data} />
}
