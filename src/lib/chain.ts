// BNB Chain clients + addresses for Plexus. The single place chain config lives.
//
// Replaces the Solana Connection/RPC layer. viem gives us a read-only
// publicClient and a treasury/keeper walletClient. Everything money-moving on
// the server goes through here.

import { createPublicClient, createWalletClient, http, type Address } from 'viem';
import { bsc, bscTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const TESTNET = (process.env.PLEXUS_NETWORK || 'mainnet').toLowerCase() === 'testnet';

export const chain = TESTNET ? bscTestnet : bsc;

export const RPC_URL =
  process.env.BSC_RPC_URL ||
  (TESTNET ? 'https://data-seed-prebsc-1-s1.bnbchain.org:8545' : 'https://bsc-dataseed.bnbchain.org');

export const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });

// ── canonical BSC addresses (override via env per network) ──
export const USDC: Address = (process.env.USDC_ADDRESS ||
  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d') as Address; // BSC USDC, 18 decimals
export const USDC_DECIMALS = Number(process.env.USDC_DECIMALS || 18); // BSC USDC is 18, not 6
export const PANCAKE_ROUTER: Address = (process.env.PANCAKE_ROUTER ||
  '0x10ED43C718714eb63d5aA57B78B54704E256024E') as Address; // PancakeSwap V2 router

// Plexus contracts (set after deploy).
export const PLEX_TOKEN = (process.env.PLEX_TOKEN_ADDRESS || '') as Address;
export const STAKING = (process.env.STAKING_ADDRESS || '') as Address;
export const REWARD_DISTRIBUTOR = (process.env.REWARD_DISTRIBUTOR_ADDRESS || '') as Address;
export const BUYBACK = (process.env.BUYBACK_ADDRESS || '') as Address;
export const PLEX_DECIMALS = 18;

export function isLaunched(): boolean {
  return PLEX_TOKEN.length === 42;
}

/** A signing client for a server-held key (treasury or keeper). */
export function walletFor(privateKey: `0x${string}`) {
  const account = privateKeyToAccount(privateKey);
  return {
    account,
    client: createWalletClient({ account, chain, transport: http(RPC_URL) }),
  };
}

export function loadTreasuryKey(): `0x${string}` {
  const raw = process.env.TREASURY_WALLET_KEY;
  if (!raw) throw new Error('[chain] TREASURY_WALLET_KEY not set');
  const k = raw.trim();
  return (k.startsWith('0x') ? k : `0x${k}`) as `0x${string}`;
}

export function loadKeeperKey(): `0x${string}` {
  const raw = process.env.KEEPER_WALLET_KEY || process.env.TREASURY_WALLET_KEY;
  if (!raw) throw new Error('[chain] KEEPER_WALLET_KEY not set');
  const k = raw.trim();
  return (k.startsWith('0x') ? k : `0x${k}`) as `0x${string}`;
}

// ── base-unit helpers (replace Solana's toBase/fromBase) ──
export const toBase = (ui: number, decimals: number): bigint =>
  BigInt(Math.round(ui * 10 ** decimals));
export const fromBase = (raw: bigint, decimals: number): number =>
  Number(raw) / 10 ** decimals;
