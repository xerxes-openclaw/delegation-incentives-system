import { Hono } from "hono";
import type { Context } from "hono";

const BLOCKFUL_API_TOKEN = process.env.BLOCKFUL_API_TOKEN;
const GATEFUL_UPSTREAM_URL = process.env.GATEFUL_UPSTREAM_URL;

/**
 * Gasless delegation is optional. With both vars set the proxy is mounted and
 * the frontend offers relayed delegation; with neither set the routes are not
 * mounted at all and the frontend falls back to a direct on-chain
 * delegate(address) call, which the user pays for.
 *
 * Setting exactly one is a deploy mistake rather than an opt-out, and is
 * rejected by the env schema in ../config/env.ts.
 */
export const isRelayerConfigured = Boolean(
  BLOCKFUL_API_TOKEN && GATEFUL_UPSTREAM_URL,
);

const MAX_BODY_BYTES = 8 * 1024;
// GATEFUL_UPSTREAM_TIMEOUT_MS is a test-only override (vi.useFakeTimers() doesn't mock AbortSignal.timeout); leave unset in production so the 15_000 ms default applies.
const UPSTREAM_TIMEOUT_MS = Number(process.env.GATEFUL_UPSTREAM_TIMEOUT_MS) || 15_000;
const PRESERVED_RESPONSE_HEADERS = ["content-type", "retry-after", "cache-control"] as const;

function buildUpstreamUrl(c: Context, suffix: string): string {
  const base = (GATEFUL_UPSTREAM_URL as string).replace(/\/+$/, "");
  const url = new URL(c.req.url);
  return `${base}${suffix}${url.search}`;
}

function buildForwardHeaders(c: Context): Headers {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${BLOCKFUL_API_TOKEN}`);

  const contentType = c.req.header("content-type");
  if (contentType) headers.set("content-type", contentType);

  const clientSource = c.req.header("x-client-source");
  headers.set("x-client-source", clientSource ?? "ens-dis-backend");

  return headers;
}

async function proxyRequest(
  c: Context,
  upstreamUrl: string,
  init: { method: "GET" | "POST"; body?: string },
): Promise<Response> {
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: init.method,
      headers: buildForwardHeaders(c),
      body: init.body,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "TimeoutError" || err.name === "AbortError")
    ) {
      return c.json({ error: "Upstream relayer timed out" }, 504);
    }
    return c.json({ error: "Upstream relayer unreachable" }, 502);
  }

  const responseHeaders = new Headers();
  for (const name of PRESERVED_RESPONSE_HEADERS) {
    const value = upstreamRes.headers.get(name);
    if (value !== null) responseHeaders.set(name, value);
  }
  // Explicitly never forward set-cookie or any other upstream headers.

  const buf = await upstreamRes.arrayBuffer();
  return new Response(buf, {
    status: upstreamRes.status,
    headers: responseHeaders,
  });
}

const app = new Hono();

app.get("/api/gateful/:dao/relay/balance", async (c) => {
  const dao = c.req.param("dao");
  const upstream = buildUpstreamUrl(c, `/${encodeURIComponent(dao)}/relay/balance`);
  return proxyRequest(c, upstream, { method: "GET" });
});

app.get("/api/gateful/:dao/relay/config", async (c) => {
  const dao = c.req.param("dao");
  const upstream = buildUpstreamUrl(c, `/${encodeURIComponent(dao)}/relay/config`);
  return proxyRequest(c, upstream, { method: "GET" });
});

app.get("/api/gateful/:dao/relay/rate-limit/:address", async (c) => {
  const dao = c.req.param("dao");
  const address = c.req.param("address");
  const upstream = buildUpstreamUrl(
    c,
    `/${encodeURIComponent(dao)}/relay/rate-limit/${encodeURIComponent(address)}`,
  );
  return proxyRequest(c, upstream, { method: "GET" });
});

app.post("/api/gateful/:dao/relay/delegate", async (c) => {
  const dao = c.req.param("dao");
  const body = await c.req.text();
  if (new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
    return c.json({ error: "Request body too large" }, 413);
  }
  const upstream = buildUpstreamUrl(c, `/${encodeURIComponent(dao)}/relay/delegate`);
  return proxyRequest(c, upstream, { method: "POST", body });
});

export default app;
