import { useCallback } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import styled from 'styled-components'
import { useEnsName } from 'wagmi'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck,
  faCircleXmark,
  faWallet,
  faClock,
  faCalendarDay,
  faArrowUpRightFromSquare,
  faShareNodes,
  faArrowRight,
} from '@fortawesome/free-solid-svg-icons'
import { Button } from '@ensdomains/thorin'
import { api } from '@/api'
import type { AddressDistributionRound } from '@/api/types'
import { DashboardPageSkeleton } from '@/components/shared/PageSkeletons'
import { useWalletState } from '@/features/wallet/useWalletState'
import { DashboardValuesCard } from '@/features/matchmaking'
import { useAsync } from '@/hooks/useAsync'
import { EnsAvatar } from '@/components/shared/EnsAvatar'
import { tokens, fadeInUp, ErrorMessage } from '@/styles'
import { formatEnsAmount, truncateAddress } from '@/utils/format'
import { useDashboardData } from './useDashboardData'

/* ─── Page shell ─── */

const Page = styled.div`
  width: 100%;
  max-width: 1120px;
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['3xl']};
  animation: ${fadeInUp} 0.4s ease both;
`

/* ─── Hero card ─── */

const HeroCard = styled.section`
  display: flex;
  flex-direction: column-reverse;
  gap: ${tokens.spacing['2xl']};
  padding: ${tokens.spacing['2xl']};
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: 1fr auto;
    column-gap: ${tokens.spacing['4xl']};
    row-gap: ${tokens.spacing['2xl']};
    align-items: stretch;
  }
`

const HeroText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['2xl']};
  min-width: 0;
`

const RewardsLabel = styled.span`
  font-size: ${tokens.font.size.xl};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.6;
`

const RewardsStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`

const RewardsNumber = styled.p<{ $delegated: boolean }>`
  margin: 0;
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $delegated }) =>
    $delegated ? tokens.color.greenDeep : tokens.color.darkBlue};
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  word-break: break-word;

  @media (min-width: 768px) {
    font-size: 68px;
  }
`

const AprLine = styled.p`
  margin: 0;
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 20px;
`

const AprLineMuted = styled(AprLine)`
  color: ${tokens.color.darkGray};
  font-weight: ${tokens.font.weight.medium};
`

const ChipsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
`

const InfoChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 14px;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkGray};
  line-height: 20px;
`

const ChipIcon = styled.span<{ $tone?: 'default' | 'positive' | 'muted' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 12px;
  color: ${({ $tone }) =>
    $tone === 'positive'
      ? tokens.color.positiveEmphasis
      : $tone === 'muted'
        ? tokens.color.textSubtle
        : tokens.color.textSecondary};
`

const HeroCtaWrap = styled.div`
  align-self: flex-start;

  a {
    text-decoration: none;
    display: inline-block;
  }

  @media (max-width: 519px) {
    width: 100%;

    a {
      display: block;
      width: 100%;
    }

    button {
      width: 100%;
      justify-content: center;
    }
  }
`

/* ─── Avatar column ─── */

const AvatarColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tokens.spacing.sm};
  flex-shrink: 0;
`

const AvatarRing = styled.div<{ $delegated: boolean }>`
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 9999px;
  padding: 24px;
  border: 12px solid
    ${({ $delegated }) =>
      $delegated ? tokens.color.positiveEmphasis : tokens.color.borderLight};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color ${tokens.transition.base};
`

const AvatarInner = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  border: 1px solid ${tokens.color.borderLight};
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`

const StatusTag = styled.span<{ $delegated: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 14px;
  background: ${({ $delegated }) =>
    $delegated ? tokens.color.status.success.bg : tokens.color.bgSubtle};
  color: ${({ $delegated }) =>
    $delegated ? tokens.color.positiveEmphasis : tokens.color.darkGray};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  white-space: nowrap;
`

/* ─── Recent payouts card ─── */

const PayoutsCard = styled.section`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 12px;
`

const PayoutsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.spacing.sm};
  padding: ${tokens.spacing.md} ${tokens.spacing.lg};
  background: ${tokens.color.surfaceAlt};
`

const PayoutsDivider = styled.div`
  height: 1px;
  width: 100%;
  background: ${tokens.color.borderLight};
`

const PayoutsTitle = styled.span`
  font-size: ${tokens.font.size.xl};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 24px;
`

const PayoutsLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.blue};
  line-height: 20px;
  cursor: pointer;
  transition: gap ${tokens.transition.fast}, opacity ${tokens.transition.fast};

  &:hover {
    text-decoration: none;
    gap: 10px;
    opacity: 0.85;
  }
`

const PayoutsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  padding: ${tokens.spacing.lg};

  @media (min-width: 768px) {
    grid-template-columns: repeat(3, 1fr);
  }
`

const PayoutCard = styled.button`
  display: flex;
  align-items: stretch;
  gap: 12px;
  padding: ${tokens.spacing.lg};
  background: ${tokens.color.surfaceAlt};
  border: none;
  border-radius: 8px;
  font-family: ${tokens.font.family};
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: background ${tokens.transition.fast}, transform ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.lightBlueOpacity};
    transform: translateY(-2px);
  }

  &:focus-visible {
    outline: 2px solid ${tokens.color.blue};
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover { transform: none; }
  }
`

const PayoutCardInner = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
`

const PayoutRound = styled.span`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 20px;
`

const PayoutAmount = styled.span<{ $tone: 'positive' | 'neutral' | 'muted' }>`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${({ $tone }) =>
    $tone === 'positive'
      ? tokens.color.positiveEmphasis
      : $tone === 'muted'
        ? tokens.color.textSubtle
        : tokens.color.darkBlue};
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
`

const PayoutMonth = styled.span`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkGray};
  line-height: 20px;
`

const PayoutBadge = styled.span<{ $tone: 'muted' | 'success' }>`
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 14px;
  background: ${({ $tone }) =>
    $tone === 'success' ? tokens.color.status.success.bg : tokens.color.borderLight};
  color: ${({ $tone }) =>
    $tone === 'success' ? tokens.color.positiveEmphasis : tokens.color.textSecondary};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  white-space: nowrap;
`

const PayoutArrow = styled.span`
  display: inline-flex;
  align-self: flex-start;
  margin-left: auto;
  color: ${tokens.color.textSecondary};
  font-size: 14px;
`

const PayoutsEmpty = styled.div`
  padding: ${tokens.spacing.xl};
  background: ${tokens.color.surfaceAlt};
  border-radius: 8px;
  text-align: center;
  color: ${tokens.color.darkGray};
  font-size: ${tokens.font.size.base};
  line-height: 1.5;
`

/* ─── Helpers ─── */

function formatEnsReward(value: string | number, { signed = true }: { signed?: boolean } = {}): string {
  const num = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(num)) return '0.00000'
  const abs = Math.abs(num)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 5,
    maximumFractionDigits: 5,
  })
  if (!signed) return formatted
  const sign = num >= 0 ? '+' : '-'
  return `${sign}${formatted}`
}

function formatBalance(value: string | number): string {
  const n = typeof value === 'string' ? Number(value) : value
  if (!Number.isFinite(n)) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return Math.round(n).toString()
}

function formatMonthLabel(month: string | null | undefined): string {
  if (!month) return '—'
  const [y, m] = month.split('-').map(Number)
  if (!y || !m) return month
  const date = new Date(Date.UTC(y, m - 1, 1))
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDaysLeft(daysRemaining: number | null): string {
  if (daysRemaining == null) return 'Pending'
  if (daysRemaining <= 0) return 'Last day'
  if (daysRemaining === 1) return '1d left'
  return `${daysRemaining}d left`
}

interface PayoutRow {
  roundNumber: number
  month: string
  reward: number
  status: 'paid' | 'no_reward' | 'not_eligible' | 'pending' | 'unavailable'
  hasReward: boolean
}

function buildPayoutRows(rounds: AddressDistributionRound[]): PayoutRow[] {
  // Most recent first; cap at 3
  const sorted = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber)
  return sorted.slice(0, 3).map((r) => {
    const status = r.rewardStatus
    const num = Number(r.totalRewardEns ?? '0')
    const reward = Number.isFinite(num) ? num : 0
    return {
      roundNumber: r.roundNumber,
      month: r.month ?? '',
      reward,
      status,
      hasReward: status === 'paid' && reward > 0,
    }
  })
}

/* ─── Component ─── */

export function DashboardPage() {
  const wallet = useWalletState()
  if (wallet.status === 'disconnected') return <Navigate to="/" replace />
  return <DashboardContent address={wallet.address} isDelegated={wallet.status === 'delegated'} />
}

interface DashboardContentProps {
  address: `0x${string}`
  isDelegated: boolean
}

function DashboardContent({ address, isDelegated }: DashboardContentProps) {
  const navigate = useNavigate()
  const { data, loading, error } = useDashboardData(address)

  const fetchDistributions = useCallback(
    () => api.distributionsForAddress(address),
    [address],
  )
  const distributions = useAsync(fetchDistributions)

  const { data: resolvedEnsName } = useEnsName({
    address,
    query: { enabled: !!address },
  })

  const delegateAddrForEns = data?.apr.delegatedTo ?? null
  const { data: resolvedDelegateName } = useEnsName({
    address: (delegateAddrForEns ?? undefined) as `0x${string}` | undefined,
    query: {
      enabled: !!delegateAddrForEns && !data?.apr.delegatedToEnsName,
    },
  })


  if (loading) return <DashboardPageSkeleton />

  if (error) {
    return (
      <Page>
        <ErrorMessage>Failed to load dashboard: {error}</ErrorMessage>
      </Page>
    )
  }

  if (!data) return null

  const { apr, round } = data

  const reward = Number(apr.estimatedMonthlyRewardEns ?? '0')
  const delegateEns = apr.delegatedToEnsName ?? null
  const delegateAddr = apr.delegatedTo ?? null
  const balanceEns = Number(apr.currentBalanceEns ?? '0')
  const userDisplayName = resolvedEnsName ?? truncateAddress(address)

  const delegateLabel = isDelegated
    ? delegateEns ??
      resolvedDelegateName ??
      (delegateAddr ? truncateAddress(delegateAddr) : 'an active voter')
    : null

  const payoutRows = distributions.data?.rounds
    ? buildPayoutRows(distributions.data.rounds as AddressDistributionRound[])
    : []
  const hasPayouts = payoutRows.length > 0

  const tweetText = isDelegated
    ? `I'm delegating my ENS to ${delegateLabel} to help keep ENS governance active, and earning rewards from the DAO. Payouts are automatic and my tokens never leave my wallet - see the program 👇`
    : ''
  const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(window.location.origin)}`

  return (
    <Page>
      {/* Hero card */}
      <HeroCard>
        <HeroText>
          <RewardsStack>
            <RewardsLabel>
              {isDelegated ? 'Your rewards this round' : 'You’re not earning yet'}
            </RewardsLabel>
            <RewardsNumber $delegated={isDelegated}>
              {isDelegated ? formatEnsReward(reward) : '0.00000'}
            </RewardsNumber>
            {!isDelegated && (
              <AprLineMuted>
                Pick an active voter to start earning rewards.
              </AprLineMuted>
            )}
          </RewardsStack>

          <ChipsRow>
            <InfoChip>
              <ChipIcon $tone={isDelegated ? 'positive' : 'muted'}>
                <FontAwesomeIcon icon={isDelegated ? faCircleCheck : faCircleXmark} />
              </ChipIcon>
              {isDelegated ? `Delegating to ${delegateLabel}` : 'Not delegating yet'}
            </InfoChip>
            <InfoChip>
              <ChipIcon>
                <FontAwesomeIcon icon={faWallet} />
              </ChipIcon>
              Holding {formatBalance(balanceEns)} ENS
            </InfoChip>
            <InfoChip>
              <ChipIcon>
                <FontAwesomeIcon icon={faCalendarDay} />
              </ChipIcon>
              Round {round.roundNumber}
            </InfoChip>
            <InfoChip>
              <ChipIcon>
                <FontAwesomeIcon icon={faClock} />
              </ChipIcon>
              {formatDaysLeft(round.daysRemaining)}
            </InfoChip>
          </ChipsRow>

          {isDelegated ? (
            <HeroCtaWrap>
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <Button
                  colorStyle="blueSecondary"
                  prefix={<FontAwesomeIcon icon={faShareNodes} />}
                >
                  Share to earn more
                </Button>
              </a>
            </HeroCtaWrap>
          ) : (
            <HeroCtaWrap>
              <Button
                colorStyle="bluePrimary"
                suffix={<FontAwesomeIcon icon={faArrowRight} />}
                onClick={() => navigate('/voters')}
              >
                Pick a delegate
              </Button>
            </HeroCtaWrap>
          )}
        </HeroText>

        <AvatarColumn>
          <AvatarRing $delegated={isDelegated}>
            <AvatarInner>
              <EnsAvatar
                address={address}
                name={resolvedEnsName ?? undefined}
                size={140}
              />
            </AvatarInner>
          </AvatarRing>
          <StatusTag $delegated={isDelegated}>
            <FontAwesomeIcon icon={isDelegated ? faCircleCheck : faCircleXmark} />
            {isDelegated ? 'Delegating' : 'Not delegating'}
          </StatusTag>
        </AvatarColumn>
      </HeroCard>

      <DashboardValuesCard />

      {/* Recent payouts */}
      <PayoutsCard>
        <PayoutsHeader>
          <PayoutsTitle>Recent Payouts</PayoutsTitle>
          <PayoutsLink type="button" onClick={() => navigate(`/rounds?address=${address}`)}>
            View all rounds <FontAwesomeIcon icon={faArrowRight} />
          </PayoutsLink>
        </PayoutsHeader>
        <PayoutsDivider />

        {!hasPayouts ? (
          <PayoutsEmpty>
            No payouts yet. Your first round closes when the current one ends - check back in {formatDaysLeft(round.daysRemaining).replace(' left', '')}.
          </PayoutsEmpty>
        ) : (
          <PayoutsRow>
            {payoutRows.map((row) => {
              const isUnavailable = row.status === 'unavailable'
              const isPending = row.status === 'pending'
              const amount =
                row.status === 'paid'
                  ? `+${formatEnsAmount(String(row.reward), { maximumFractionDigits: 4 })} ENS`
                  : row.status === 'not_eligible' || row.status === 'no_reward'
                    ? '0 ENS'
                    : '—'
              const tone: 'positive' | 'neutral' | 'muted' =
                row.hasReward ? 'positive' : 'neutral'
              return (
                <PayoutCard
                  key={row.roundNumber}
                  type="button"
                  onClick={() => navigate(`/rounds/${row.roundNumber}?address=${address}`)}
                  aria-label={`View Round ${row.roundNumber} details`}
                >
                  <PayoutCardInner>
                    <PayoutRound>Round {row.roundNumber}</PayoutRound>
                    <PayoutAmount $tone={tone}>{amount}</PayoutAmount>
                    <PayoutMonth>{formatMonthLabel(row.month)}</PayoutMonth>
                  </PayoutCardInner>
                  {isUnavailable ? (
                    <PayoutBadge $tone="muted">Unavailable</PayoutBadge>
                  ) : isPending ? (
                    <PayoutBadge $tone="muted">Pending</PayoutBadge>
                  ) : (
                    <PayoutArrow aria-hidden>
                      <FontAwesomeIcon icon={faArrowUpRightFromSquare} />
                    </PayoutArrow>
                  )}
                </PayoutCard>
              )
            })}
          </PayoutsRow>
        )}
      </PayoutsCard>
    </Page>
  )
}
