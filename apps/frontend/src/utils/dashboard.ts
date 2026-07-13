/**
 * Shared formatting utilities for dashboard components.
 * Centralizes number formatting to prevent inconsistencies.
 */

/** Format ENS balance as whole number with thousand separators. */
export function formatBalance(ens: string): string {
  const num = parseFloat(ens)
  if (isNaN(num)) return '0'
  return Math.round(num).toLocaleString('en-US')
}

/** Format ENS payout with appropriate decimal precision. */
export function formatPayout(ens: string): string {
  const num = parseFloat(ens)
  if (isNaN(num) || num === 0) return '0'
  if (num < 0.01) return '<0.01'
  if (num >= 100) return num.toFixed(1)
  return num.toFixed(2)
}

/** Format pool size in compact form (e.g. "5K", "30K"). */
export function formatPool(ens: string): string {
  const num = parseFloat(ens)
  if (num >= 1000) return `${Math.round(num / 1000)}K`
  return Math.round(num).toString()
}

/**
 * Format voting power needed from wei to human-readable.
 * additionalVPNeeded is in wei (1e18 = 1 VP).
 */
export function formatVpNeeded(vpWei: string): string {
  const num = Number(vpWei) / 1e18
  if (num <= 0) return ''
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000) return `${Math.round(num / 1_000)}K`
  return Math.round(num).toString()
}

/** Format ISO date string to short format (e.g. "Feb 28"). */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Calculate VP progress percentage toward next tier. */
export function computeVpProgress(
  currentRequiredAVP: string,
  nextRequiredAVP: string | undefined,
  nextAdditionalVP: string | undefined,
): number {
  if (!nextRequiredAVP || !nextAdditionalVP) return 100
  const currentRequired = Number(currentRequiredAVP) / 1e18
  const nextRequired = Number(nextRequiredAVP) / 1e18
  const additional = Number(nextAdditionalVP) / 1e18
  const span = nextRequired - currentRequired
  if (span <= 0) return 100
  return Math.max(0, Math.min(100, ((span - additional) / span) * 100))
}

/** Calculate what a user would earn at a different tier. */
export function projectPayout(
  currentReward: string,
  currentPoolEns: string,
  targetPoolEns: string,
): string {
  const reward = parseFloat(currentReward)
  const currentPool = parseFloat(currentPoolEns) || 1
  const targetPool = parseFloat(targetPoolEns) || 0
  return (reward * (targetPool / currentPool)).toString()
}

/** '12.50' → '12.5%', '54.00' → '54%'; em-dash placeholder when absent. */
export function fmtApy(pct: string | null | undefined): string {
  if (pct == null) return '—'
  const n = Number(pct)
  if (!Number.isFinite(n)) return '—'
  return `${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}%`
}
