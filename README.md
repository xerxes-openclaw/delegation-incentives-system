# ENS Delegation Incentives System

Monorepo for computing and distributing monthly ENS delegation incentive rewards. Active voters and their token holders earn pro-rata shares of a tier-based reward pool determined by month-over-month growth in the total voting power held by active voters.

## Architecture

Single-service: Ponder indexes on-chain events and serves REST API endpoints from the same process.

```
packages/
└── domain/          — Pure incentives logic (no framework deps, fully tested)

apps/
├── backend/         — Ponder indexer + Hono REST API
└── frontend/        — Web dashboard (placeholder)
```

## Quick Start

```bash
# 1. Copy env and fill in values
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Run tests
pnpm --filter @ens-dis/domain test
pnpm --filter @ens-dis/backend test

# 4. Start the backend (requires RPC_URL and DATABASE_URL)
pnpm --filter @ens-dis/backend dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `RPC_URL` | Ethereum mainnet RPC (required) |
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `DATABASE_SCHEMA` | Postgres schema for indexer state (default: `prod`). Keep stable across deploys — changing it triggers a full re-index |
| `BACKEND_PORT` | API port (default: 42069) |
| `ROUND_MONTHS` | Comma-separated configured round months, e.g. `2026-03,2026-04,2026-05` |
| `BLOCKFUL_API_TOKEN` | Bearer token forwarded by the backend to the Gateful relayer (required when relayer is enabled) |
| `GATEFUL_UPSTREAM_URL` | Upstream Gateful relayer base URL (required when relayer is enabled) |
| `ALLOWED_ORIGINS` | Comma-separated frontend origins permitted to call this backend cross-origin (required in production when the SPA hits the backend on a different origin) |
| `VITE_ENABLE_GASLESS` | Frontend build flag. `true` enables the gasless delegation UI; anything else (including unset) disables it and delegations go direct on-chain |

## API Endpoints

Routes are served at the root (no `/api` prefix on the backend). Frontends configure a base via `VITE_API_BASE_URL` if they want one.

Scalar API reference at `GET /docs`. OpenAPI 3.0 spec at `GET /openapi.json`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Ponder's built-in liveness check (use this for Railway/uptime probes) |
| `GET` | `/voters/active` | Addresses that voted on ≥ 7 of the last 10 proposals |
| `GET` | `/eligibility/{address}` | Is this address an active voter or a token holder of one? |
| `GET` | `/tiers/progression` | Current tier, VP needed for next tier, all tier thresholds |
| `GET` | `/apy/{address}` | Estimated monthly reward and annualized APY |
| `GET` | `/distributions/{month}` | Fetch a stored distribution (JSON) |
| `GET` | `/distributions/{month}/csv` | Download distribution as CSV |

The backend also starts an automatic distribution scheduler in normal runs. It waits for Ponder readiness, then scans every minute and computes any configured `ROUND_MONTHS` that ended at least one minute ago and are not already cached.

## Documentation

| Document | Contents |
|---|---|
| [docs/algorithm.md](./docs/algorithm.md) | Full pipeline spec: each step, all formulas, pool tiers, TWB, cap redistribution, lottery |
| [docs/integrations.md](./docs/integrations.md) | Protocol integrations: contracts indexed, events handled, how data feeds the pipeline |
| [OPERATOR.md](./OPERATOR.md) | Operator guide: running a distribution round, CSV export, monitoring |

## Tech Stack

- **Indexer & API**: Ponder 0.16, Hono, Zod OpenAPI, Drizzle ORM
- **Domain logic**: Pure TypeScript, zero framework dependencies
- **Arithmetic**: BigInt throughout — no floating point
- **Testing**: Vitest, fast-check (property-based)
- **Package manager**: pnpm workspaces

## Gasless Delegation (Relayer)

The frontend delegates voting power via a gasless relayer (when eligible) or falls back to a direct on-chain `delegate(address)` call. Backend routes at `/api/gateful/:dao/relay/*` proxy the upstream Gateful relayer with the bearer token injected server-side.

Eligibility is the only gate: if the relayer's `/balance` reports `hasEnoughBalance: false`, the upstream is unreachable, or the user is over their rate limit / under `minVotingPower`, the modal switches to direct-tx automatically. To take gasless offline cluster-wide without a redeploy, make `/balance` return `hasEnoughBalance: false`.

## Resources

- [ENS Forum — Delegation Incentives Temp Check](https://discuss.ens.domains/t/temp-check-delegation-incentives-program/21824) — original spec
- [ERC20MultiDelegate contract](https://etherscan.io/address/0x3CA5CCC96648d016D41c5aF40eED82202BD019cc)
- [Hedgey TokenVestingPlans contract](https://etherscan.io/address/0x2CDE9919e81b20B4B33DD562a48a84b54C48F00C)
