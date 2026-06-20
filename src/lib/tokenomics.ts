// $PLEX tokenomics — buyback + staking. Chain-agnostic config; the on-chain
// mechanics live in the Solidity contracts and the keeper.
//
// Money flow (all USDC, BSC):
//   compute margin  → 100% into the buyback pool
//   trading fees    → 35% into the buyback pool, 65% to treasury profit
//   the pool        → split 50/50: half buys+burns PLEX, half pays stakers in USDC
//
// Everything is dormant until PLEX_TOKEN_ADDRESS is set. The moment the deployed
// token address lands in the env, the keeper + staking activate.

export const PLEX_DECIMALS = 18; // EVM standard (was 6 on the old SPL mint)

export function getPlexToken(): string | null {
  const a = process.env.PLEX_TOKEN_ADDRESS?.trim();
  return a && a.length === 42 ? a : null;
}

export function isPlexLaunched(): boolean {
  return getPlexToken() !== null;
}

function pct(envKey: string, fallback: number): number {
  const v = process.env[envKey];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

// Of the 30% compute margin, the fraction routed to the buyback pool.
export const COMPUTE_MARGIN_TO_POOL_PCT = pct('COMPUTE_MARGIN_BUYBACK_PCT', 1.0);
// Of claimed PancakeSwap LP/treasury trading fees, the fraction to the pool.
export const TRADING_FEE_TO_POOL_PCT = pct('TRADING_FEE_BUYBACK_PCT', 0.35);
// Of the buyback pool, the fraction used to buy+burn PLEX (rest pays stakers USDC).
export const POOL_BURN_SPLIT = pct('POOL_BURN_SPLIT', 0.5);

// Minimum USD a worker/staker can withdraw in one payout.
export const MIN_WITHDRAWAL_USD = 1.0;

// Worker revenue share of the USD value of credits spent on their job.
export const WORKER_REVENUE_SHARE = 0.7;
// Boosted share for workers staking >= WORKER_STAKE_THRESHOLD PLEX (matured 24h).
export const WORKER_STAKED_REVENUE_SHARE = pct('WORKER_STAKED_REVENUE_SHARE', 0.8);
// Referrer's cut of a referred user's self-paid usage.
export const REFERRAL_REVENUE_SHARE = pct('REFERRAL_REVENUE_SHARE', 0.05);

// Minimum whole PLEX a worker must stake (matured 24h) to earn the boost.
// 500,000 = 0.05% of a 1B supply. Retune at launch once price is known.
export const WORKER_STAKE_THRESHOLD = Number(process.env.WORKER_STAKE_THRESHOLD || 500_000);

// A stake must mature this long before it earns epoch rewards or the worker
// boost. Enforced on-chain by Staking.sol (STAKE_MIN_AGE = 24h) — mirrored here
// so the keeper's off-chain epoch math matches the contract exactly.
export const STAKE_MIN_AGE_MS = 24 * 60 * 60 * 1000;

// Free Pro-tier prompts each new account gets before needing to top up USDC.
export const FREE_PROMPT_LIMIT = Number(process.env.FREE_PROMPT_LIMIT || 5);
// Treasury-subsidized free-job spend ceilings (anti-sybil; never surfaced in UI).
export const FREE_SUBSIDY_DAILY_CAP_USD = Number(process.env.FREE_SUBSIDY_DAILY_CAP_USD || 50);
export const FREE_SUBSIDY_HOURLY_CAP_USD = Number(process.env.FREE_SUBSIDY_HOURLY_CAP_USD || 3);

// Daily buyback + epoch reward distribution fire at this UTC hour.
export const KEEPER_UTC_HOUR = Number(process.env.KEEPER_UTC_HOUR || 15);

export const CREDITS_PER_USD = 100; // 1 credit = $0.01
