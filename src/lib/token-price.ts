// Token pricing for credit deposits. Deposits are USDC-only (pegged $1). PLEX
// spot price (for staking-dashboard display + buyback sizing) comes from the
// PancakeSwap pool via DexScreener — the BSC analogue of the Solana price feed.

import { USDC, PLEX_TOKEN } from './chain.js';

export type DepositTokenKind = 'USDC';

export interface DepositToken {
  address: string;
  kind: DepositTokenKind;
}

export function getConfiguredDepositTokens(): DepositToken[] {
  return [{ address: USDC, kind: 'USDC' }];
}

/** USD price of one whole token. USDC is pegged at $1; anything else → null so
 *  the caller skips crediting (deposits are USDC-only). */
export async function getTokenUsdPrice(address: string): Promise<number | null> {
  return address.toLowerCase() === USDC.toLowerCase() ? 1 : null;
}

/** PLEX spot price in USD from the DexScreener pair feed (BSC). null if the
 *  token isn't launched or the feed is unavailable — callers degrade gracefully. */
export async function getPlexUsdPrice(): Promise<number | null> {
  if (PLEX_TOKEN.length !== 42) return null;
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${PLEX_TOKEN}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { pairs?: { chainId: string; priceUsd?: string }[] };
    const bscPair = data.pairs?.find((p) => p.chainId === 'bsc' && p.priceUsd);
    return bscPair?.priceUsd ? Number(bscPair.priceUsd) : null;
  } catch {
    return null;
  }
}
