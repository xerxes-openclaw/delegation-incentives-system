import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styled, { keyframes } from 'styled-components'
import { formatUnits } from 'viem'
import { mainnet } from 'viem/chains'
import { useAccount, useEnsName, useReadContract, useWalletClient } from 'wagmi'

import { AddressIdentity } from '@/components/shared/AddressIdentity'
import { tokens } from '@/styles'
import { formatEnsAmount } from '@/utils/format'
import { api } from '@/api'
import { useAsync } from '@/hooks/useAsync'
import { ShareCardBlock } from './ShareCardBlock'
import { buildHolderShareUrl, buildVoterOgImageUrl } from '../utils/shareCard'

import {
  useGaslessEligibility,
  useRelayerConfig,
} from '../hooks/useGaslessRelayer'
import { delegateTo } from '../utils/delegateTo'
import {
  isRelayerError,
  isUserRejection,
  mapRelayerError,
} from '../utils/gaslessRelayerError'

const ERC20VotesAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'getVotes',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

type DelegationStep = 'waiting-signature' | 'pending-tx' | 'success' | 'error'

/**
 * Pre-filled X copy for a holder who just delegated (first person). Compliant:
 * no APR / yield / price; "free, gasless", "tokens never leave my wallet",
 * "rewards from the DAO". The trailing colon leads into the appended share URL.
 */
export const HOLDER_TWEET_TEXT =
  "I just delegated my ENS to keep governance active. It's free, gasless, and my tokens never leave my wallet. Delegate yours and earn rewards from the DAO for strengthening ENS:"

export interface DelegationModalProps {
  open: boolean
  onClose: () => void
  delegateAddress: `0x${string}`
  delegateEnsName?: string | null
  delegateAvatarUrl?: string | null
  tokenAddress: `0x${string}`
  onSuccess?: () => void
}

export function DelegationModal({
  open,
  onClose,
  delegateAddress,
  delegateEnsName,
  delegateAvatarUrl,
  tokenAddress,
  onSuccess,
}: DelegationModalProps) {
  const titleId = useId()
  const { address } = useAccount()
  const { data: holderEnsName } = useEnsName({ address, chainId: mainnet.id })
  const { data: walletClient } = useWalletClient({ chainId: 1 })
  const fetchTiers = useCallback(() => api.tierProgression(), [])
  const tiersAsync = useAsync(fetchTiers)
  const currentTierEntry = tiersAsync.data?.tiers.find((t) => t.isCurrent) ?? tiersAsync.data?.tiers[0]
  const currentApyLabel = currentTierEntry ? `~${Number(currentTierEntry.estimatedAprPct).toFixed(1)}%` : '~6.9%'
  const ceilingApy = tiersAsync.data ? Math.floor(Number(tiersAsync.data.maxTokenHolderAprPct)) : 14
  const holderTweetText = `I delegated my $ENS to @GriffGreen and am getting ${currentApyLabel} APY. If you delegate to him too, we can both get over ${ceilingApy}% APY. Check it out:`

  const [step, setStep] = useState<DelegationStep>('waiting-signature')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [mounted, setMounted] = useState(false)
  const inFlightRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  const { minVotingPower } = useRelayerConfig()
  const {
    isEligible: isGaslessEligible,
    remaining: delegationRemaining,
    isLoading: isEligibilityLoading,
  } = useGaslessEligibility(address)

  const { data: votingPowerRaw } = useReadContract({
    abi: ERC20VotesAbi,
    address: tokenAddress,
    functionName: 'getVotes',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const votingPowerLabel =
    votingPowerRaw !== undefined
      ? `${formatEnsAmount(Number(formatUnits(votingPowerRaw, 18)))} ENS`
      : '—'

  const handleDelegate = useCallback(async () => {
    if (!address || !walletClient || !tokenAddress) return
    if (step === 'pending-tx' || step === 'success') return
    if (inFlightRef.current) return
    inFlightRef.current = true

    setError(null)
    setStep('waiting-signature')

    try {
      try {
        await delegateTo({
          tokenAddress,
          delegateAddress,
          account: address,
          walletClient,
          chain: mainnet,
          mode: isGaslessEligible ? 'gasless' : 'fallback',
          onTxHash: (hash) => {
            setTxHash(hash)
            setStep('pending-tx')
          },
        })
        setStep('success')
        onSuccess?.()
      } catch (err) {
        if (isUserRejection(err)) {
          setError('Transaction rejected by user.')
          setStep('error')
          return
        }
        if (isGaslessEligible && isRelayerError(err)) {
          const message = mapRelayerError(err, {
            minVotingPower,
            decimals: 18,
            symbol: 'ENS',
          })
          setError(message)
        } else {
          setError(err instanceof Error ? err.message : 'Delegation failed.')
        }
        setStep('error')
      }
    } finally {
      inFlightRef.current = false
    }
  }, [
    address,
    walletClient,
    tokenAddress,
    step,
    delegateAddress,
    onSuccess,
    minVotingPower,
    isGaslessEligible,
  ])

  useEffect(() => {
    if (!open || !walletClient || step !== 'waiting-signature') return
    if (isEligibilityLoading) return
    if (inFlightRef.current) return
    void handleDelegate()
  }, [open, walletClient, handleDelegate, step, isEligibilityLoading])

  const handleClose = useCallback(() => {
    setStep('waiting-signature')
    setError(null)
    setTxHash(null)
    inFlightRef.current = false
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, handleClose])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open || !mounted) return
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    dialogRef.current?.focus()
    return () => {
      previousFocusRef.current?.focus()
    }
  }, [open, mounted])

  // The holder (whoever just delegated) is the connected wallet. Their card +
  // share URL identify them, preferring their ENS name when it resolves.
  const holderShareUrl = buildHolderShareUrl({ address: address ?? '', ensName: holderEnsName })
  const holderOgImageUrl = buildVoterOgImageUrl({
    address: address ?? '',
    ensName: holderEnsName,
    variant: 'holder',
  })

  // Pre-warm the holder share URL so the OG card is cached before the X crawler
  // fetches it. (The preview <img> in the success state also warms the image
  // render itself.)
  useEffect(() => {
    if (step !== 'success' || !address) return
    void fetch(holderShareUrl).catch(() => {})
  }, [step, address, holderShareUrl])

  if (!open || !mounted) return null

  const step1Done =
    step === 'pending-tx' || step === 'success' ||
    (step === 'error' && txHash !== null)
  const step1Active = step === 'waiting-signature'
  const step2Done = step === 'success'
  const step2Active = step === 'pending-tx'

  const isErrorState = step === 'error'
  const isSuccessState = step === 'success'

  const dialog = (
    <Backdrop role="presentation" onClick={handleClose}>
      <Dialog
        ref={dialogRef}
        $success={isSuccessState}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isSuccessState ? 'Your ENS is now delegated' : undefined}
        aria-labelledby={isSuccessState ? undefined : titleId}
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccessState ? (
          <>
            <CloseRow>
              <IconCloseButton
                type="button"
                aria-label="Close"
                onClick={handleClose}
              >
                <XIcon />
              </IconCloseButton>
            </CloseRow>
            <ShareCardBlock
              title="Your ENS is now delegated"
              body="Share your card to bring more ENS into active governance."
              tweetText={holderTweetText}
              shareUrl={holderShareUrl}
              ogImageUrl={holderOgImageUrl}
            />
            {txHash && (
              <TxLink
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View transaction on Etherscan
              </TxLink>
            )}
          </>
        ) : (
          <>
            <TitleBar>
              <Title id={titleId}>Delegate voting power</Title>
              <CloseButton
                type="button"
                aria-label="Close"
                onClick={handleClose}
              >
                ×
              </CloseButton>
            </TitleBar>

            <Context>
              <Row>
                <Label>Your voting power</Label>
                <Value>{votingPowerLabel}</Value>
              </Row>
              <Row>
                <Label>Delegating to</Label>
                <IdentityWrap>
                  <AddressIdentity
                    address={delegateAddress}
                    ensName={delegateEnsName ?? undefined}
                    avatarUrl={delegateAvatarUrl ?? undefined}
                    showAvatar
                    avatarSize={20}
                    size="sm"
                    secondaryAddress="never"
                  />
                </IdentityWrap>
              </Row>
              {isGaslessEligible && delegationRemaining !== null && (
                <FreeAlert>
                  {delegationRemaining === 1
                    ? 'This delegation is free! Last one this month - your free allowance resets next month.'
                    : `This delegation is free! You'll still have ${delegationRemaining - 1} left to use this month.`}
                </FreeAlert>
              )}
            </Context>

            <Stepper>
              <StepRow
                done={step1Done}
                active={step1Active}
                label="Confirm your delegation in your wallet"
                error={isErrorState && !step1Done ? error : undefined}
              />
              <Connector />
              <StepRow
                done={step2Done}
                active={step2Active}
                label="Wait for the delegation to complete"
                error={isErrorState && step1Done ? error : undefined}
              />
            </Stepper>

            {isErrorState && (
              <Actions>
                <PrimaryButton type="button" onClick={handleDelegate}>
                  Retry
                </PrimaryButton>
                <SecondaryButton type="button" onClick={handleClose}>
                  Close
                </SecondaryButton>
              </Actions>
            )}
          </>
        )}
      </Dialog>
    </Backdrop>
  )

  if (typeof document === 'undefined') return null
  return createPortal(dialog, document.body)
}

interface StepRowProps {
  done: boolean
  active: boolean
  label: string
  error?: string | null
}

function StepRow({ done, active, label, error }: StepRowProps) {
  return (
    <StepRowWrap>
      <StepRowMain>
        <IconSlot>
          {active && <Spinner aria-hidden="true" />}
          <Bubble $done={done} $active={active}>
            {done ? <CheckIcon /> : <DotIcon />}
          </Bubble>
        </IconSlot>
        <StepLabel>{label}</StepLabel>
      </StepRowMain>
      {error && <StepError>{error}</StepError>}
    </StepRowWrap>
  )
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label="done"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function DotIcon() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6" aria-hidden="true">
      <circle cx="3" cy="3" r="3" fill="currentColor" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  )
}

const spin = keyframes`
  to { transform: rotate(360deg); }
`

const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(1, 26, 37, 0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${tokens.spacing.lg};
`

const Dialog = styled.div<{ $success?: boolean }>`
  background: ${tokens.color.surface};
  /* Success/share step: wider card, hairline border + subtle drop, tighter
     padding and a 20px radius. Other steps keep the original chrome. */
  box-shadow: ${({ $success }) =>
    $success ? tokens.shadow.sm : tokens.shadow.lg};
  border: ${({ $success }) =>
    $success ? `1px solid ${tokens.color.border}` : 'none'};
  border-radius: ${({ $success }) => ($success ? '20px' : tokens.radius.lg)};
  max-width: ${({ $success }) => ($success ? tokens.maxWidth.md : '480px')};
  width: 100%;
  padding: ${({ $success }) =>
    $success ? tokens.spacing.lg : tokens.spacing['2xl']};
  display: flex;
  flex-direction: column;
  gap: ${({ $success }) => ($success ? tokens.spacing.xl : tokens.spacing.lg)};

  &:focus {
    outline: none;
  }
`

const TitleBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.spacing.md};
`

const Title = styled.h2`
  margin: 0;
  font-size: ${tokens.font.size.xl};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
`

const CloseButton = styled.button`
  background: transparent;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: ${tokens.color.textMuted};
  cursor: pointer;
  padding: 4px 8px;
  border-radius: ${tokens.radius.sm};
  transition: background ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.bgSubtle};
    color: ${tokens.color.darkBlue};
  }
`

// Circular icon close button for the success/share step: 28px, white, hairline
// border, centered X. The plain-glyph CloseButton stays on the other steps.
const IconCloseButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: ${tokens.color.surface};
  border: 1px solid ${tokens.color.border};
  border-radius: ${tokens.radius.pill};
  color: ${tokens.color.textSecondary};
  cursor: pointer;
  transition: background ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.bgSubtle};
  }
`

const Context = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.sm};
`

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: ${tokens.spacing.md};
`

const Label = styled.span`
  width: 128px;
  flex-shrink: 0;
  color: ${tokens.color.textMuted};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.medium};
`

const Value = styled.span`
  color: ${tokens.color.darkBlue};
  font-size: ${tokens.font.size.base};
`

const IdentityWrap = styled.div`
  display: flex;
  min-width: 0;
  flex: 1;
`

const FreeAlert = styled.div`
  margin-top: ${tokens.spacing.xs};
  background: ${tokens.color.tierHighlight};
  color: ${tokens.color.positiveEmphasis};
  padding: ${tokens.spacing.sm} ${tokens.spacing.md};
  border-radius: ${tokens.radius.sm};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.medium};
`

const Stepper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.xs};
  border: 1px solid ${tokens.color.border};
  border-radius: ${tokens.radius.md};
  padding: ${tokens.spacing.md};
`

const Connector = styled.div`
  width: 2px;
  height: 16px;
  background: ${tokens.color.border};
  margin-left: 15px;
`

const StepRowWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.xs};
`

const StepRowMain = styled.div`
  display: flex;
  align-items: center;
  gap: ${tokens.spacing.md};
`

const IconSlot = styled.div`
  position: relative;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`

const Bubble = styled.div<{ $done: boolean; $active: boolean }>`
  width: 24px;
  height: 24px;
  border-radius: ${tokens.radius.pill};
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${({ $done, $active }) => {
    if ($done) return tokens.color.lightGreen
    if ($active) return tokens.color.darkBlue
    return tokens.color.border
  }};
  color: ${({ $done, $active }) => {
    if ($done) return tokens.color.positiveEmphasis
    if ($active) return tokens.color.white
    return tokens.color.textMuted
  }};
`

const Spinner = styled.div`
  position: absolute;
  inset: 0;
  border-radius: ${tokens.radius.pill};
  border: 2px solid transparent;
  border-top-color: ${tokens.color.blue};
  animation: ${spin} 0.9s linear infinite;
`

const StepLabel = styled.span`
  color: ${tokens.color.darkBlue};
  font-size: ${tokens.font.size.base};
`

const StepError = styled.p`
  margin: 0;
  margin-left: 44px;
  color: ${tokens.color.negative};
  font-size: ${tokens.font.size.sm};
`

const CloseRow = styled.div`
  display: flex;
  justify-content: flex-end;
  width: 100%;
`

const TxLink = styled.a`
  align-self: center;
  font-size: ${tokens.font.size.sm};
  color: ${tokens.color.accent};
  text-decoration: underline;
  word-break: break-all;
`

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tokens.spacing.sm};
`

const PrimaryButton = styled.button`
  background: ${tokens.color.blue};
  color: ${tokens.color.white};
  border: none;
  border-radius: ${tokens.radius.md};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.semibold};
  padding: ${tokens.spacing.sm} ${tokens.spacing.lg};
  cursor: pointer;
  transition: background ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.accent};
  }
`

const SecondaryButton = styled.button`
  background: transparent;
  color: ${tokens.color.darkBlue};
  border: 1px solid ${tokens.color.border};
  border-radius: ${tokens.radius.md};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.semibold};
  padding: ${tokens.spacing.sm} ${tokens.spacing.lg};
  cursor: pointer;
  transition: background ${tokens.transition.fast};

  &:hover {
    background: ${tokens.color.bgSubtle};
  }
`
