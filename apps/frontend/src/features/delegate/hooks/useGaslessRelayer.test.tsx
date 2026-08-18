import { beforeEach, describe, expect, it, vi } from "vitest";

// This suite covers the relayer-enabled behaviour, so the flag is forced on.
// The disabled path lives in useGaslessRelayer.disabled.test.tsx.
vi.mock("@/config/env", () => ({
  env: {
    apiBaseUrl: "/api",
    useMockApi: false,
    reownProjectId: "test",
    enableGasless: true,
  },
}));
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { useReadContract } from "wagmi";
import type { Address } from "viem";

import { TestQueryProvider } from "@/test/utils";
import { server } from "@/test/mocks/server";
import { readContractResult } from "@/test/mocks/wagmi";

const TEST_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;

const useReadContractMock = vi.mocked(useReadContract);

interface RelayerBalancePayload {
  hasEnoughBalance: boolean;
}

interface RelayerConfigPayload {
  minVotingPower: string;
  limits: { vote: number; delegation: number };
}

interface RelayerRateLimitOpPayload {
  used: number;
  remaining: number;
  limit: number;
}

interface RelayerRateLimitPayload {
  delegation: RelayerRateLimitOpPayload;
  vote: RelayerRateLimitOpPayload;
  resetsAt: string;
}

interface HandlerState {
  balanceCalls: number;
  configCalls: number;
  rateLimitCalls: number;
  balance: RelayerBalancePayload;
  config: RelayerConfigPayload;
  rateLimit: RelayerRateLimitPayload;
}

function freshState(): HandlerState {
  return {
    balanceCalls: 0,
    configCalls: 0,
    rateLimitCalls: 0,
    balance: { hasEnoughBalance: true },
    config: {
      minVotingPower: "100000000000000000000",
      limits: { vote: 5, delegation: 5 },
    },
    rateLimit: {
      delegation: { used: 0, remaining: 5, limit: 5 },
      vote: { used: 0, remaining: 5, limit: 5 },
      resetsAt: "2026-05-20T00:00:00Z",
    },
  };
}

function installRelayerHandlers(state: HandlerState) {
  server.use(
    http.get("/api/gateful/ens/relay/balance", () => {
      state.balanceCalls += 1;
      return HttpResponse.json(state.balance);
    }),
    http.get("/api/gateful/ens/relay/config", () => {
      state.configCalls += 1;
      return HttpResponse.json(state.config);
    }),
    http.get("/api/gateful/ens/relay/rate-limit/:address", () => {
      state.rateLimitCalls += 1;
      return HttpResponse.json(state.rateLimit);
    }),
  );
}

describe("useGaslessRelayer", () => {
  let state: HandlerState;

  beforeEach(() => {
    vi.resetModules();
    state = freshState();
    installRelayerHandlers(state);
    useReadContractMock.mockReset();
    useReadContractMock.mockReturnValue(readContractResult());
  });

  it("no connected address: ineligible and rate-limit/user-balance gates stay closed", async () => {
    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(undefined), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: false,
        reason: null,
        remaining: null,
        resetsAt: null,
        isLoading: false,
      }),
    );

    expect(state.rateLimitCalls).toBe(0);
    expect(useReadContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: { enabled: false } }),
    );
  });

  it("relayer balance false: skips config, rate-limit, and on-chain read", async () => {
    state.balance = { hasEnoughBalance: false };

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: false,
        reason: "relayer-paused",
        remaining: null,
        resetsAt: null,
        isLoading: false,
      }),
    );

    expect(state.balanceCalls).toBe(1);
    expect(state.configCalls).toBe(0);
    expect(state.rateLimitCalls).toBe(0);
    expect(useReadContractMock).toHaveBeenCalledWith(
      expect.objectContaining({ query: { enabled: false } }),
    );
  });

  it("rate limited: delegation remaining 0 yields ineligible", async () => {
    state.rateLimit = {
      delegation: { used: 5, remaining: 0, limit: 5 },
      vote: { used: 0, remaining: 5, limit: 5 },
      resetsAt: "2026-05-20T00:00:00Z",
    };
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 200n * 10n ** 18n }),
    );

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: false,
        reason: "rate-limited",
        remaining: 0,
        resetsAt: "2026-05-20T00:00:00Z",
        isLoading: false,
      }),
    );
  });

  it("user balance below min voting power: below-minimum", async () => {
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 50n * 10n ** 18n }),
    );

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: false,
        reason: "below-minimum",
        remaining: 5,
        resetsAt: "2026-05-20T00:00:00Z",
        isLoading: false,
      }),
    );
  });

  it("zero balance with a non-zero minimum: no-ens", async () => {
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }));

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() => expect(result.current.reason).toBe("no-ens"));
    expect(result.current.isEligible).toBe(false);
  });

  it("minVotingPower 0: a 0-ENS wallet is eligible (mirrors the relayer)", async () => {
    // Regression: the front used to hardcode `balance === 0 → not sponsored`,
    // ignoring the relayer. With minVotingPower 0 everyone qualifies.
    state.config = { minVotingPower: "0", limits: { vote: 5, delegation: 5 } };
    useReadContractMock.mockReturnValue(readContractResult({ data: 0n }));

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: true,
        reason: null,
        remaining: 5,
        resetsAt: "2026-05-20T00:00:00Z",
        isLoading: false,
      }),
    );
  });

  it("all green: balance true, config min met, rate-limit available, on-chain balance sufficient", async () => {
    useReadContractMock.mockReturnValue(
      readContractResult({ data: 200n * 10n ** 18n }),
    );

    const { useGaslessEligibility } = await import("./useGaslessRelayer");

    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        isEligible: true,
        reason: null,
        remaining: 5,
        resetsAt: "2026-05-20T00:00:00Z",
        isLoading: false,
      }),
    );
  });
});
