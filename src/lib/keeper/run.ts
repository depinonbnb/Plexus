// Plexus keeper — daily buyback/burn + staker reward epoch on BNB Chain.
//
// One cycle:
//   1. Size the buyback pool from the treasury USDC budget (compute margin +
//      buyback share of trading fees — accounted upstream; here we read the
//      budget figure passed in or from BUYBACK_BUDGET_USD).
//   2. Split the pool POOL_BURN_SPLIT : (1 - split) between buy+burn and stakers.
//   3. buyback+burn the burn half via Buyback.sol (atomic swap+burn).
//   4. Discover every staker from Staking.sol `Staked` events, read each one's
//      matured stake, split the staker half pro-rata, add to each account's
//      cumulative total, build the Merkle tree, post the root + fund the delta.
//
// Cumulative reward state persists in data/rewards.json so each epoch only funds
// the NEW delta (matches RewardDistributor's cumulative-claim model).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { parseAbiItem, type Address } from 'viem';
import { publicClient, STAKING, PLEX_DECIMALS, USDC_DECIMALS, fromBase, toBase } from '../chain.js';
import { STAKING_ABI } from '../abi.js';
import { POOL_BURN_SPLIT } from '../tokenomics.js';
import { buildTree, type Leaf } from './merkle.js';
import { buybackAndBurn, postRewardRoot } from './buyback.js';

const STATE_PATH = path.join(process.cwd(), 'data', 'rewards.json');

interface RewardState {
  cumulativeByAccount: Record<string, string>; // account -> cumulative USDC base units
  lastEpochAt: string | null;
}

function loadState(): RewardState {
  if (!existsSync(STATE_PATH)) return { cumulativeByAccount: {}, lastEpochAt: null };
  return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
}
function saveState(s: RewardState): void {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(s, null, 2));
}

/** Every address that has ever staked (from Staked events). */
async function discoverStakers(): Promise<Address[]> {
  const fromBlock = BigInt(process.env.STAKING_DEPLOY_BLOCK || '0');
  const logs = await publicClient.getLogs({
    address: STAKING,
    event: parseAbiItem('event Staked(address indexed user, uint256 amount, uint256 lotIndex, uint256 since)'),
    fromBlock,
    toBlock: 'latest',
  });
  return [...new Set(logs.map((l) => (l.args as { user: Address }).user))];
}

/** Matured stake (base units) per staker, dropping zero-matured accounts. */
async function maturedStakes(stakers: Address[]): Promise<Map<Address, bigint>> {
  const out = new Map<Address, bigint>();
  for (const owner of stakers) {
    const m = (await publicClient.readContract({
      address: STAKING, abi: STAKING_ABI, functionName: 'maturedStakeOf', args: [owner],
    })) as bigint;
    if (m > 0n) out.set(owner, m);
  }
  return out;
}

export async function runEpoch(budgetUsd: number): Promise<void> {
  if (budgetUsd <= 0) {
    console.log('[keeper] empty budget — nothing to do');
    return;
  }
  const burnUsd = budgetUsd * POOL_BURN_SPLIT;
  const stakerUsd = budgetUsd - burnUsd;
  console.log(`[keeper] budget $${budgetUsd.toFixed(2)} → burn $${burnUsd.toFixed(2)}, stakers $${stakerUsd.toFixed(2)}`);

  // 1. buy + burn half
  await buybackAndBurn(burnUsd);

  // 2. staker epoch — pro-rata by matured stake
  const stakers = await discoverStakers();
  const matured = await maturedStakes(stakers);
  const totalMature = [...matured.values()].reduce((s, x) => s + x, 0n);
  if (totalMature === 0n) {
    console.log('[keeper] no matured stake — staker half rolls to next epoch');
    return;
  }

  const state = loadState();
  const stakerUsdBase = toBase(stakerUsd, USDC_DECIMALS);
  const leaves: Leaf[] = [];
  for (const [account, mature] of matured) {
    const share = (stakerUsdBase * mature) / totalMature; // integer math, dust stays in treasury
    const prev = BigInt(state.cumulativeByAccount[account.toLowerCase()] || '0');
    const next = prev + share;
    state.cumulativeByAccount[account.toLowerCase()] = next.toString();
    leaves.push({ account, cumulative: next });
  }

  const tree = buildTree(leaves);
  state.lastEpochAt = new Date().toISOString();
  saveState(state);

  // We only FUND the new delta this epoch = sum of shares distributed now (the
  // cumulative roots already account for prior epochs). Integer dust stays put.
  const deltaBase = [...matured.values()].reduce((s, m) => s + (stakerUsdBase * m) / totalMature, 0n);
  const deltaUsd = fromBase(deltaBase, USDC_DECIMALS);
  await postRewardRoot(tree.root, deltaUsd);

  // Persist proofs so the web/API can serve them to claimers.
  const proofs: Record<string, { cumulative: string; proof: string[] }> = {};
  for (const [account, leaf] of tree.leafByAccount) {
    proofs[account.toLowerCase()] = { cumulative: leaf.cumulative.toString(), proof: tree.proofFor(account) };
  }
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(path.join(process.cwd(), 'data', 'proofs.json'), JSON.stringify(proofs, null, 2));
  console.log(`[keeper] epoch done — root ${tree.root}, ${leaves.length} stakers, $${deltaUsd.toFixed(2)} claimable added`);
}

// Allow `npm run keeper` to fire one cycle with a budget from env.
const isMain = process.argv[1] && process.argv[1].endsWith('run.ts');
if (isMain) {
  const budget = Number(process.env.BUYBACK_BUDGET_USD || 0);
  runEpoch(budget).catch((e) => {
    console.error('[keeper] epoch failed:', e);
    process.exit(1);
  });
}

export { PLEX_DECIMALS };
