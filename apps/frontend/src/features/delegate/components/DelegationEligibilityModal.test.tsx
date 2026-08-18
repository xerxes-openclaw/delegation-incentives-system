import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { renderApp, userEvent } from '@/test/utils'
import { server } from '@/test/mocks/server'
import {
  DelegationEligibilityModal,
  formatResetCountdown,
} from './DelegationEligibilityModal'

// Thorin's Modal restores the page scroll position on unmount; jsdom doesn't
// implement window.scroll and logs a noisy "Not implemented" error.
beforeAll(() => {
  vi.stubGlobal('scroll', vi.fn())
})

function installRelayerConfig(minVotingPower: string) {
  server.use(
    http.get('/api/gateful/ens/relay/balance', () =>
      HttpResponse.json({ hasEnoughBalance: true }),
    ),
    http.get('/api/gateful/ens/relay/config', () =>
      HttpResponse.json({ minVotingPower, limits: { vote: 5, delegation: 5 } }),
    ),
  )
}

describe('DelegationEligibilityModal', () => {
  it('below-minimum: explains the sponsorship threshold from the relayer config', async () => {
    // Non-default threshold proves the copy interpolates the relayer's
    // dynamic minVotingPower instead of the hardcoded fallback.
    installRelayerConfig('50000000000000000000')

    renderApp(
      <DelegationEligibilityModal
        open
        reason="below-minimum"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    expect(
      screen.getByText('You need more ENS for free gas'),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(
        screen.getByText(/holding at least 50 ENS/),
      ).toBeInTheDocument()
    })
    // Gas-sponsorship only — copy must not tie rewards to the threshold.
    expect(
      screen.getByText(
        /Gas is the only difference and your rewards stay the same/i,
      ),
    ).toBeInTheDocument()
  })

  it('no-ens: uses the Figma copy for the 0-ENS state', () => {
    renderApp(
      <DelegationEligibilityModal
        open
        reason="no-ens"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    expect(screen.getByText('You need some ENS first')).toBeInTheDocument()
    expect(
      screen.getByText(/Your wallet holds 0 ENS, so gas is not sponsored/),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Your choice sticks and applies once you hold ENS/),
    ).toBeInTheDocument()
  })

  it('relayer-paused: explains the global pause and offers Maybe later / pay gas', async () => {
    const onClose = vi.fn()
    const onDelegateAnyway = vi.fn()
    const user = userEvent.setup()

    renderApp(
      <DelegationEligibilityModal
        open
        reason="relayer-paused"
        onClose={onClose}
        onDelegateAnyway={onDelegateAnyway}
      />,
    )

    expect(screen.getByText('Sponsored gas is paused')).toBeInTheDocument()
    expect(
      screen.getByText(/your rewards are unaffected/i),
    ).toBeInTheDocument()
    // No Buy ENS action in the paused state — pause isn't balance-gated.
    expect(
      screen.queryByRole('link', { name: 'Buy ENS' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Maybe later' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    )
    expect(onDelegateAnyway).toHaveBeenCalledTimes(1)
  })

  it('rate-limited: shows the relative reset countdown from the relayer and offers Maybe later / pay gas, no Buy ENS', async () => {
    const onClose = vi.fn()
    const onDelegateAnyway = vi.fn()
    const user = userEvent.setup()
    // ~6 days out — the copy must surface a relative "in N days", never the
    // raw timestamp and never minutes/seconds (the reset is a month boundary).
    const resetsAt = new Date(
      Date.now() + 6 * 24 * 60 * 60 * 1000 + 60_000,
    ).toISOString()

    renderApp(
      <DelegationEligibilityModal
        open
        reason="rate-limited"
        resetsAt={resetsAt}
        onClose={onClose}
        onDelegateAnyway={onDelegateAnyway}
      />,
    )

    expect(
      screen.getByText('No free delegations left this month'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Your free allowance resets in \d+ days and your rewards are unaffected/,
      ),
    ).toBeInTheDocument()
    // Buying ENS wouldn't lift a rate limit — no Buy ENS action here.
    expect(
      screen.queryByRole('link', { name: 'Buy ENS' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Maybe later' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    await user.click(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    )
    expect(onDelegateAnyway).toHaveBeenCalledTimes(1)
  })

  it('falls back to the default 100 ENS threshold when the relayer is unavailable', () => {
    server.use(
      http.get('/api/gateful/ens/relay/balance', () =>
        HttpResponse.json({ hasEnoughBalance: false }),
      ),
    )

    renderApp(
      <DelegationEligibilityModal
        open
        reason="below-minimum"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    expect(screen.getByText(/holding at least 100 ENS/)).toBeInTheDocument()
  })

  it('below-minimum: offers Maybe later / pay gas and no buy-ENS or Uniswap path', () => {
    renderApp(
      <DelegationEligibilityModal
        open
        reason="below-minimum"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Maybe later' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Buy ENS' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /uniswap/i }),
    ).not.toBeInTheDocument()
  })

  it('stacks Maybe later above Delegate and pay gas', () => {
    renderApp(
      <DelegationEligibilityModal
        open
        reason="no-ens"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    const maybeLater = screen.getByRole('button', { name: 'Maybe later' })
    const payGas = screen.getByRole('button', {
      name: 'Delegate and pay gas',
    })
    expect(
      maybeLater.compareDocumentPosition(payGas) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('"Delegate and pay gas" hands off to the regular delegation flow', async () => {
    const onDelegateAnyway = vi.fn()
    const user = userEvent.setup()

    renderApp(
      <DelegationEligibilityModal
        open
        reason="no-ens"
        onClose={() => {}}
        onDelegateAnyway={onDelegateAnyway}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Delegate and pay gas' }),
    )
    expect(onDelegateAnyway).toHaveBeenCalledTimes(1)
  })

  it('close icon dismisses the modal', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()

    renderApp(
      <DelegationEligibilityModal
        open
        reason="below-minimum"
        onClose={onClose}
        onDelegateAnyway={() => {}}
      />,
    )

    await user.click(screen.getByTestId('close-icon'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders nothing when closed', () => {
    renderApp(
      <DelegationEligibilityModal
        open={false}
        reason="below-minimum"
        onClose={() => {}}
        onDelegateAnyway={() => {}}
      />,
    )

    expect(
      screen.queryByText('You need more ENS for free gas'),
    ).not.toBeInTheDocument()
  })
})

describe('formatResetCountdown', () => {
  // Pin "now" so the day math is deterministic.
  const NOW = new Date('2026-06-25T12:00:00.000Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders whole days remaining (rounding up partial days)', () => {
    // Next UTC month start, ~5.5 days out → rounds up to 6.
    expect(formatResetCountdown('2026-07-01T00:00:00.000Z')).toBe('in 6 days')
  })

  it('says "tomorrow" when under a day remains', () => {
    expect(formatResetCountdown('2026-06-26T06:00:00.000Z')).toBe('tomorrow')
  })

  it('falls back to "next month" when the timestamp is missing or invalid', () => {
    expect(formatResetCountdown(null)).toBe('next month')
    expect(formatResetCountdown(undefined)).toBe('next month')
    expect(formatResetCountdown('not-a-date')).toBe('next month')
  })

  it('says "soon" when the reset moment has already passed', () => {
    expect(formatResetCountdown('2026-06-25T11:00:00.000Z')).toBe('soon')
  })
})
