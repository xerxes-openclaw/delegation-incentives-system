import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useReadContract } from "wagmi";
import { formatUnits, zeroAddress, type Address } from "viem";

import { env } from "@/config/env";

import { FRONTEND_CLIENT_SOURCE, RELAYER_BASE_URL } from "../relayerClient";

const ENS_TOKEN_ADDRESS =
  "0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72" as const;
const ENS_TOKEN_DECIMALS = 18;

/**
 * Copy fallback for the gas-sponsorship minimum (in whole ENS) used when the
 * relayer config hasn't loaded (or the relayer is unfunded). Keep in sync with
 * the relayer's `minVotingPower` config.
 */
export const DEFAULT_GAS_SPONSORSHIP_MIN_ENS = "100";

const ENS_TOKEN_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const BALANCE_PATH = `${RELAYER_BASE_URL}/api/gateful/ens/relay/balance`;
const CONFIG_PATH = `${RELAYER_BASE_URL}/api/gateful/ens/relay/config`;
const rateLimitPath = (address: string) =>
  `${RELAYER_BASE_URL}/api/gateful/ens/relay/rate-limit/${address}`;

interface RelayerBalanceResponse {
  hasEnoughBalance: boolean;
}

interface RelayerConfigResponse {
  minVotingPower: string;
  // Max relays per address per calendar month (UTC), per operation.
  limits: { vote: number; delegation: number };
}

interface RelayerRateLimitOp {
  used: number;
  remaining: number;
  limit: number;
}

interface RelayerRateLimitResponse {
  delegation: RelayerRateLimitOp;
  vote: RelayerRateLimitOp;
  // ISO 8601 timestamp of the next UTC month start, when the quota resets.
  resetsAt: string;
}

async function fetchRelayer<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { "x-client-source": FRONTEND_CLIENT_SOURCE },
  });
  if (!res.ok) throw new Error(`relayer ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

interface UseRelayerBalanceResult {
  hasEnoughBalance: boolean | null;
  isLoading: boolean;
}

export const useRelayerBalance = (): UseRelayerBalanceResult => {
  const gaslessEnabled = env.enableGasless;

  const { data, isLoading } = useQuery({
    queryKey: ["relayer", "balance"],
    queryFn: () => fetchRelayer<RelayerBalanceResponse>(BALANCE_PATH),
    enabled: gaslessEnabled,
  });

  // With gasless off there is no relayer to ask. Report "cannot sponsor"
  // immediately rather than firing a request that would 404 against a backend
  // running without the proxy mounted.
  if (!gaslessEnabled) {
    return { hasEnoughBalance: false, isLoading: false };
  }

  return {
    hasEnoughBalance: data?.hasEnoughBalance ?? null,
    isLoading,
  };
};

interface UseRelayerConfigResult {
  minVotingPower: bigint | null;
  isLoading: boolean;
}

export const useRelayerConfig = (): UseRelayerConfigResult => {
  const { hasEnoughBalance, isLoading: balanceLoading } = useRelayerBalance();
  const enabled = env.enableGasless && hasEnoughBalance === true;

  const { data, isLoading } = useQuery({
    queryKey: ["relayer", "config"],
    queryFn: () => fetchRelayer<RelayerConfigResponse>(CONFIG_PATH),
    enabled,
  });

  const minVotingPower = useMemo(() => {
    if (!data?.minVotingPower) return null;
    try {
      return BigInt(data.minVotingPower);
    } catch {
      return null;
    }
  }, [data?.minVotingPower]);

  return {
    minVotingPower,
    isLoading: balanceLoading || (enabled && isLoading),
  };
};

/**
 * Display string (whole ENS units) for the minimum ENS balance required to
 * qualify for sponsored gas. Reads the relayer's dynamic `minVotingPower`
 * config and falls back to {@link DEFAULT_GAS_SPONSORSHIP_MIN_ENS} while it
 * loads or when the relayer is unavailable. Copy-only — the actual gas
 * eligibility check lives in {@link useGaslessEligibility}.
 */
export const useGasSponsorshipMinEns = (): string => {
  const { minVotingPower } = useRelayerConfig();

  return useMemo(() => {
    if (minVotingPower === null || minVotingPower <= 0n) {
      return DEFAULT_GAS_SPONSORSHIP_MIN_ENS;
    }
    return formatUnits(minVotingPower, ENS_TOKEN_DECIMALS);
  }, [minVotingPower]);
};

/**
 * Why a connected wallet's delegation won't get sponsored (free) gas. Mirrors
 * the relayer's published signals — the front never invents its own rule:
 * - `relayer-paused`: the relayer is unfunded (global, beats every other state).
 * - `no-ens`: the wallet holds 0 ENS and the relayer's `minVotingPower > 0`.
 * - `below-minimum`: the wallet holds some ENS, but less than `minVotingPower`.
 * - `rate-limited`: the wallet has no delegation relays left this month.
 *
 * `null` means eligible (or still loading, or no wallet connected).
 */
export type SponsorshipBlockReason =
  | "relayer-paused"
  | "no-ens"
  | "below-minimum"
  | "rate-limited";

interface UseGaslessEligibilityResult {
  isEligible: boolean;
  reason: SponsorshipBlockReason | null;
  remaining: number | null;
  /** ISO timestamp when the monthly quota resets (next UTC month start). */
  resetsAt: string | null;
  isLoading: boolean;
}

/**
 * Single source of truth for gas-sponsorship eligibility. Derives the verdict
 * (and, when blocked, the {@link SponsorshipBlockReason}) purely from
 * relayer-published signals: `minVotingPower` (config), `hasEnoughBalance`
 * (funding), and `rate-limit.delegation.remaining`, compared against the
 * wallet's on-chain ENS balance. No hardcoded thresholds, no front-side rules.
 *
 * Note: the threshold gates GAS SPONSORSHIP ONLY — rewards eligibility is
 * independent and never requires holding a minimum.
 */
export const useGaslessEligibility = (
  address: Address | undefined,
): UseGaslessEligibilityResult => {
  const gaslessEnabled = env.enableGasless;
  const { hasEnoughBalance, isLoading: balanceLoading } = useRelayerBalance();
  const { minVotingPower, isLoading: configLoading } = useRelayerConfig();

  const queryEnabled = gaslessEnabled && !!address && hasEnoughBalance === true;

  const targetAddress = address ?? zeroAddress;

  const { data: rateLimitData, isLoading: rateLimitLoading } = useQuery({
    queryKey: ["relayer", "rate-limit", address?.toLowerCase() ?? null],
    queryFn: () =>
      fetchRelayer<RelayerRateLimitResponse>(rateLimitPath(targetAddress)),
    enabled: queryEnabled,
  });

  const delegationRemaining = rateLimitData?.delegation.remaining ?? null;
  const resetsAt = rateLimitData?.resetsAt ?? null;

  const { data: userBalanceData, isLoading: userBalanceLoading } =
    useReadContract({
      address: ENS_TOKEN_ADDRESS,
      abi: ENS_TOKEN_ABI,
      functionName: "balanceOf",
      args: [targetAddress],
      query: { enabled: queryEnabled },
    });

  const userBalance = userBalanceData ?? null;

  const isLoading =
    gaslessEnabled &&
    !!address &&
    (balanceLoading ||
      (hasEnoughBalance === true &&
        (configLoading || rateLimitLoading || userBalanceLoading)));

  // Reason precedence mirrors the relayer: funding (global) beats the balance
  // gate, which beats the rate limit. Each tier is decided as soon as its own
  // inputs are known — the balance-gated reasons don't wait on the rate limit.
  // `null` = eligible or not-yet-resolved.
  const reason = useMemo<SponsorshipBlockReason | null>(() => {
    // Feature off: gas sponsorship was never on offer, so there is nothing to
    // explain. A reason here would pop the "sponsored gas is paused"
    // interstitial in front of every delegation.
    if (!gaslessEnabled) return null;
    if (!address || balanceLoading) return null;
    if (hasEnoughBalance !== true) return "relayer-paused";
    if (minVotingPower === null || userBalance === null) return null;
    if (userBalance < minVotingPower) {
      return userBalance === 0n ? "no-ens" : "below-minimum";
    }
    // Balance clears the bar — the rate limit is the only remaining blocker.
    if (delegationRemaining === null) return null;
    if (delegationRemaining <= 0) return "rate-limited";
    return null;
  }, [
    gaslessEnabled,
    address,
    balanceLoading,
    hasEnoughBalance,
    userBalance,
    minVotingPower,
    delegationRemaining,
  ]);

  // gaslessEnabled is load-bearing: without it a null reason plus a settled
  // loading state would read as "eligible" and route to the gasless path.
  const isEligible =
    gaslessEnabled && !isLoading && !!address && reason === null;

  return {
    isEligible,
    reason,
    remaining: delegationRemaining,
    resetsAt,
    isLoading,
  };
};
