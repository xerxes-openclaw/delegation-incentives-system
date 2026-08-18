import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { tokens } from '@/styles/tokens'
import { formatTimeLeft } from '@/utils/format'
import { formatPool } from '@/utils/dashboard'
import { LiveDot } from '@/components/shared/LiveDot'
import { LabelWithTooltip } from '@/components/shared/LabelWithTooltip'

/**
 * Explains that delegation is reversible. The ⓘ is a lightweight explainer
 * only — never an eligibility gate.
 */
const SWITCH_ANYTIME_TOOLTIP =
  'Delegation is not a lock-in. You can pick a different delegate, or withdraw your delegation entirely, whenever you want — your rewards follow your current choice.'

interface RoundStatusBarProps {
  currentGrowthPct: string
  currentTierIndex: number
  poolSizeEns: string
  roundNumber: number
  roundEndDate: string
}

/**
 * Outer Wrapper container — `Outer` paints solid white across the full row so
 * the AppLayout body gradient doesn't bleed through this strip between the
 * Hero and the next section. `Inner` keeps the max-width + translateY(-50%)
 * overlap effect for the card.
 */
const Outer = styled.div`
  width: 100%;
  background: ${tokens.color.white};
  position: relative;
  z-index: 1;
`

const Wrapper = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: 0 ${tokens.spacing.xl};
  transform: translateY(-50%);
`

const Card = styled.div`
  display: flex;
  flex-direction: column;
  padding: 0;
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 10px;
  box-shadow: ${tokens.shadow.sm};
  overflow: hidden;
`

const TrustRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${tokens.spacing.sm} ${tokens.spacing.lg};
  padding: 12px 16px;
  width: 100%;
`

const TrustItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.semibold};
  color: ${tokens.color.positiveEmphasis};
  line-height: 1.3;

  /* Scope to the direct-child check icon so the ⓘ glyph inside
     LabelWithTooltip keeps its own (smaller) sizing. */
  > svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }
`

const Separator = styled.div`
  width: 100%;
  height: 1px;
  background: ${tokens.color.borderLight};
  flex-shrink: 0;
`

const DataRow = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
`

const Col = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  align-items: ${({ $align }) =>
    $align === 'center' ? 'center' : $align === 'right' ? 'flex-end' : 'flex-start'};
`

const ColLabel = styled.span`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 6px;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.lg};
  }
`

const ColSub = styled.span`
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.normal};
  color: ${tokens.color.darkGray};
  line-height: 1.35;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.base};
  }
`

const GrowthLabel = styled.span<{ $negative?: boolean }>`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $negative }) => ($negative ? tokens.color.negative : tokens.color.positiveEmphasis)};
  line-height: 1.3;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.lg};
  }
`

export function RoundStatusBar({
  currentGrowthPct,
  currentTierIndex,
  poolSizeEns,
  roundNumber,
  roundEndDate,
}: RoundStatusBarProps) {
  const growthNum = parseFloat(currentGrowthPct)
  const isNegative = growthNum < 0
  const growthPrefix = isNegative ? '-' : '+'
  const displayGrowth = isNegative ? currentGrowthPct.replace('-', '') : currentGrowthPct
  const displayRound = roundNumber
  const displayTimeLeft = formatTimeLeft(roundEndDate)
  const displayPoolSizeEns = formatPool(poolSizeEns).toLowerCase()

  return (
    <Outer>
      <Wrapper>
        <Card>
        <TrustRow>
          <TrustItem>
            <FontAwesomeIcon icon={faCircleCheck} />
            No tokens locked
          </TrustItem>
          <TrustItem>
            <FontAwesomeIcon icon={faCircleCheck} />
            <LabelWithTooltip
              text={SWITCH_ANYTIME_TOOLTIP}
              iconAriaLabel="About switching delegate"
            >
              Switch anytime
            </LabelWithTooltip>
          </TrustItem>
          <TrustItem>
            <FontAwesomeIcon icon={faCircleCheck} />
            Rewards auto-sent
          </TrustItem>
        </TrustRow>
        <Separator />
        <DataRow>
          <Col $align="left">
            <ColLabel>
              <LiveDot pulse />
              Round {displayRound}
            </ColLabel>
            <ColSub>{displayTimeLeft}</ColSub>
          </Col>
          <Col $align="center">
            <GrowthLabel $negative={isNegative}>
              {growthPrefix}{displayGrowth}%
            </GrowthLabel>
            <ColSub>active VP growth</ColSub>
          </Col>
          <Col $align="right">
            <ColLabel>Tier {currentTierIndex + 1}</ColLabel>
            <ColSub>{displayPoolSizeEns} ENS pool</ColSub>
          </Col>
        </DataRow>
        </Card>
      </Wrapper>
    </Outer>
  )
}
