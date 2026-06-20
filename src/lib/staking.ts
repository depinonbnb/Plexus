// Read-side helpers for on-chain $PLEX staking (Staking.sol).
//
// All maturity/lot logic now lives in the contract, so the server just *reads*
// it. This replaces both the custodial DB lot-tracking and the Solana
// on-chain-staking client — there is one source of truth: the contract.

import type { Address } from 'viem';
import { publicClient, STAKING, PLEX_DECIMALS, fromBase } from './chain.js';
import { STAKING_ABI } from './abi.js';
import { WORKER_STAKE_THRESHOLD, WORKER_REVENUE_SHARE, WORKER_STAKED_REVENUE_SHARE } from './tokenomics.js';

// whole PLEX -> base units (18 decimals), bigint-safe for large thresholds.
const toThresholdBase = (whole: number): bigint => BigInt(whole) * 10n ** BigInt(PLEX_DECIMALS);

export interface StakePosition {
  stakedAmount: number; // total PLEX (matured + cooling)
  matureAmount: number; // portion held >= 24h (the part that earns)
  nextMatureAt: number | null; // unix ms when the soonest cooling lot matures
  eligible: boolean;
}

export async function getStakePosition(owner: Address): Promise<StakePosition> {
  const [staked, mature, nextAt] = await Promise.all([
    publicClient.readContract({ address: STAKING, abi: STAKING_ABI, functionName: 'stakedOf', args: [owner] }) as Promise<bigint>,
    publicClient.readContract({ address: STAKING, abi: STAKING_ABI, functionName: 'maturedStakeOf', args: [owner] }) as Promise<bigint>,
    publicClient.readContract({ address: STAKING, abi: STAKING_ABI, functionName: 'nextMatureAt', args: [owner] }) as Promise<bigint>,
  ]);
  const matureAmount = fromBase(mature, PLEX_DECIMALS);
  return {
    stakedAmount: fromBase(staked, PLEX_DECIMALS),
    matureAmount,
    nextMatureAt: nextAt > 0n ? Number(nextAt) * 1000 : null,
    eligible: matureAmount > 0,
  };
}

/** Worker's effective revenue share, boosted if matured stake clears threshold. */
export async function getWorkerRevenueShare(owner: Address): Promise<number> {
  const boosted = (await publicClient.readContract({
    address: STAKING,
    abi: STAKING_ABI,
    functionName: 'hasWorkerBoost',
    args: [owner, toThresholdBase(WORKER_STAKE_THRESHOLD)],
  })) as boolean;
  return boosted ? WORKER_STAKED_REVENUE_SHARE : WORKER_REVENUE_SHARE;
}

export async function getMaturedStake(owner: Address): Promise<number> {
  return (await getStakePosition(owner)).matureAmount;
}

export async function getTotalStaked(): Promise<number> {
  const total = (await publicClient.readContract({
    address: STAKING,
    abi: STAKING_ABI,
    functionName: 'totalStaked',
  })) as bigint;
  return fromBase(total, PLEX_DECIMALS);
}
