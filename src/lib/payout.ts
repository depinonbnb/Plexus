// Treasury-side USDC payout + deposit sweeps on BNB Chain.
//
// Port of the Solana payout module. The worker/staker never signs anything:
// identity is proved by their login (Privy EVM) and the destination is just an
// address they supply. All trust sits on the server holding the treasury key,
// so the withdraw endpoint debits the ledger atomically *before* calling
// sendUsdc(). On EVM there are no ATAs — a USDC transfer is one erc20.transfer.

import { type Address } from 'viem';
import { publicClient, walletFor, loadTreasuryKey, USDC, USDC_DECIMALS, toBase, fromBase } from './chain.js';
import { ERC20_ABI } from './abi.js';
import { decryptSecret } from './wallets.js';

export function isTreasuryConfigured(): boolean {
  return !!process.env.TREASURY_WALLET_KEY;
}

/** Send `amountUsd` USDC from the treasury to `dest`. Returns the tx hash.
 *  Throws on failure so the caller can mark the payout failed + restore balance. */
export async function sendUsdc(dest: Address, amountUsd: number): Promise<`0x${string}`> {
  const { client, account } = walletFor(loadTreasuryKey());
  const hash = await client.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [dest, toBase(amountUsd, USDC_DECIMALS)],
    account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`[payout] USDC transfer reverted: ${hash}`);
  return hash;
}

/** Read the USDC UI balance held by `address`. */
export async function getUsdcBalance(address: Address): Promise<number> {
  const raw = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })) as bigint;
  return fromBase(raw, USDC_DECIMALS);
}

/** Read any ERC20 UI balance held by `address`. */
export async function getTokenUiBalance(token: Address, address: Address, decimals: number): Promise<number> {
  const raw = (await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address],
  })) as bigint;
  return fromBase(raw, decimals);
}

/**
 * Sweep a per-user deposit wallet's entire USDC balance into the treasury.
 * Unlike Solana (where the treasury fee-pays for a key-less deposit wallet),
 * EVM requires the deposit wallet to hold a little BNB for gas. The keeper
 * pre-funds each deposit wallet with dust BNB before sweeping (see keeper).
 * Returns the tx hash, or null if there's nothing to sweep.
 */
export async function sweepDepositUsdc(encryptedSecret: string): Promise<`0x${string}` | null> {
  // The deposit wallet itself signs the transfer (it holds the USDC + dust BNB
  // for gas, pre-funded by the keeper). No co-signing dance like Solana.
  const { client, account } = walletFor(decryptSecret(encryptedSecret));
  const raw = (await publicClient.readContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  })) as bigint;
  if (raw === 0n) return null;

  const treasuryAddr = walletFor(loadTreasuryKey()).account.address;
  const hash = await client.writeContract({
    address: USDC,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [treasuryAddr, raw],
    account,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`[payout] sweep reverted: ${hash}`);
  return hash;
}
