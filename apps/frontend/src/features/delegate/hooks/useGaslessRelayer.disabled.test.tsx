import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";

// VITE_ENABLE_GASLESS unset/false: the relayer is not part of this deployment.
vi.mock("@/config/env", () => ({
  env: {
    apiBaseUrl: "/api",
    useMockApi: false,
    reownProjectId: "test",
    enableGasless: false,
  },
}));

import { TestQueryProvider } from "@/test/utils";
import { server } from "@/test/mocks/server";
import {
  useGaslessEligibility,
  useRelayerBalance,
} from "./useGaslessRelayer";

const TEST_ADDRESS = "0x1111111111111111111111111111111111111111" as Address;

describe("gasless relayer disabled", () => {
  it("reports no sponsorship without issuing a relayer request", async () => {
    const requests: string[] = [];
    server.events.on("request:start", ({ request }) => {
      requests.push(request.url);
    });

    const { result } = renderHook(() => useRelayerBalance(), {
      wrapper: TestQueryProvider,
    });

    expect(result.current.hasEnoughBalance).toBe(false);
    expect(result.current.isLoading).toBe(false);

    await waitFor(() => {
      expect(requests.filter((u) => u.includes("/relay/"))).toHaveLength(0);
    });
  });

  it("is not eligible and reports no block reason", async () => {
    const { result } = renderHook(() => useGaslessEligibility(TEST_ADDRESS), {
      wrapper: TestQueryProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // isEligible false routes delegation to the direct on-chain path; a null
    // reason keeps the "sponsored gas is paused" interstitial from appearing.
    expect(result.current.isEligible).toBe(false);
    expect(result.current.reason).toBeNull();
  });
});
