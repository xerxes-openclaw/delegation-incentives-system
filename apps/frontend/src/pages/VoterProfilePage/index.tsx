import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import styled from 'styled-components'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faArrowLeft,
  faArrowUpRightFromSquare,
  faBolt,
  faCheck,
  faCircleCheck,
  faCircleMinus,
  faCircleXmark,
  faClock,
  faCopy,
  faSquarePollVertical,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { faXTwitter } from '@fortawesome/free-brands-svg-icons'
import { isAddress } from 'viem'
import { useEnsName, useEnsAddress, useEnsText } from 'wagmi'
import { env } from '@/config/env'
import { MOCK_ENS_TO_ADDRESS } from '@/api/mock'
import type { VoterDetail } from '@/api'
import { DelegateProfileSkeleton } from '@/components/shared/PageSkeletons'
import { LabelWithTooltip } from '@/components/shared/LabelWithTooltip'
import { useVoter } from '@/features/voters/useVoter'
import { useWalletState } from '@/features/wallet/useWalletState'
import { DelegateValuesCard } from '@/features/matchmaking'
import { EnsAvatar } from '@/components/shared/EnsAvatar'
import { DelegationEligibilityModal } from '@/features/delegate/components/DelegationEligibilityModal'
import { DelegationModal } from '@/features/delegate/components/DelegationModal'
import { DelegateShareModal } from '@/features/delegate/components/DelegateShareModal'
import { buildVoterShareUrl } from '@/features/delegate/utils/shareCard'
import {
  useGaslessEligibility,
  useRelayerBalance,
} from '@/features/delegate/hooks/useGaslessRelayer'
import { openWalletModal } from '@/features/wallet/openWalletModal'
import { contracts } from '@/config/contracts'
import { tokens, fadeInUp, ErrorMessage } from '@/styles'
import { formatEnsAmount, truncateAddress } from '@/utils/format'
import { getAnticaptureDelegateUrl } from '@/utils/delegation'
import { Button } from '@ensdomains/thorin'

/* ─── Helpers ─── */

function formatVotingPower(vpWei: string): string {
  const ens = Number(vpWei) / 1e18
  if (ens >= 1_000_000) {
    const m = ens / 1_000_000
    const rounded = Math.round(m * 10) / 10
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}M`
  }
  if (ens >= 1_000) {
    const k = ens / 1_000
    const rounded = Math.round(k * 10) / 10
    return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}K`
  }
  return formatEnsAmount(ens)
}

function formatActiveSinceShort(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const year = String(date.getFullYear()).slice(-2)
  return `${month} ‘${year}`
}

/* ─── Page layout ─── */

const Page = styled.div`
  width: 100%;
  max-width: 1120px;
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['3xl']};
  animation: ${fadeInUp} 0.4s ease both;
`

/* ─── Header card ─── */

const HeaderCard = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['2xl']};
  padding: ${tokens.spacing['2xl']};
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);

  @media (min-width: 768px) {
    display: grid;
    grid-template-columns: 1fr auto;
    grid-template-areas:
      "back avatar"
      "text avatar";
    column-gap: ${tokens.spacing['4xl']};
    row-gap: ${tokens.spacing['2xl']};
  }
`

const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['2xl']};
  min-width: 0;
  align-items: center;
  text-align: center;

  @media (min-width: 768px) {
    grid-area: text;
    align-items: stretch;
    text-align: left;
  }
`

const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.md};
  align-items: center;

  @media (min-width: 768px) {
    align-items: stretch;
  }
`

const BackLinkButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.spacing.xs};
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  align-self: flex-start;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  color: ${tokens.color.blue};
  transition: opacity ${tokens.transition.fast}, gap ${tokens.transition.fast};

  &:hover {
    text-decoration: none;
    opacity: 0.8;
    gap: ${tokens.spacing.sm};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.color.blue};
    outline-offset: 2px;
    border-radius: 4px;
  }

  @media (min-width: 768px) {
    grid-area: back;
  }
`

const NameRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tokens.spacing.md};
  justify-content: center;

  @media (min-width: 768px) {
    justify-content: flex-start;
  }
`

const NameTitle = styled.h1`
  margin: 0;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  letter-spacing: -0.02em;
  word-break: break-word;
  text-wrap: balance;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['5xl']};
  }
`

const AddressTag = styled.button<{ $copied?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: ${({ $copied }) =>
    $copied ? tokens.color.status.success.bg : tokens.color.borderLight};
  border: none;
  border-radius: 14px;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  color: ${({ $copied }) =>
    $copied ? tokens.color.status.success.fg : tokens.color.darkGray};
  white-space: nowrap;
  cursor: pointer;
  transition:
    background ${tokens.transition.fast},
    color ${tokens.transition.fast};

  &:hover {
    background: ${({ $copied }) =>
      $copied ? tokens.color.status.success.bg : tokens.color.middleGray};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.color.blue};
    outline-offset: 2px;
  }
`

const CopyIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  font-size: 12px;
  opacity: 0.7;
`

const Description = styled.p`
  margin: 0;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.medium};
  line-height: 1.4;
  color: ${tokens.color.darkGray};
  max-width: 720px;
  text-wrap: pretty;
`

const SocialLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;

  @media (min-width: 768px) {
    justify-content: flex-start;
  }
`

const SocialChip = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 14px;
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  color: ${tokens.color.darkGray};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  text-decoration: none;
  transition: border-color ${tokens.transition.fast}, color ${tokens.transition.fast};

  &:hover {
    text-decoration: none;
    border-color: ${tokens.color.blue};
    color: ${tokens.color.blue};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.color.blue};
    outline-offset: 2px;
  }
`

const SocialIcon = styled.span`
  display: inline-flex;
  width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  font-size: 14px;
`

const CtaRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    width: auto;
  }
`

const FreeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(246, 248, 250, 0.2);
  border: 1px solid rgba(208, 215, 222, 0.2);
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.bold};
  line-height: 16px;
  color: white;
  margin-left: ${tokens.spacing.sm};
  vertical-align: middle;
`

/**
 * Non-interactive "Delegated" state for the CTA. When the viewer already
 * delegates to this voter, the button stays visible but turns green and inert
 * (no onClick + pointer-events off) instead of disappearing.
 */
const DelegatedButton = styled(Button)`
  pointer-events: none;
`

/* ─── Avatar column with participation ring ─── */

const AvatarColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tokens.spacing.sm};
  flex-shrink: 0;

  @media (min-width: 768px) {
    grid-area: avatar;
    align-self: center;
  }
`

const RingWrap = styled.div`
  position: relative;
  width: 240px;
  height: 240px;
  flex-shrink: 0;

  @media (max-width: 767px) {
    width: 160px;
    height: 160px;
  }
`

const RingSvg = styled.svg`
  position: absolute;
  inset: 0;
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
`

const AvatarSlot = styled.div`
  position: absolute;
  inset: 24px;
  border-radius: 9999px;
  overflow: hidden;
  border: 1px solid ${tokens.color.borderLight};
  background: ${tokens.color.surface};
  display: flex;
  align-items: center;
  justify-content: center;
`

const ParticipationTag = styled.span<{ $isFull: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 14px;
  background: ${({ $isFull }) =>
    $isFull ? tokens.color.status.success.bg : tokens.color.lightBlueOpacity};
  color: ${({ $isFull }) =>
    $isFull ? tokens.color.status.success.fg : tokens.color.blue};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  white-space: nowrap;
`

interface ParticipationRingProps {
  percent: number
  address: string
  name?: string
  avatarUrl?: string | null
}

function ParticipationRing({ percent, address, name, avatarUrl }: ParticipationRingProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [measuredSize, setMeasuredSize] = useState(148)
  const [animatedPct, setAnimatedPct] = useState(0)

  // Size the ring + avatar to whatever space the column gives us
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      const next = Math.max(148, Math.min(rect.width, rect.height || rect.width))
      setMeasuredSize(next)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Animate from 0% to target on mount — small delay so the transition catches
  useEffect(() => {
    const handle = window.setTimeout(() => setAnimatedPct(percent), 120)
    return () => window.clearTimeout(handle)
  }, [percent])

  const stroke = 12
  const radius = (measuredSize - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const safeTargetPct = Math.max(0, Math.min(100, percent))
  const safeAnimatedPct = Math.max(0, Math.min(100, animatedPct))
  const offset = circumference - (safeAnimatedPct / 100) * circumference
  const isFull = safeTargetPct >= 100
  const color = isFull ? tokens.color.positiveEmphasis : tokens.color.blue
  const avatarSize = Math.max(0, measuredSize - 48)

  return (
    <RingWrap ref={wrapRef} aria-label={`${Math.round(safeTargetPct)}% participation`}>
      <RingSvg viewBox={`0 0 ${measuredSize} ${measuredSize}`} preserveAspectRatio="xMidYMid meet">
        <circle
          cx={measuredSize / 2}
          cy={measuredSize / 2}
          r={radius}
          fill="none"
          stroke={tokens.color.borderLight}
          strokeWidth={stroke}
        />
        <circle
          cx={measuredSize / 2}
          cy={measuredSize / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1), stroke 0.3s ease',
          }}
        />
      </RingSvg>
      <AvatarSlot>
        <EnsAvatar
          address={address}
          name={name}
          avatarUrl={avatarUrl ?? undefined}
          size={avatarSize}
        />
      </AvatarSlot>
    </RingWrap>
  )
}

/* ─── Stats row ─── */

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${tokens.spacing.md};

  @media (min-width: 768px) {
    grid-template-columns: repeat(4, 1fr);
  }
`

const StatCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.xs};
  padding: ${tokens.spacing.xl};
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 12px;
`

const StatTopRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
`

const StatValue = styled.span`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  white-space: nowrap;
`

const StatIconBox = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: ${tokens.color.textSubtle};
  font-size: 18px;
`

const StatLabel = styled.span`
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkGray};
  line-height: 20px;
`

/* ─── Voting record table ─── */

const VotingRecordSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.lg};
  width: 100%;
`

const SectionTitle = styled.h2`
  margin: 0;
  font-family: ${tokens.font.family};
  font-size: ${tokens.font.size['2xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.25;
`

const TableCard = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 12px;
  overflow: hidden;
`

const TableHeadRow = styled.div`
  display: flex;
  background: ${tokens.color.bgSubtle};
  border-bottom: 1px solid ${tokens.color.borderLight};

  @media (max-width: 767px) {
    display: none;
  }
`

const TableHeadCell = styled.div<{ $width?: string }>`
  padding: 12px;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkGray};
  line-height: 20px;
  ${({ $width }) => ($width ? `width: ${$width}; flex-shrink: 0;` : `flex: 1; min-width: 0;`)}
`

const TableRow = styled.a`
  display: flex;
  background: ${tokens.color.surface};
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition: background ${tokens.transition.fast};

  &:not(:last-child) {
    border-bottom: 1px solid ${tokens.color.borderLight};
  }

  &:hover {
    text-decoration: none;
    background: ${tokens.color.bgSubtle};
  }

  &:focus-visible {
    outline: 2px solid ${tokens.color.blue};
    outline-offset: -2px;
  }

  @media (max-width: 767px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 12px 16px;
    gap: ${tokens.spacing.sm} ${tokens.spacing.md};
  }
`

const TableCell = styled.div<{ $width?: string; $primary?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tokens.spacing.sm};
  padding: 12px;
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.darkGray};
  line-height: 20px;
  ${({ $width }) => ($width ? `width: ${$width}; flex-shrink: 0;` : `flex: 1; min-width: 0;`)}

  @media (max-width: 767px) {
    width: 100%;
    padding: 0;
    ${({ $primary }) =>
      $primary
        ? `
          grid-column: 1 / -1;
          font-weight: ${tokens.font.weight.bold};
          color: ${tokens.color.darkBlue};
          word-break: break-word;
        `
        : `
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        `}
  }
`

const MobileLabel = styled.span`
  display: none;

  @media (max-width: 767px) {
    display: inline-block;
    color: ${tokens.color.darkGray};
    font-weight: ${tokens.font.weight.medium};
  }
`

const CellValue = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.spacing.sm};
`

const VoteIcon = styled.span<{ $tone: 'positive' | 'negative' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-size: 16px;
  color: ${({ $tone }) =>
    $tone === 'positive'
      ? tokens.color.positiveEmphasis
      : $tone === 'negative'
        ? tokens.color.negative
        : tokens.color.textSubtle};
`

/* ─── Component ─── */

function useEnsTextRecord(name: string | null, key: string): string | undefined {
  const { data } = useEnsText({
    name: name ?? undefined,
    key,
    query: { enabled: Boolean(name) && !env.useMockApi },
  })
  return typeof data === 'string' && data.trim().length > 0 ? data : undefined
}

interface ProposalRow {
  id: number
  title: string
  /** Voter's vote: 0=Against, 1=For, 2=Abstain, null=did not vote */
  voterSupport: number | null
  /** Proposal status from backend (executed/succeeded/queued/defeated/expired). */
  status: string
  anticaptureUrl: string
}

type ProposalVote = NonNullable<
  VoterDetail['last10Proposals']
> extends Array<infer T>
  ? T
  : never

function buildProposalRows(proposals: ProposalVote[]): ProposalRow[] {
  return proposals.map((p, i) => ({
    id: i + 1,
    title: p.title || `Proposal #${i + 1}`,
    voterSupport: p.voterSupport,
    status: p.status,
    anticaptureUrl: `https://app.anticapture.com/ens/proposals/${p.proposalId}`,
  }))
}

interface VoteDisplay {
  label: string
  tone: 'positive' | 'negative' | 'neutral'
  icon: typeof faCircleCheck
}

function describeVote(support: number | null): VoteDisplay {
  if (support === 1) return { label: 'For', tone: 'positive', icon: faCircleCheck }
  if (support === 0) return { label: 'Against', tone: 'negative', icon: faCircleXmark }
  if (support === 2) return { label: 'Abstain', tone: 'neutral', icon: faCircleMinus }
  return { label: 'Did not vote', tone: 'neutral', icon: faCircleMinus }
}

function describeResult(status: string): VoteDisplay | null {
  switch (status) {
    case 'executed':
    case 'succeeded':
    case 'queued':
      return { label: 'Passed', tone: 'positive', icon: faCircleCheck }
    case 'defeated':
    case 'expired':
      return { label: 'Failed', tone: 'negative', icon: faCircleXmark }
    default:
      return null
  }
}

export function VoterProfilePage() {
  const navigate = useNavigate()
  const { address: param } = useParams<{ address: string }>()
  const rawParam = param ?? ''
  const isEnsParam = !isAddress(rawParam)

  const { data: resolvedAddress, isLoading: ensLoading } = useEnsAddress({
    name: rawParam,
    query: { enabled: isEnsParam && !env.useMockApi },
  })

  const mockResolvedAddress = useMemo(() => {
    if (!isEnsParam || !env.useMockApi) return null
    return MOCK_ENS_TO_ADDRESS[rawParam.toLowerCase()] ?? null
  }, [rawParam, isEnsParam])

  const resolvedAddr = isEnsParam
    ? (env.useMockApi ? (mockResolvedAddress ?? '') : (resolvedAddress ?? ''))
    : rawParam
  const { voter, loading, error } = useVoter(resolvedAddr)
  const walletState = useWalletState()
  const { hasEnoughBalance: relayerHasGas } = useRelayerBalance()
  const [modalOpen, setModalOpen] = useState(false)
  const [eligibilityModalOpen, setEligibilityModalOpen] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const connectedAddress =
    walletState.status !== 'disconnected' ? walletState.address : undefined

  // True when the connected wallet is viewing its own delegate profile.
  const isOwnProfile =
    !!connectedAddress &&
    !!resolvedAddr &&
    connectedAddress.toLowerCase() === resolvedAddr.toLowerCase()

  // First-visit nudge: the one time a delegate lands on their own profile, pop
  // the share modal so they spread the word. Keyed by address in localStorage
  // so it fires exactly once per delegate per browser. Waits for resolvedAddr,
  // so it never flashes before ENS resolution.
  useEffect(() => {
    if (!isOwnProfile || !resolvedAddr) return
    const key = `ens-dis:delegate-share-seen:${resolvedAddr.toLowerCase()}`
    let seen = false
    try {
      seen = localStorage.getItem(key) === '1'
    } catch {
      // localStorage blocked (private mode): treat as seen so we don't nag.
      seen = true
    }
    if (seen) return
    setShareModalOpen(true)
    try {
      localStorage.setItem(key, '1')
    } catch {
      // ignore write failures
    }
  }, [isOwnProfile, resolvedAddr])
  // Single source of truth — the relayer's own verdict, never a front-side rule.
  const {
    isEligible: gaslessEligible,
    reason: eligibilityReason,
    resetsAt: rateLimitResetsAt,
    isLoading: eligibilityLoading,
  } = useGaslessEligibility(connectedAddress)
  // Set when Delegate is clicked before the verdict resolves, so we route to
  // the right modal once it does instead of guessing mid-flight.
  const [pendingDelegate, setPendingDelegate] = useState(false)

  // The Free pill mirrors the relayer: once connected it reflects the wallet's
  // actual eligibility; disconnected it shows the program-level promise.
  const showFreeBadge = connectedAddress
    ? gaslessEligible
    : relayerHasGas === true

  // Route a connected wallet to the eligibility modal (if the relayer blocks
  // sponsorship) or straight to the delegation flow. Declared before the
  // early returns below so the routing effect obeys the rules of hooks.
  const routeDelegate = () => {
    if (eligibilityReason) {
      setEligibilityModalOpen(true)
      return
    }
    setModalOpen(true)
  }

  useEffect(() => {
    if (pendingDelegate && !eligibilityLoading) {
      setPendingDelegate(false)
      routeDelegate()
    }
    // routeDelegate reads the latest reason on each render; deps cover its inputs.
  }, [pendingDelegate, eligibilityLoading, eligibilityReason])

  const { data: resolvedEnsName } = useEnsName({
    address: resolvedAddr as `0x${string}`,
    query: { enabled: !!resolvedAddr && !isEnsParam && !env.useMockApi },
  })

  const ensName = voter?.ensName ?? (isEnsParam ? rawParam : resolvedEnsName) ?? null

  // ENS text records — description + Twitter handle (the only social we surface)
  const description = useEnsTextRecord(ensName, 'description')
  const twitter = useEnsTextRecord(ensName, 'com.twitter')

  const [copied, setCopied] = useState(false)

  const handleCopyAddress = () => {
    if (!voter?.address) return
    navigator.clipboard.writeText(voter.address).then(
      () => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1500)
      },
      () => {
        // Clipboard unavailable; silently no-op
      },
    )
  }

  const handleShareOnTwitter = () => {
    if (!voter) return
    // Own profile → open the rich share modal (preview + pre-filled post).
    if (isOwnProfile) {
      setShareModalOpen(true)
      return
    }
    // Visitor sharing this delegate (third person). x.com (the twitter.com
    // intent has an Oct-2025 mobile login bug), no APR language, no dash
    // punctuation. The trailing colon leads into the appended profile URL.
    const handle = ensName ?? truncateAddress(voter.address)
    const text = `${handle} is an active voter on ENS governance. Delegate your ENS to them to keep the DAO strong. You earn rewards from the DAO for strengthening ENS:`
    const url = buildVoterShareUrl({ address: voter.address, ensName })
    const intent = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
    window.open(intent, '_blank', 'noopener,noreferrer')
  }

  if (loading || ensLoading) {
    return <DelegateProfileSkeleton />
  }

  if (error || !voter) {
    return (
      <Page>
        <BackLinkButton type="button" onClick={() => navigate('/voters')}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to all voters
        </BackLinkButton>
        <ErrorMessage>
          {error ?? 'Voter not found. They may not be an active voter in the incentives program.'}
        </ErrorMessage>
      </Page>
    )
  }

  const isDelegated =
    walletState.status === 'delegated' &&
    walletState.delegatedTo.toLowerCase() === voter.address.toLowerCase()

  const totalProposals = voter.last10ProposalsVoted.length || 10
  const votedCount = voter.last10ProposalsVoted.filter(Boolean).length
  const participationPct = totalProposals > 0
    ? Math.round((votedCount / totalProposals) * 100)
    : 0
  const isFullParticipation = participationPct >= 100

  const handleDelegate = () => {
    if (walletState.status === 'disconnected') {
      void openWalletModal()
      return
    }
    // Don't guess while the relayer verdict is still loading — defer and let
    // the routing effect (declared above) run once it resolves.
    if (eligibilityLoading) {
      setPendingDelegate(true)
      return
    }
    routeDelegate()
  }

  const proposalRows = buildProposalRows(voter.last10Proposals ?? [])

  const twitterUrl = twitter ? `https://twitter.com/${twitter.replace(/^@/, '')}` : null
  const ensProfileUrl = ensName
    ? `https://app.ens.domains/${ensName}`
    : `https://app.ens.domains/${voter.address}`
  const anticaptureUrl = getAnticaptureDelegateUrl(voter.address)

  const displayName = ensName ?? truncateAddress(voter.address)

  return (
    <>
    <Page>
      <HeaderCard>
        <BackLinkButton type="button" onClick={() => navigate('/voters')}>
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to all voters
        </BackLinkButton>
        <AvatarColumn>
          <ParticipationRing
            percent={participationPct}
            address={voter.address}
            name={ensName ?? undefined}
            avatarUrl={voter.avatarUrl}
          />
          <ParticipationTag $isFull={isFullParticipation}>
            {participationPct}% of participation
          </ParticipationTag>
        </AvatarColumn>
        <HeaderText>
          <TitleBlock>
            <NameRow>
              <NameTitle>{displayName}</NameTitle>
              <AddressTag
                type="button"
                $copied={copied}
                onClick={handleCopyAddress}
                aria-label={copied ? 'Address copied' : 'Copy address'}
                title={copied ? 'Copied!' : 'Click to copy'}
              >
                {copied ? (
                  <>
                    <CopyIcon><FontAwesomeIcon icon={faCheck} /></CopyIcon>
                    Copied!
                  </>
                ) : (
                  <>
                    {truncateAddress(voter.address)}
                    <CopyIcon><FontAwesomeIcon icon={faCopy} /></CopyIcon>
                  </>
                )}
              </AddressTag>
            </NameRow>
            {description && <Description>{description}</Description>}
          </TitleBlock>

          <SocialLinks>
            {twitterUrl && (
              <SocialChip href={twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                <SocialIcon><FontAwesomeIcon icon={faXTwitter} /></SocialIcon>
                @{twitter!.replace(/^@/, '')}
              </SocialChip>
            )}
            <SocialChip href={ensProfileUrl} target="_blank" rel="noopener noreferrer" aria-label="ENS profile">
              <SocialIcon><FontAwesomeIcon icon={faArrowUpRightFromSquare} /></SocialIcon>
              ENS profile
            </SocialChip>
            <SocialChip href={anticaptureUrl} target="_blank" rel="noopener noreferrer" aria-label="Anticapture profile">
              <SocialIcon><FontAwesomeIcon icon={faArrowUpRightFromSquare} /></SocialIcon>
              Anticapture profile
            </SocialChip>
          </SocialLinks>

          <CtaRow>
            {isDelegated ? (
              <DelegatedButton
                colorStyle="greenSecondary"
                width="auto"
                prefix={<FontAwesomeIcon icon={faCircleCheck} />}
                aria-disabled
              >
                Delegated
              </DelegatedButton>
            ) : (
              <Button colorStyle="bluePrimary" width="auto" onClick={handleDelegate}>
                Delegate now{showFreeBadge && <FreeBadge>Free</FreeBadge>}
              </Button>
            )}
            <Button
              colorStyle="blueSecondary"
              prefix={<FontAwesomeIcon icon={faXTwitter} />}
              onClick={handleShareOnTwitter}
              width="auto"
            >
              Share on X
            </Button>
          </CtaRow>
        </HeaderText>
      </HeaderCard>

      <StatsRow>
        <StatCard>
          <StatTopRow>
            <StatValue>{formatVotingPower(voter.votingPower)}</StatValue>
            <StatIconBox aria-hidden><FontAwesomeIcon icon={faBolt} /></StatIconBox>
          </StatTopRow>
          <StatLabel>Voting power</StatLabel>
        </StatCard>
        <StatCard>
          <StatTopRow>
            <StatValue>{voter.tokenHolderCount.toLocaleString('en-US')}</StatValue>
            <StatIconBox aria-hidden><FontAwesomeIcon icon={faUsers} /></StatIconBox>
          </StatTopRow>
          <StatLabel>Delegators</StatLabel>
        </StatCard>
        <StatCard>
          <StatTopRow>
            <StatValue>{votedCount}/{totalProposals}</StatValue>
            <StatIconBox aria-hidden><FontAwesomeIcon icon={faSquarePollVertical} /></StatIconBox>
          </StatTopRow>
          <StatLabel>Participation on last proposals</StatLabel>
        </StatCard>
        <StatCard>
          <StatTopRow>
            <StatValue>{formatActiveSinceShort(voter.activeSince)}</StatValue>
            <StatIconBox aria-hidden><FontAwesomeIcon icon={faClock} /></StatIconBox>
          </StatTopRow>
          <StatLabel>Active since</StatLabel>
        </StatCard>
      </StatsRow>

      <DelegateValuesCard delegateAddress={resolvedAddr} delegateName={ensName ?? undefined} />

      <VotingRecordSection>
        <SectionTitle>Voting record</SectionTitle>
        <TableCard>
        <TableHeadRow>
          <TableHeadCell>Proposal Name</TableHeadCell>
          <TableHeadCell $width="200px">
            <LabelWithTooltip
              text="How this delegate voted on each proposal - “For”, “Against”, “Abstain”, or didn’t vote."
              iconAriaLabel="About Delegate Vote"
            >
              Delegate Vote
            </LabelWithTooltip>
          </TableHeadCell>
          <TableHeadCell $width="200px">Result</TableHeadCell>
        </TableHeadRow>
        {proposalRows.map((row) => {
          const vote = describeVote(row.voterSupport)
          const result = describeResult(row.status)
          return (
            <TableRow
              key={row.id}
              href={row.anticaptureUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${row.title} on Anticapture`}
            >
              <TableCell $primary>{row.title}</TableCell>
              <TableCell $width="200px">
                <MobileLabel>Delegate Vote</MobileLabel>
                <CellValue>
                  <VoteIcon $tone={vote.tone}><FontAwesomeIcon icon={vote.icon} /></VoteIcon>
                  {vote.label}
                </CellValue>
              </TableCell>
              <TableCell $width="200px">
                <MobileLabel>Result</MobileLabel>
                <CellValue>
                  {result ? (
                    <>
                      <VoteIcon $tone={result.tone}><FontAwesomeIcon icon={result.icon} /></VoteIcon>
                      {result.label}
                    </>
                  ) : (
                    <LabelWithTooltip
                      text={`Proposal status: ${row.status || 'unknown'}`}
                      iconAriaLabel="Proposal outcome unavailable"
                    >
                      <span aria-label="Proposal outcome unavailable">—</span>
                    </LabelWithTooltip>
                  )}
                </CellValue>
              </TableCell>
            </TableRow>
          )
        })}
        </TableCard>
      </VotingRecordSection>
    </Page>
    {eligibilityModalOpen && eligibilityReason && (
      <DelegationEligibilityModal
        open
        reason={eligibilityReason}
        resetsAt={rateLimitResetsAt}
        onClose={() => setEligibilityModalOpen(false)}
        onDelegateAnyway={() => {
          setEligibilityModalOpen(false)
          setModalOpen(true)
        }}
      />
    )}
    {modalOpen && (
      <DelegationModal
        open
        onClose={() => setModalOpen(false)}
        delegateAddress={voter.address as `0x${string}`}
        delegateEnsName={ensName}
        delegateAvatarUrl={voter.avatarUrl}
        tokenAddress={contracts.ensToken}
      />
    )}
    <DelegateShareModal
      open={shareModalOpen}
      onClose={() => setShareModalOpen(false)}
      address={resolvedAddr}
      ensName={ensName}
    />
    </>
  )
}
