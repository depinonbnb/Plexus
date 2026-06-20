// Keeper on-chain primitives for BNB Chain: buyback+burn and reward-epoch roots.
//
// SAFETY: every money-moving call is a no-op when KEEPER_DRY_RUN !== 'false'.
// The keeper defaults to dry-run so nothing moves until a human flips the env.
//
// Buyback is atomic on-chain (Buyback.sol): the keeper quotes a slippage floor
// off-chain against the live PancakeSwap pool, then calls buybackAndBurn() which
// swaps USDC->PLEX and burns the exact amount received in one tx. No buy/burn
// race (the original's failure mode is structurally gone).

import { type Address, type Hex } from 'viem';
import {
  publicClient, walletFor, loadKeeperKey, loadTreasuryKey,
  USDC, USDC_DECIMALS, PLEX_TOKEN, PLEX_DECIMALS, PANCAKE_ROUTER, BUYBACK, REWARD_DISTRIBUTOR,
  toBase,
} from '../chain.js';
import { ERC20_ABI, BUYBACK_ABI, PANCAKE_ROUTER_ABI, REWARD_DISTRIBUTOR_ABI } from '../abi.js';

export function isDryRun(): boolean {
  return process.env.KEEPER_DRY_RUN !== 'false';
}

const BUYBACK_SLIPPAGE_BPS = Number(process.env.BUYBACK_SLIPPAGE_BPS || 500); // 5%

/** Fund the Buyback contract with USDC, then swap+burn atomically. Returns the
 *  burn tx hash (or 'dry-run'). The treasury sends USDC to the buyback contract;
 *  the keeper (contract owner) triggers the swap. */
export async function buybackAndBurn(usdcUi: number): Promise<string> {
  if (usdcUi <= 0) return 'noop';
  if (isDryRun()) {
    console.log(`[keeper] DRY RUN — would buy back + burn $${usdcUi.toFixed(2)} of PLEX`);
    return 'dry-run';
  }
  const usdcIn = toBase(usdcUi, USDC_DECIMALS);

  // Quote expected PLEX out, apply slippage floor.
  const amounts = (await publicClient.readContract({
    address: PANCAKE_ROUTER,
    abi: PANCAKE_ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [usdcIn, [USDC, PLEX_TOKEN]],
  })) as bigint[];
  const expectedOut = amounts[amounts.length - 1];
  const minOut = (expectedOut * BigInt(10_000 - BUYBACK_SLIPPAGE_BPS)) / 10_000n;

  // Treasury moves the USDC budget into the buyback contract.
  const treasury = walletFor(loadTreasuryKey());
  const fundHash = await treasury.client.writeContract({
    address: USDC, abi: ERC20_ABI, functionName: 'transfer',
    args: [BUYBACK, usdcIn], account: treasury.account,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });

  // Keeper triggers the atomic swap+burn.
  const keeper = walletFor(loadKeeperKey());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const hash = await keeper.client.writeContract({
    address: BUYBACK, abi: BUYBACK_ABI, functionName: 'buybackAndBurn',
    args: [usdcIn, minOut, deadline], account: keeper.account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`[keeper] buybackAndBurn reverted: ${hash}`);
  console.log(`[keeper] bought back + burned PLEX (min ${minOut} base) — ${hash}`);
  return hash;
}

/** Post a new cumulative reward root and fund the epoch's USDC delta. */
export async function postRewardRoot(root: Hex, fundUsdUi: number): Promise<string> {
  if (isDryRun()) {
    console.log(`[keeper] DRY RUN — would post root ${root} funding $${fundUsdUi.toFixed(2)}`);
    return 'dry-run';
  }
  const keeper = walletFor(loadKeeperKey());
  const fundAmount = toBase(fundUsdUi, USDC_DECIMALS);

  // Keeper must approve the distributor to pull the epoch USDC.
  if (fundAmount > 0n) {
    const approveHash = await keeper.client.writeContract({
      address: USDC, abi: ERC20_ABI, functionName: 'approve',
      args: [REWARD_DISTRIBUTOR, fundAmount], account: keeper.account,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const hash = await keeper.client.writeContract({
    address: REWARD_DISTRIBUTOR, abi: REWARD_DISTRIBUTOR_ABI, functionName: 'updateRoot',
    args: [root, fundAmount], account: keeper.account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`[keeper] updateRoot reverted: ${hash}`);
  console.log(`[keeper] posted reward root ${root} (funded $${fundUsdUi.toFixed(2)}) — ${hash}`);
  return hash;
}

/** Already-claimed cumulative for an account (to compute new deltas). */
export async function claimedOf(account: Address): Promise<bigint> {
  return (await publicClient.readContract({
    address: REWARD_DISTRIBUTOR, abi: REWARD_DISTRIBUTOR_ABI, functionName: 'claimed', args: [account],
  })) as bigint;
}

export { PLEX_DECIMALS };
