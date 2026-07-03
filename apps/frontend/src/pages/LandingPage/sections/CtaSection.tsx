import { useCallback, useMemo } from 'react'
import styled, { keyframes } from 'styled-components'
import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faShareNodes } from '@fortawesome/free-solid-svg-icons'
import { useEnsAvatar, useEnsName } from 'wagmi'
import { isAddress } from 'viem'
import makeBlockie from 'ethereum-blockies-base64'
import { api } from '@/api'
import { useAsync } from '@/hooks/useAsync'
import { truncateAddress } from '@/utils/format'
import { tokens } from '@/styles/tokens'
import type { VoterDetail } from '@/api/types'

const Section = styled.section`
  background: ${tokens.color.surfaceAlt};
  padding: ${tokens.spacing['4xl']} ${tokens.spacing.xl};

  @media (min-width: 768px) {
    padding: ${tokens.spacing['7xl']} ${tokens.spacing['4xl']};
  }
`

const Card = styled.div`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 560px;
  background: radial-gradient(
    ellipse 100% 110% at 50% 50%,
    #3889ff 0%,
    #68a4fd 25%,
    #97bffb 50%,
    #c7dbf8 75%,
    #f6f6f6 100%
  );
  border: 1px solid ${tokens.color.white};
  border-radius: 24px;
  max-width: ${tokens.maxWidth.section};
  margin: 0 auto;
  padding: ${tokens.spacing['5xl']} ${tokens.spacing.xl} ${tokens.spacing['4xl']};
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-3px);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }

  @media (min-width: 768px) {
    min-height: 624px;
    padding: ${tokens.spacing['6xl']} ${tokens.spacing['4xl']} ${tokens.spacing['5xl']};
  }
`

const Inner = styled.div`
  position: relative;
  z-index: 2;
  margin: 0 auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing['2xl']};
`

const Heading = styled.h2`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.white};
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0;
  max-width: 784px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  text-wrap: balance;

  @media (min-width: 768px) {
    font-size: 56px;
  }
`

const Subtitle = styled.p`
  font-size: ${tokens.font.size.lg};
  color: rgba(255, 255, 255, 0.9);
  line-height: 1.4;
  margin: 0;
  max-width: 460px;
  text-wrap: pretty;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.xl};
  }
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.md};
  width: 100%;
  margin-top: ${tokens.spacing.md};

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: center;
    width: auto;
  }
`

const buttonBase = `
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 8px;
  font-family: inherit;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  text-decoration: none;
  cursor: pointer;
  transition:
    background ${tokens.transition.fast},
    color ${tokens.transition.fast},
    border-color ${tokens.transition.fast};

  svg {
    color: currentColor;
    width: 14px;
    height: 14px;
  }

  @media (max-width: 767px) {
    width: 100%;
  }
`

const PrimaryCta = styled(Link)`
  ${buttonBase};
  background: ${tokens.color.white};
  color: ${tokens.color.blue};
  border: 1px solid ${tokens.color.white};

  &:hover {
    background: rgba(255, 255, 255, 0.92);
    color: ${tokens.color.blue};
  }
`

const SecondaryCta = styled.a`
  ${buttonBase};
  background: rgba(255, 255, 255, 0.12);
  color: ${tokens.color.white};
  border: 1px solid rgba(255, 255, 255, 0.3);

  &:hover {
    background: rgba(255, 255, 255, 0.2);
    color: ${tokens.color.white};
  }
`

const Marquee = styled.div`
  position: relative;
  z-index: 1;
  margin-left: calc(-1 * ${tokens.spacing.xl});
  margin-right: calc(-1 * ${tokens.spacing.xl});
  display: flex;
  flex-direction: column;
  gap: 12px;
  opacity: 0.4;
  pointer-events: none;
  user-select: none;
  mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 6%,
    black 94%,
    transparent 100%
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent 0%,
    black 6%,
    black 94%,
    transparent 100%
  );

  @media (min-width: 768px) {
    margin-left: calc(-1 * ${tokens.spacing['4xl']});
    margin-right: calc(-1 * ${tokens.spacing['4xl']});
  }
`

const scrollLeft = keyframes`
  from { transform: translate3d(0, 0, 0); }
  to   { transform: translate3d(-50%, 0, 0); }
`

const scrollRight = keyframes`
  from { transform: translate3d(-50%, 0, 0); }
  to   { transform: translate3d(0, 0, 0); }
`

const MarqueeTrack = styled.div<{ $direction: 'left' | 'right'; $duration: number }>`
  display: flex;
  gap: 8px;
  width: max-content;
  flex-shrink: 0;
  animation: ${({ $direction }) => ($direction === 'left' ? scrollLeft : scrollRight)}
    ${({ $duration }) => $duration}s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`

const Pill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px 4px 4px;
  background: ${tokens.color.white};
  border-radius: 9999px;
  white-space: nowrap;
  flex-shrink: 0;
`

const PillAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 9999px;
  border: 1px solid ${tokens.color.borderLight};
  background: ${tokens.color.white};
  object-fit: cover;
  flex-shrink: 0;
`

const PillName = styled.span`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 20px;
`

const SHARE_TWEET_TEXT =
  'Delegate your ENS to an active voter and earn rewards from the ENS DAO. The more people who join, the bigger the pool for everyone.'

function buildTwitterShareUrl(): string {
  if (typeof window === 'undefined') return '#'
  const text = encodeURIComponent(SHARE_TWEET_TEXT)
  const url = encodeURIComponent(window.location.origin)
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
}

function buildFallbackAvatar(address: string): string {
  try {
    return makeBlockie(address)
  } catch {
    return ''
  }
}

/**
 * Single pill in the marquee. Resolves ENS name + avatar client-side via wagmi
 * (backend may return them as null in preview/staging) and falls back through
 * backend-provided values → blockie / truncated address so every pill always
 * shows something useful.
 */
function PillItem({ voter }: { voter: VoterDetail }) {
  const addressOk = !!voter.address && isAddress(voter.address)

  const { data: resolvedName } = useEnsName({
    address: addressOk ? (voter.address as `0x${string}`) : undefined,
    query: { enabled: addressOk && !voter.ensName },
  })

  const ensName = voter.ensName ?? resolvedName ?? null

  const { data: resolvedAvatar } = useEnsAvatar({
    name: ensName ?? undefined,
    query: { enabled: !!ensName && !voter.avatarUrl },
  })

  const fallbackSrc = buildFallbackAvatar(voter.address)
  const avatarSrc =
    voter.avatarUrl ?? resolvedAvatar ?? fallbackSrc
  const label = ensName ?? truncateAddress(voter.address)

  return (
    <Pill>
      <PillAvatar
        src={avatarSrc}
        alt=""
        aria-hidden
        loading="lazy"
        onError={(event) => {
          // If the ENS metadata avatar 404s or fails to load, swap in the
          // blockie so the marquee never shows a broken image.
          const img = event.currentTarget
          if (fallbackSrc && img.src !== fallbackSrc) {
            img.src = fallbackSrc
          }
        }}
      />
      <PillName>{label}</PillName>
    </Pill>
  )
}

interface PillRowProps {
  voters: VoterDetail[]
  direction: 'left' | 'right'
  duration: number
}

function PillRow({ voters, direction, duration }: PillRowProps) {
  // Track holds two identical lists back-to-back. The animation translates the
  // whole track by -50%, so when the second copy reaches the start position
  // the loop wraps seamlessly. flex-shrink: 0 keeps each pill at its natural
  // width inside the max-content track.
  const items = [...voters, ...voters]
  return (
    <MarqueeTrack $direction={direction} $duration={duration}>
      {items.map((voter, i) => (
        <PillItem key={`${voter.address}-${i}`} voter={voter} />
      ))}
    </MarqueeTrack>
  )
}

export function CtaSection() {
  const fetchVoters = useCallback(() => api.activeVoters(), [])
  const { data } = useAsync(fetchVoters)

  const { rowA, rowB } = useMemo(() => {
    const voters = data?.voters ?? []
    if (voters.length === 0) return { rowA: [], rowB: [] }
    // Use as many voters as we have, split into two rows. If we end up with
    // very few pills, repeat the list within the row so the marquee never
    // looks half-empty (still seamless once the track itself is doubled).
    const all = [...voters]
    while (all.length < 12) all.push(...voters)
    const half = Math.ceil(all.length / 2)
    return {
      rowA: all.slice(0, half),
      rowB: all.slice(half).concat(all.slice(0, Math.max(0, half - (all.length - half)))),
    }
  }, [data])

  return (
    <Section data-testid="cta-section">
      <Card>
        <Inner>
          <Heading>
            Earn ENS rewards.<br />
            Strengthen governance.
          </Heading>
          <Subtitle>
            Delegate in under a minute. The more people who join, the bigger
            the pool for&nbsp;everyone.
          </Subtitle>
          <Actions>
            <PrimaryCta to="/griff">
              Delegate to Griff
              <FontAwesomeIcon icon={faArrowRight} />
            </PrimaryCta>
            <SecondaryCta
              href={buildTwitterShareUrl()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <FontAwesomeIcon icon={faShareNodes} />
              Share the program
            </SecondaryCta>
          </Actions>
        </Inner>

        {rowA.length > 0 && (
          <Marquee aria-hidden>
            <PillRow voters={rowA} direction="left" duration={120} />
            {rowB.length > 0 && (
              <PillRow voters={rowB} direction="right" duration={150} />
            )}
          </Marquee>
        )}
      </Card>
    </Section>
  )
}
