import { type ReactNode, useEffect, useRef, useState } from 'react'
import styled, { css, keyframes } from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faShareNodes } from '@fortawesome/free-solid-svg-icons'
import type { TierEntry } from '@/api/types'
import { tokens } from '@/styles/tokens'
import { fadeInUp } from '@/styles/primitives'
import { formatPool, fmtApy } from '@/utils/dashboard'

/** "~12.5% APY" caption for a tier, or null when the API has no estimate. */
function apyLabel(tier: TierEntry): string | null {
  const label = fmtApy(tier.estimatedAprPct)
  return label === '—' ? null : `~${label} APY for delegators`
}

interface TierTableSectionProps {
  tiers: TierEntry[]
}

/** Whole-number percent from a decimal string ('15.00' → '15'), or null. */
function formatPct(value: string | null | undefined): string | null {
  if (value == null) return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return `${Math.round(n)}`
}

/**
 * The participation milestone that unlocks a tier, expressed as the band of
 * month-over-month growth in active delegated VP (never a reward rate). Locked
 * tiers read "unlocks at ..."; reached tiers just show the band.
 */
function formatMilestone(tier: TierEntry, isLocked: boolean): string | null {
  const min = formatPct(tier.momGrowthMinPct)
  if (min == null) return null
  const max = formatPct(tier.momGrowthMaxPct)
  const band =
    max != null
      ? `+${min}-${max}% delegation growth`
      : `+${min}% delegation growth`
  return isLocked ? `unlocks at ${band}` : band
}

const Section = styled.section`
  position: relative;
  overflow: hidden;
  padding: ${tokens.spacing['4xl']} ${tokens.spacing.xl};
  background: linear-gradient(
    to bottom,
    ${tokens.color.white} 0%,
    ${tokens.color.surfaceAlt} 100%
  );
  border-bottom: 1px solid ${tokens.color.borderLight};

  @media (min-width: 768px) {
    padding: ${tokens.spacing['7xl']} ${tokens.spacing['4xl']};
  }
`

const driftRight = keyframes`
  0%   { transform: translateX(0);    opacity: 0; }
  15%  {                              opacity: 0.55; }
  85%  {                              opacity: 0.55; }
  100% { transform: translateX(60vw); opacity: 0; }
`

const driftLeft = keyframes`
  0%   { transform: translateX(0);     opacity: 0; }
  15%  {                               opacity: 0.55; }
  85%  {                               opacity: 0.55; }
  100% { transform: translateX(-60vw); opacity: 0; }
`

const ParticlesLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const clusterPulse = keyframes`
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.08); }
`

const EdgeCluster = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  width: 200px;
  height: 200px;
  margin-top: -100px;
  ${({ $side }) =>
    $side === 'left'
      ? css`
          left: -100px;
        `
      : css`
          right: -100px;
        `}
  border-radius: 50%;
  background: radial-gradient(
    circle,
    ${tokens.color.lightBlueOpacity} 0%,
    ${tokens.color.lightBlueOpacity} 25%,
    transparent 75%
  );
  opacity: 0.6;
  filter: blur(28px);
  will-change: transform, opacity;
  animation: ${clusterPulse} 7s ease-in-out infinite;

  @media (min-width: 768px) {
    width: 280px;
    height: 280px;
    margin-top: -140px;
    ${({ $side }) =>
      $side === 'left'
        ? css`
            left: -140px;
          `
        : css`
            right: -140px;
          `}
  }
`

const SideParticle = styled.span<{
  $top: number
  $size: number
  $duration: number
  $delay: number
  $direction: 'right' | 'left'
}>`
  position: absolute;
  top: ${({ $top }) => $top}%;
  ${({ $direction }) =>
    $direction === 'right'
      ? css`
          left: -12px;
        `
      : css`
          right: -12px;
        `}
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 1px;
  background: ${tokens.color.blue};
  opacity: 0;
  will-change: transform, opacity;
  animation: ${({ $direction }) => ($direction === 'right' ? driftRight : driftLeft)}
    ${({ $duration }) => $duration}s linear ${({ $delay }) => $delay}s infinite;
`

const SIDE_PARTICLES: Array<{
  id: number
  top: number
  size: number
  duration: number
  delay: number
  direction: 'right' | 'left'
}> = [
  { id: 0, top: 8, size: 4, duration: 11, delay: 0, direction: 'right' },
  { id: 1, top: 22, size: 3, duration: 14, delay: 3, direction: 'right' },
  { id: 2, top: 38, size: 5, duration: 12, delay: 1.5, direction: 'right' },
  { id: 3, top: 54, size: 3, duration: 13, delay: 5, direction: 'right' },
  { id: 4, top: 70, size: 4, duration: 15, delay: 2, direction: 'right' },
  { id: 5, top: 86, size: 3, duration: 12, delay: 6, direction: 'right' },
  { id: 6, top: 14, size: 3, duration: 13, delay: 4, direction: 'left' },
  { id: 7, top: 30, size: 4, duration: 11, delay: 1, direction: 'left' },
  { id: 8, top: 46, size: 3, duration: 14, delay: 6.5, direction: 'left' },
  { id: 9, top: 62, size: 5, duration: 12, delay: 2.5, direction: 'left' },
  { id: 10, top: 78, size: 3, duration: 15, delay: 5.5, direction: 'left' },
  { id: 11, top: 92, size: 4, duration: 13, delay: 0.5, direction: 'left' },
]

const Inner = styled.div`
  position: relative;
  z-index: 1;
  max-width: ${tokens.maxWidth.section};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['4xl']};
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing.lg};
  max-width: 900px;
  margin: 0 auto;
  text-align: center;
`

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing.md};
`

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 6px 14px;
  border-radius: ${tokens.radius.pill};
  background: ${tokens.color.status.neutral.bg};
  border: 1px solid ${tokens.color.status.neutral.border};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.semibold};
  color: ${tokens.color.darkGray};
`

const Heading = styled.h2`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['5xl']};
  }
`

const Description = styled.p`
  font-size: ${tokens.font.size.lg};
  line-height: 1.5;
  color: ${tokens.color.darkGray};
  margin: 0;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.xl};
  }
`

const CtaWrap = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
`

const ShareButton = styled.a`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 24px;
  border-radius: 8px;
  background: ${tokens.color.white};
  color: ${tokens.color.text};
  border: 1px solid ${tokens.color.border};
  font-family: inherit;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  text-decoration: none;
  cursor: pointer;
  width: 100%;
  transition:
    background ${tokens.transition.fast},
    border-color ${tokens.transition.fast};

  svg {
    color: currentColor;
    width: 14px;
    height: 14px;
  }

  &:hover {
    background: ${tokens.color.surfaceAlt};
    border-color: ${tokens.color.gray};
    color: ${tokens.color.text};
    text-decoration: none;
  }

  @media (min-width: 768px) {
    width: auto;
  }
`

const SHARE_TWEET_TEXT =
  'As more ENS is delegated to active voters, the shared reward pool grows for everyone. Delegate yours and help strengthen ENS governance.'

function buildTwitterShareUrl(): string {
  if (typeof window === 'undefined') return '#'
  const text = encodeURIComponent(SHARE_TWEET_TEXT)
  const url = encodeURIComponent(window.location.origin)
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`
}

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.sm};
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
`

const Row = styled.div<{ $isCurrent: boolean; $isLocked: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: ${tokens.spacing.lg};
  padding: ${tokens.spacing.lg} ${tokens.spacing.md};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: ${tokens.radius.md};
  opacity: ${({ $isLocked }) => ($isLocked ? 0.5 : 1)};
  background-image: linear-gradient(
    to right,
    ${tokens.color.lightBlueOpacity} 50%,
    transparent 50%
  );
  background-size: 220% 100%;
  background-position: 100% 0;
  transition:
    background-position 0.9s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.25s ease;

  ${({ $isCurrent }) =>
    $isCurrent &&
    css`
      &::before {
        content: '';
        position: absolute;
        left: -${tokens.spacing.md};
        top: 50%;
        transform: translateY(-50%);
        width: 3px;
        height: 60%;
        background: ${tokens.color.positiveEmphasis};
        border-radius: 2px;
      }
    `}

  &:hover {
    background-position: 0 0;
    opacity: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    background-image: none;
  }

  @media (min-width: 768px) {
    padding: ${tokens.spacing.xl} ${tokens.spacing.lg};
    gap: ${tokens.spacing['2xl']};
  }
`

const RowLeft = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
`

const TierLabel = styled.span<{ $isCurrent: boolean }>`
  font-size: ${tokens.font.size.base};
  font-weight: ${({ $isCurrent }) =>
    $isCurrent ? tokens.font.weight.bold : tokens.font.weight.semibold};
  color: ${tokens.color.darkBlue};

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.lg};
  }
`

const TierStatus = styled.span<{ $isCurrent: boolean; $isLocked: boolean }>`
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${({ $isCurrent, $isLocked }) =>
    $isCurrent
      ? tokens.color.positiveEmphasis
      : $isLocked
        ? tokens.color.darkGray
        : tokens.color.blue};

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.sm};
  }
`

const RowRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  text-align: right;
  font-variant-numeric: tabular-nums;
`

const PoolValue = styled.span<{ $isUnlocked: boolean }>`
  font-size: ${tokens.font.size.xl};
  font-weight: ${tokens.font.weight.semibold};
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: ${({ $isUnlocked }) =>
    $isUnlocked ? tokens.color.darkBlue : tokens.color.darkGray};

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['3xl']};
  }
`

const MilestoneCaption = styled.span`
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkGray};

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.sm};
  }
`

const ApyCaption = styled.span<{ $isCurrent: boolean }>`
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $isCurrent }) =>
    $isCurrent ? tokens.color.positiveEmphasis : tokens.color.blue};

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.sm};
  }
`

const AnimatedRow = styled.div<{ $visible: boolean }>`
  opacity: 0;
  ${({ $visible }) =>
    $visible &&
    css`
      animation: ${fadeInUp} 0.5s ease both;
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }
`

function RevealRow({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4, rootMargin: '0px 0px -10% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <AnimatedRow ref={ref} $visible={visible}>
      {children}
    </AnimatedRow>
  )
}

export function TierTableSection({ tiers }: TierTableSectionProps) {
  return (
    <Section>
      <ParticlesLayer aria-hidden>
        <EdgeCluster $side="left" />
        <EdgeCluster $side="right" />
        {SIDE_PARTICLES.map((p) => (
          <SideParticle
            key={p.id}
            $top={p.top}
            $size={p.size}
            $duration={p.duration}
            $delay={p.delay}
            $direction={p.direction}
          />
        ))}
      </ParticlesLayer>
      <Inner>
        <Header>
          <TitleBlock>
            <Eyebrow>Network effect</Eyebrow>
            <Heading>
              More delegation, <br />
              bigger reward pool for everyone
            </Heading>
            <Description>
              Rewards come from a shared pool funded by the ENS DAO. <br />
              The more ENS delegated to active voters, the larger that pool
              grows for everyone.
            </Description>
          </TitleBlock>
        </Header>

        <List data-testid="tier-table">
          {tiers.map((tier) => {
            const isCurrent = !!tier.isCurrent
            const isLocked = !tier.isUnlocked && !isCurrent
            const poolLabel = tier.poolSizeEns
              ? `${formatPool(tier.poolSizeEns)} ENS`
              : '—'
            const milestoneLabel = formatMilestone(tier, isLocked)
            const statusLabel = isCurrent
              ? 'Current tier'
              : tier.isUnlocked
                ? 'Unlocked'
                : 'Locked'
            return (
              <RevealRow key={tier.index}>
                <Row $isCurrent={isCurrent} $isLocked={isLocked}>
                  <RowLeft>
                    <TierLabel $isCurrent={isCurrent}>
                      Tier #{tier.index + 1}
                    </TierLabel>
                    <TierStatus $isCurrent={isCurrent} $isLocked={isLocked}>
                      {statusLabel}
                    </TierStatus>
                  </RowLeft>
                  <RowRight>
                    <PoolValue $isUnlocked={tier.isUnlocked}>
                      {poolLabel}
                    </PoolValue>
                    {apyLabel(tier) && (
                      <ApyCaption $isCurrent={isCurrent}>
                        {apyLabel(tier)}
                      </ApyCaption>
                    )}
                    {milestoneLabel && (
                      <MilestoneCaption>{milestoneLabel}</MilestoneCaption>
                    )}
                  </RowRight>
                </Row>
              </RevealRow>
            )
          })}
        </List>
      </Inner>
    </Section>
  )
}
