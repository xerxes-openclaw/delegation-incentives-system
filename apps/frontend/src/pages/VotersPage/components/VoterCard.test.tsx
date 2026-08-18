import { afterEach, beforeAll, beforeEach, vi } from 'vitest'

// These cases exercise gasless delegation, so the feature flag is forced on.
// Production defaults it off (see VITE_ENABLE_GASLESS in config/env.schema.ts).
vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: '/api',
    useMockApi: false,
    reownProjectId: 'test',
    enableGasless: true,
  },
}))

import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useReadContract } from 'wagmi'
import { renderApp, userEvent } from '@/test/utils'
import { server } from '@/test/mocks/server'
import { readContractResult } from '@/test/mocks/wagmi'
import { openWalletModal } from '@/features/wallet/openWalletModal'
import { VoterCard } from './VoterCard'
import type { VoterDetail } from '@/api/types'

// Real implementation lazy-imports the AppKit provider, which can't boot in
// jsdom — the trigger tests only assert that the connect modal is requested.
vi.mock('@/features/wallet/openWalletModal', () => ({
  openWalletModal: vi.fn().mockResolvedValue(undefined),
}))

const fullVoter: VoterDetail = {
  address: '0x1234567890abcdef1234567890abcdef12345678',
  ensName: 'alice.eth',
  avatarUrl: null,
  votingPower: '42000000000000000000000',
  votesInLast10: 9,
  tokenHolderCount: 128,
  activeSince: '2024-01-15T00:00:00Z',
  last10ProposalsVoted: [true, true, true, true, true, true, true, true, true, false],
  last10Proposals: [],
  words: null,
  match: null,
}

const minimalVoter: VoterDetail = {
  address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  ensName: null,
  avatarUrl: null,
  votingPower: '0',
  votesInLast10: 7,
  tokenHolderCount: 0,
  activeSince: null,
  last10ProposalsVoted: [true, true, true, true, true, true, true, false, false, false],
  last10Proposals: [],
  words: null,
  match: null,
}

describe('VoterCard', () => {
  it('renders ENS name', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.getByText('alice.eth')).toBeInTheDocument()
  })

  it('does not render the truncated address (it lives on the profile page)', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.queryByText('0x1234…5678')).not.toBeInTheDocument()
  })

  it('renders voting power formatted compactly', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.getByText('42K')).toBeInTheDocument()
    expect(screen.getByText('Voting Power')).toBeInTheDocument()
  })

  it('renders the Match stat instead of Delegators', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.getByText('Match')).toBeInTheDocument()
    expect(screen.queryByText('Delegators')).not.toBeInTheDocument()
  })

  it('renders proposal score', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.getByText('9/10')).toBeInTheDocument()
  })

  it('renders the shortened "Delegate" button when not delegated', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    expect(screen.getByRole('button', { name: 'Delegate' })).toBeInTheDocument()
  })

  it('still renders Voting Power when activeSince is null', () => {
    renderApp(<VoterCard voter={minimalVoter} />)
    expect(screen.getByText('Voting Power')).toBeInTheDocument()
    expect(screen.queryByText('Delegators')).not.toBeInTheDocument()
  })

  it('renders a visible View profile link to the voter profile', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    const link = screen.getByRole('link', { name: 'View profile' })
    expect(link).toHaveAttribute('href', '/voters/alice.eth')
  })

  it('falls back to the address in the profile link when no ENS name resolves', () => {
    renderApp(<VoterCard voter={minimalVoter} />)
    const link = screen.getByRole('link', { name: 'View profile' })
    expect(link).toHaveAttribute('href', `/voters/${minimalVoter.address}`)
  })

  it('keeps the whole-card overlay link to the voter profile', () => {
    renderApp(<VoterCard voter={fullVoter} />)
    const overlay = screen.getByRole('link', { name: 'View profile for alice.eth' })
    expect(overlay).toHaveAttribute('href', '/voters/alice.eth')
  })
})

// The "Free" pill on the Delegate button (Figma node 5899-6899 — present on
// every voter-card variant). It is variant-independent and gated only on the
// relayer actually having gas to sponsor, so it disappears when sponsorship is
// down rather than advertising a "free" delegation that wouldn't be free.
describe('VoterCard "Free" badge', () => {
  afterEach(() => {
    // Restore the default relayer-balance handler (hasEnoughBalance: true) so a
    // per-test override doesn't leak into the rest of the file.
    server.use(
      http.get('/api/gateful/ens/relay/balance', () =>
        HttpResponse.json({ hasEnoughBalance: true }),
      ),
    )
  })

  it('shows the Free pill on the Delegate button when the relayer has gas', async () => {
    renderApp(<VoterCard voter={fullVoter} />)
    // Balance query is async (null until it resolves), so wait for the pill.
    expect(await screen.findByText('Free')).toBeInTheDocument()
    // The pill is decorative — the button's accessible name stays "Delegate".
    expect(screen.getByRole('button', { name: 'Delegate' })).toBeInTheDocument()
  })

  it('hides the Free pill when sponsored gas is unavailable (relayer paused)', async () => {
    server.use(
      http.get('/api/gateful/ens/relay/balance', () =>
        HttpResponse.json({ hasEnoughBalance: false }),
      ),
    )
    renderApp(<VoterCard voter={fullVoter} />)
    // The button is still there; "Free" must never appear.
    expect(
      await screen.findByRole('button', { name: 'Delegate' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
  })
})

describe('VoterCard delegate trigger', () => {
  const CONNECTED_WALLET =
    '0x9999999999999999999999999999999999999999' as `0x${string}`
  const useReadContractMock = vi.mocked(useReadContract)
  const openWalletModalMock = vi.mocked(openWalletModal)

  // Per-state titles from the Figma frames ("Delegation modal — not free").
  const NO_ENS_TITLE = 'You need some ENS first'
  const BELOW_MINIMUM_TITLE = 'You need more ENS for free gas'
  const RELAYER_PAUSED_TITLE = 'Sponsored gas is paused'
  const ELIGIBILITY_TITLES = [
    NO_ENS_TITLE,
    BELOW_MINIMUM_TITLE,
    RELAYER_PAUSED_TITLE,
  ]
  const DELEGATION_TITLE = 'Delegate voting power'

  const expectNoEligibilityModal = () => {
    for (const title of ELIGIBILITY_TITLES) {
      expect(screen.queryByText(title)).not.toBeInTheDocument()
    }
  }

  // Thorin's Modal restores the page scroll position on unmount; jsdom does
  // not implement window.scroll and logs a noisy "Not implemented" error.
  beforeAll(() => {
    vi.stubGlobal('scroll', vi.fn())
  })

  beforeEach(() => {
    openWalletModalMock.mockClear()
    useReadContractMock.mockReset()
    useReadContractMock.mockReturnValue(readContractResult())
  })

  afterEach(() => {
    // Restore the global wagmi mock default so other suites in this file
    // aren't affected by per-test balance overrides.
    useReadContractMock.mockReset()
    useReadContractMock.mockReturnValue(readContractResult())
  })

  it('disconnected: opens the wallet-connect modal instead of any dialog', async () => {
    const user = userEvent.setup()
    renderApp(<VoterCard voter={fullVoter} />)

    await user.click(screen.getByRole('button', { name: 'Delegate' }))

    expect(openWalletModalMock).toHaveBeenCalledTimes(1)
    expectNoEligibilityModal()
    expect(screen.queryByText(DELEGATION_TITLE)).not.toBeInTheDocument()
  })

  it('connected with 0 ENS: shows the eligibility modal, not the delegation modal', async () => {
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }))
    const user = userEvent.setup()

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    await user.click(screen.getByRole('button', { name: 'Delegate' }))

    expect(await screen.findByText(NO_ENS_TITLE)).toBeInTheDocument()
    expect(screen.queryByText(DELEGATION_TITLE)).not.toBeInTheDocument()
    expect(openWalletModalMock).not.toHaveBeenCalled()
  })

  it('connected below the threshold: "Delegate and pay gas" hands off to the delegation modal', async () => {
    // Pin the relayer threshold above the wallet balance — the shared mock
    // default is 1 ENS, which would make a 5 ENS wallet eligible.
    server.use(
      http.get('/api/gateful/ens/relay/config', () =>
        HttpResponse.json({
          minVotingPower: '100000000000000000000',
          limits: { vote: 5, delegation: 5 },
        }),
      ),
    )
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 5n * 10n ** 18n }),
    )
    const user = userEvent.setup()

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    await user.click(screen.getByRole('button', { name: 'Delegate' }))
    expect(await screen.findByText(BELOW_MINIMUM_TITLE)).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    )

    expect(screen.queryByText(BELOW_MINIMUM_TITLE)).not.toBeInTheDocument()
    expect(screen.getByText(DELEGATION_TITLE)).toBeInTheDocument()
  })

  it('relayer paused: the global pause wins over the balance-gated states', async () => {
    server.use(
      http.get('/api/gateful/ens/relay/balance', () =>
        HttpResponse.json({ hasEnoughBalance: false }),
      ),
    )
    // 0-ENS wallet — the eligibility modal opens on click no matter when the
    // relayer balance query resolves, then settles on the paused state once
    // it does (paused is global, so it beats no-ens).
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }))
    const user = userEvent.setup()

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    await user.click(screen.getByRole('button', { name: 'Delegate' }))
    await screen.findByText(RELAYER_PAUSED_TITLE)
    expect(screen.queryByText(DELEGATION_TITLE)).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    )

    expect(screen.queryByText(RELAYER_PAUSED_TITLE)).not.toBeInTheDocument()
    expect(screen.getByText(DELEGATION_TITLE)).toBeInTheDocument()
  })

  it('connected above the threshold: goes straight to the delegation modal', async () => {
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 200n * 10n ** 18n }),
    )
    const user = userEvent.setup()

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    await user.click(screen.getByRole('button', { name: 'Delegate' }))

    expectNoEligibilityModal()
    expect(screen.getByText(DELEGATION_TITLE)).toBeInTheDocument()
  })

  it('minVotingPower 0 + 0-ENS wallet: sponsored, so it skips the eligibility modal', async () => {
    // Regression: the front used to hardcode "0 ENS → not sponsored". When the
    // relayer publishes minVotingPower 0, a 0-ENS wallet is eligible and the
    // Free pill shows — clicking Delegate goes straight to the delegation flow.
    server.use(
      http.get('/api/gateful/ens/relay/config', () =>
        HttpResponse.json({
          minVotingPower: '0',
          limits: { vote: 5, delegation: 5 },
        }),
      ),
    )
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }))
    const user = userEvent.setup()

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    expect(await screen.findByText('Free')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delegate' }))

    expectNoEligibilityModal()
    expect(screen.getByText(DELEGATION_TITLE)).toBeInTheDocument()
  })

  it('connected but ineligible: hides the Free pill (badge mirrors the verdict)', async () => {
    // Default mock minVotingPower is 1 ENS; a 0-ENS wallet is below it.
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }))

    renderApp(<VoterCard voter={fullVoter} />, {
      walletState: { status: 'connected', address: CONNECTED_WALLET },
    })

    expect(
      await screen.findByRole('button', { name: 'Delegate' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Free')).not.toBeInTheDocument()
  })
})
