import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { OpenAPIHono } from "@hono/zod-openapi";

// Set env BEFORE importing the proxy module (it reads env at module load).
process.env.BLOCKFUL_API_TOKEN = "test-token";
process.env.GATEFUL_UPSTREAM_URL = "https://upstream.test";

const { default: proxy } = await import("../../../src/api/relayer-proxy.js");

function makeApp() {
  const app = new OpenAPIHono();
  app.route("/", proxy);
  app.notFound((c) => c.json({ error: "Not found", path: c.req.path }, 404));
  return app;
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("relayer proxy", () => {
  it("GET /api/gateful/:dao/relay/balance forwards bearer + default x-client-source", async () => {
    let observedAuth: string | null = null;
    let observedClientSource: string | null = null;
    server.use(
      http.get("https://upstream.test/ens/relay/balance", ({ request }) => {
        observedAuth = request.headers.get("authorization");
        observedClientSource = request.headers.get("x-client-source");
        return HttpResponse.json({ balance: "123" });
      }),
    );

    const res = await makeApp().request("/api/gateful/ens/relay/balance");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ balance: "123" });
    expect(observedAuth).toBe("Bearer test-token");
    expect(observedClientSource).toBe("ens-dis-backend");
  });

  it("forwards a caller-supplied x-client-source verbatim", async () => {
    let observedClientSource: string | null = null;
    server.use(
      http.get("https://upstream.test/ens/relay/balance", ({ request }) => {
        observedClientSource = request.headers.get("x-client-source");
        return HttpResponse.json({ balance: "1" });
      }),
    );

    const res = await makeApp().request("/api/gateful/ens/relay/balance", {
      headers: { "x-client-source": "my-client" },
    });
    expect(res.status).toBe(200);
    expect(observedClientSource).toBe("my-client");
  });

  it("GET /api/gateful/:dao/relay/config returns 200", async () => {
    server.use(
      http.get("https://upstream.test/ens/relay/config", () =>
        HttpResponse.json({ ok: true, daos: ["ens"] }),
      ),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/config");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, daos: ["ens"] });
  });

  it("GET /api/gateful/:dao/relay/rate-limit/:address forwards address literally", async () => {
    let observedUrl: string | null = null;
    server.use(
      http.get("https://upstream.test/ens/relay/rate-limit/:address", ({ request }) => {
        observedUrl = request.url;
        return HttpResponse.json({ remaining: 5 });
      }),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/rate-limit/0xabc");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ remaining: 5 });
    expect(observedUrl).toBe("https://upstream.test/ens/relay/rate-limit/0xabc");
  });

  it("POST /api/gateful/:dao/relay/delegate forwards JSON body byte-equal and preserves content-type", async () => {
    let observedBody: string | null = null;
    let observedContentType: string | null = null;
    server.use(
      http.post("https://upstream.test/ens/relay/delegate", async ({ request }) => {
        observedBody = await request.text();
        observedContentType = request.headers.get("content-type");
        return HttpResponse.json(
          { transactionHash: "0xdead", delegator: "0xabc" },
          { headers: { "content-type": "application/json; charset=utf-8" } },
        );
      }),
    );

    const requestBody = JSON.stringify({ from: "0xabc", to: "0xdef" });
    const res = await makeApp().request("/api/gateful/ens/relay/delegate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transactionHash: "0xdead", delegator: "0xabc" });
    expect(observedBody).toBe(requestBody);
    expect(observedContentType).toBe("application/json");
    expect(res.headers.get("content-type")).toBe("application/json; charset=utf-8");
  });

  it("POST with body >8 KB returns 413 and never calls upstream", async () => {
    let called = 0;
    server.use(
      http.post("https://upstream.test/ens/relay/delegate", () => {
        called += 1;
        return HttpResponse.json({ ok: true });
      }),
    );

    const bigBody = JSON.stringify({ data: "x".repeat(9 * 1024) });
    const res = await makeApp().request("/api/gateful/ens/relay/delegate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: bigBody,
    });
    expect(res.status).toBe(413);
    expect(called).toBe(0);
  });

  it("preserves 429 + retry-after header", async () => {
    server.use(
      http.get("https://upstream.test/ens/relay/balance", () =>
        HttpResponse.json(
          { code: "RATE_LIMITED" },
          { status: 429, headers: { "retry-after": "60" } },
        ),
      ),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/balance");
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("60");
    expect(await res.json()).toEqual({ code: "RATE_LIMITED" });
  });

  it("preserves 503 status and body", async () => {
    server.use(
      http.get("https://upstream.test/ens/relay/config", () =>
        HttpResponse.json({ code: "UNAVAILABLE" }, { status: 503 }),
      ),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/config");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ code: "UNAVAILABLE" });
  });

  it("preserves 400 with structured error body", async () => {
    server.use(
      http.post("https://upstream.test/ens/relay/delegate", () =>
        HttpResponse.json({ code: "INSUFFICIENT_VOTING_POWER" }, { status: 400 }),
      ),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/delegate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from: "0xabc" }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "INSUFFICIENT_VOTING_POWER" });
  });

  it("strips upstream set-cookie from response", async () => {
    server.use(
      http.get("https://upstream.test/ens/relay/balance", () =>
        HttpResponse.json(
          { balance: "1" },
          { headers: { "set-cookie": "session=evil; HttpOnly" } },
        ),
      ),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/balance");
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("non-whitelisted path under /api/gateful returns 404", async () => {
    const res = await makeApp().request("/api/gateful/ens/proposals");
    expect(res.status).toBe(404);
  });

  it("returns 502 when upstream fetch throws a non-timeout error", async () => {
    server.use(
      http.get("https://upstream.test/ens/relay/balance", () => HttpResponse.error()),
    );
    const res = await makeApp().request("/api/gateful/ens/relay/balance");
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "Upstream relayer unreachable" });
  });

  it("returns 504 when upstream times out", async () => {
    // Tried vi.useFakeTimers first — Node's AbortSignal.timeout uses native timers
    // that vitest doesn't fake, so a short real timeout is the spec-sanctioned fallback.
    vi.resetModules();
    const originalTimeout = process.env.GATEFUL_UPSTREAM_TIMEOUT_MS;
    process.env.GATEFUL_UPSTREAM_TIMEOUT_MS = "50";
    try {
      const { default: shortTimeoutProxy } = await import(
        "../../../src/api/relayer-proxy.js?short-timeout"
      );
      const fastApp = new OpenAPIHono();
      fastApp.route("/", shortTimeoutProxy);

      server.use(
        http.get(
          "https://upstream.test/ens/relay/balance",
          () => new Promise<Response>(() => {}),
        ),
      );

      const res = await fastApp.request("/api/gateful/ens/relay/balance");
      expect(res.status).toBe(504);
    } finally {
      if (originalTimeout === undefined) delete process.env.GATEFUL_UPSTREAM_TIMEOUT_MS;
      else process.env.GATEFUL_UPSTREAM_TIMEOUT_MS = originalTimeout;
    }
  });
});

describe("relayer proxy configuration detection", () => {
  const originalToken = process.env.BLOCKFUL_API_TOKEN;
  const originalUrl = process.env.GATEFUL_UPSTREAM_URL;

  afterEach(() => {
    process.env.BLOCKFUL_API_TOKEN = originalToken;
    process.env.GATEFUL_UPSTREAM_URL = originalUrl;
    vi.resetModules();
  });

  it("reports unconfigured when BLOCKFUL_API_TOKEN is unset", async () => {
    vi.resetModules();
    delete process.env.BLOCKFUL_API_TOKEN;
    process.env.GATEFUL_UPSTREAM_URL = "https://upstream.test";
    const { isRelayerConfigured } = await import(
      "../../../src/api/relayer-proxy.js?missing-token"
    );
    expect(isRelayerConfigured).toBe(false);
  });

  it("reports unconfigured when GATEFUL_UPSTREAM_URL is unset", async () => {
    vi.resetModules();
    process.env.BLOCKFUL_API_TOKEN = "test-token";
    delete process.env.GATEFUL_UPSTREAM_URL;
    const { isRelayerConfigured } = await import(
      "../../../src/api/relayer-proxy.js?missing-url"
    );
    expect(isRelayerConfigured).toBe(false);
  });

  it("reports unconfigured when neither var is set", async () => {
    vi.resetModules();
    delete process.env.BLOCKFUL_API_TOKEN;
    delete process.env.GATEFUL_UPSTREAM_URL;
    const { isRelayerConfigured } = await import(
      "../../../src/api/relayer-proxy.js?missing-both"
    );
    expect(isRelayerConfigured).toBe(false);
  });

  it("reports configured when both vars are set", async () => {
    vi.resetModules();
    process.env.BLOCKFUL_API_TOKEN = "test-token";
    process.env.GATEFUL_UPSTREAM_URL = "https://upstream.test";
    const { isRelayerConfigured } = await import(
      "../../../src/api/relayer-proxy.js?configured"
    );
    expect(isRelayerConfigured).toBe(true);
  });
});
