import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

import { screen, waitFor, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useAccount, useReadContract, useWalletClient } from 'wagmi'
import type { WalletClient } from 'viem'

import { renderApp } from '@/test/utils'
import { server } from '@/test/mocks/server'
import {
  readContractResult,
  walletClientResult,
} from '@/test/mocks/wagmi'
import { DelegationModal } from './DelegationModal'

const USER_ADDRESS =
  '0x1111111111111111111111111111111111111111' as `0x${string}`
const DELEGATEE_ADDRESS =
  '0x2222222222222222222222222222222222222222' as `0x${string}`
const ENS_TOKEN_ADDRESS =
  '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72' as `0x${string}`
const RELAY_TX_HASH =
  '0xabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabcabca' as `0x${string}`
const SIGNATURE_WITH_V =
  ('0x' +
    '11'.repeat(32) +
    '22'.repeat(32) +
    '1c') as `0x${string}`

const useAccountMock = vi.mocked(useAccount)
const useReadContractMock = vi.mocked(useReadContract)
const useWalletClientMock = vi.mocked(useWalletClient)

interface SimpleWalletClient {
  readContract: ReturnType<typeof vi.fn>
  signTypedData: ReturnType<typeof vi.fn>
  simulateContract: ReturnType<typeof vi.fn>
  writeContract: ReturnType<typeof vi.fn>
  waitForTransactionReceipt: ReturnType<typeof vi.fn>
}

function buildWalletFake(): {
  client: SimpleWalletClient
  asWalletClient: WalletClient
} {
  const readContract = vi.fn()
  const signTypedData = vi.fn()
  const simulateContract = vi.fn()
  const writeContract = vi.fn()
  const waitForTransactionReceipt = vi.fn()

  const base = {
    readContract,
    signTypedData,
    simulateContract,
    writeContract,
    waitForTransactionReceipt,
    extend() {
      return base
    },
  }

  return {
    client: {
      readContract,
      signTypedData,
      simulateContract,
      writeContract,
      waitForTransactionReceipt,
    },
    asWalletClient: base as unknown as WalletClient,
  }
}

interface RelayerHandlerState {
  balanceCalls: number
  configCalls: number
  rateLimitCalls: number
  relayCalls: number
  balance: { hasEnoughBalance: boolean }
  config: {
    minVotingPower: string
    limits: { vote: number; delegation: number }
  }
  rateLimit: {
    delegation: { used: number; remaining: number; limit: number }
    vote: { used: number; remaining: number; limit: number }
    resetsAt: string
  }
  relayResponse: (() => Response) | null
}

function freshState(): RelayerHandlerState {
  return {
    balanceCalls: 0,
    configCalls: 0,
    rateLimitCalls: 0,
    relayCalls: 0,
    balance: { hasEnoughBalance: true },
    config: {
      minVotingPower: '100000000000000000000',
      limits: { vote: 5, delegation: 5 },
    },
    rateLimit: {
      delegation: { used: 0, remaining: 5, limit: 5 },
      vote: { used: 0, remaining: 5, limit: 5 },
      resetsAt: '2026-05-20T00:00:00Z',
    },
    relayResponse: () =>
      HttpResponse.json({ transactionHash: RELAY_TX_HASH }),
  }
}

function installRelayerHandlers(state: RelayerHandlerState) {
  server.use(
    http.get('/api/gateful/ens/relay/balance', () => {
      state.balanceCalls += 1
      return HttpResponse.json(state.balance)
    }),
    http.get('/api/gateful/ens/relay/config', () => {
      state.configCalls += 1
      return HttpResponse.json(state.config)
    }),
    http.get('/api/gateful/ens/relay/rate-limit/:address', () => {
      state.rateLimitCalls += 1
      return HttpResponse.json(state.rateLimit)
    }),
    http.post('/api/gateful/ens/relay/delegate', () => {
      state.relayCalls += 1
      if (!state.relayResponse) {
        return HttpResponse.json({ transactionHash: RELAY_TX_HASH })
      }
      return state.relayResponse()
    }),
    // The success state pre-warms the holder share URL (fire-and-forget).
    http.get('/share/holder/:address', () => new HttpResponse(null, { status: 200 })),
  )
}

interface VisibleState {
  step1Done: boolean
  step2Done: boolean
  errorVisible: boolean
  successVisible: boolean
}

function collectVisibleState(): VisibleState {
  const step1Row = screen
    .getByText('Confirm your delegation in your wallet')
    .closest('div')
  const step2Row = screen
    .getByText('Wait for the delegation to complete')
    .closest('div')

  const step1Done =
    step1Row != null && within(step1Row).queryByLabelText('done') !== null
  const step2Done =
    step2Row != null && within(step2Row).queryByLabelText('done') !== null

  const errorVisible =
    screen.queryByRole('button', { name: /^retry$/i }) !== null
  const successVisible =
    screen.queryByRole('link', {
      name: /View transaction on Etherscan/i,
    }) !== null

  return { step1Done, step2Done, errorVisible, successVisible }
}

describe('DelegationModal', () => {
  let state: RelayerHandlerState

  beforeEach(() => {
    state = freshState()
    installRelayerHandlers(state)
    useAccountMock.mockReturnValue({
      address: USER_ADDRESS,
      isConnected: true,
    } as ReturnType<typeof useAccount>)
    useReadContractMock.mockReset()
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 1000n * 10n ** 18n }),
    )
    useWalletClientMock.mockReturnValue(walletClientResult())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('eligible + relayer 200: completes into the post-delegation share state', async () => {
    const { client, asWalletClient } = buildWalletFake()
    client.readContract.mockImplementation(({ functionName }) => {
      if (functionName === 'name') return Promise.resolve('ENS')
      if (functionName === 'nonces') return Promise.resolve(42n)
      throw new Error(`unexpected readContract ${functionName}`)
    })
    client.signTypedData.mockResolvedValue(SIGNATURE_WITH_V)
    client.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: RELAY_TX_HASH,
      status: 'success',
    })
    useWalletClientMock.mockReturnValue(
      walletClientResult({ data: asWalletClient }),
    )

    renderApp(
      <DelegationModal
        open
        onClose={() => {}}
        delegateAddress={DELEGATEE_ADDRESS}
        tokenAddress={ENS_TOKEN_ADDRESS}
      />,
    )

    // On success the stepper is replaced by the holder share card.
    await waitFor(() => {
      expect(screen.getByText('Your ENS is now delegated')).toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: /share on x/i }),
    ).toBeInTheDocument()

    const txLink = screen.getByRole('link', {
      name: /View transaction on Etherscan/i,
    })
    expect(txLink).toHaveAttribute(
      'href',
      `https://etherscan.io/tx/${RELAY_TX_HASH}`,
    )
    // Relayer was used → the gasless (free) path.
    expect(state.relayCalls).toBe(1)
  })

  it('user rejection: shows rejection error copy, relay not called', async () => {
    const { client, asWalletClient } = buildWalletFake()
    client.readContract.mockImplementation(({ functionName }) => {
      if (functionName === 'name') return Promise.resolve('ENS')
      if (functionName === 'nonces') return Promise.resolve(42n)
      throw new Error(`unexpected readContract ${functionName}`)
    })
    client.signTypedData.mockRejectedValue(
      new Error('User rejected the request.'),
    )
    useWalletClientMock.mockReturnValue(
      walletClientResult({ data: asWalletClient }),
    )

    renderApp(
      <DelegationModal
        open
        onClose={() => {}}
        delegateAddress={DELEGATEE_ADDRESS}
        tokenAddress={ENS_TOKEN_ADDRESS}
      />,
    )

    await waitFor(() => {
      expect(collectVisibleState()).toEqual({
        step1Done: false,
        step2Done: false,
        errorVisible: true,
        successVisible: false,
      })
    })

    expect(
      screen.getByText('Transaction rejected by user.'),
    ).toBeInTheDocument()
    expect(state.relayCalls).toBe(0)
  })

  it('relayer 429: shows rate-limited error copy', async () => {
    state.relayResponse = () =>
      HttpResponse.json(
        { error: 'rate limited', code: 'RATE_LIMITED' },
        { status: 429 },
      )

    const { client, asWalletClient } = buildWalletFake()
    client.readContract.mockImplementation(({ functionName }) => {
      if (functionName === 'name') return Promise.resolve('ENS')
      if (functionName === 'nonces') return Promise.resolve(42n)
      throw new Error(`unexpected readContract ${functionName}`)
    })
    client.signTypedData.mockResolvedValue(SIGNATURE_WITH_V)
    useWalletClientMock.mockReturnValue(
      walletClientResult({ data: asWalletClient }),
    )

    renderApp(
      <DelegationModal
        open
        onClose={() => {}}
        delegateAddress={DELEGATEE_ADDRESS}
        tokenAddress={ENS_TOKEN_ADDRESS}
      />,
    )

    await waitFor(() => {
      expect(collectVisibleState()).toEqual({
        step1Done: false,
        step2Done: false,
        errorVisible: true,
        successVisible: false,
      })
    })

    expect(
      screen.getByText(/You've reached maximum operations per day/i),
    ).toBeInTheDocument()
    expect(state.relayCalls).toBe(1)
  })

  it('ineligible: free-delegation alert hidden, falls back to writeContract, relay not called', async () => {
    state.balance = { hasEnoughBalance: false }

    const { client, asWalletClient } = buildWalletFake()
    const writeTxHash =
      '0xfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed' as `0x${string}`
    client.simulateContract.mockResolvedValue({
      request: { functionName: 'delegate', args: [DELEGATEE_ADDRESS] },
    })
    client.writeContract.mockResolvedValue(writeTxHash)
    client.waitForTransactionReceipt.mockResolvedValue({
      transactionHash: writeTxHash,
      status: 'success',
    })
    useWalletClientMock.mockReturnValue(
      walletClientResult({ data: asWalletClient }),
    )

    renderApp(
      <DelegationModal
        open
        onClose={() => {}}
        delegateAddress={DELEGATEE_ADDRESS}
        tokenAddress={ENS_TOKEN_ADDRESS}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Your ENS is now delegated')).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/This delegation is free/i),
    ).not.toBeInTheDocument()

    expect(state.relayCalls).toBe(0)
    expect(client.signTypedData).not.toHaveBeenCalled()
    expect(client.writeContract).toHaveBeenCalledTimes(1)

    const txLink = screen.getByRole('link', {
      name: /View transaction on Etherscan/i,
    })
    expect(txLink).toHaveAttribute(
      'href',
      `https://etherscan.io/tx/${writeTxHash}`,
    )
  })
})
