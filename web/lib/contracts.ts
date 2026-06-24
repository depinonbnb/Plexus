// Frontend chain config + ABIs. Contract addresses come from NEXT_PUBLIC_* env
// (set in Vercel after the contracts deploy). Until then the dashboard runs in
// "not launched" mode — the full UI is present but read/write are gated.

export const CHAIN = {
  // BSC testnet by default; flip NEXT_PUBLIC_CHAIN_ID to 56 for mainnet.
  id: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97),
  name: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97) === 56 ? 'BNB Smart Chain' : 'BSC Testnet',
  rpc:
    process.env.NEXT_PUBLIC_RPC_URL ||
    (Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97) === 56
      ? 'https://bsc-dataseed.bnbchain.org'
      : 'https://data-seed-prebsc-1-s1.bnbchain.org:8545'),
  explorer: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 97) === 56 ? 'https://bscscan.com' : 'https://testnet.bscscan.com',
};

export const ADDR = {
  plex: (process.env.NEXT_PUBLIC_PLEX_TOKEN || '') as `0x${string}` | '',
  staking: (process.env.NEXT_PUBLIC_STAKING || '') as `0x${string}` | '',
  rewards: (process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR || '') as `0x${string}` | '',
};

export const PLEX_DECIMALS = 18;
export const LAUNCHED = ADDR.staking.length === 42 && ADDR.plex.length === 42;

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'o', type: 'address' }, { name: 's', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const STAKING_ABI = [
  { type: 'function', name: 'stakedOf', stateMutability: 'view', inputs: [{ name: 'u', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maturedStakeOf', stateMutability: 'view', inputs: [{ name: 'u', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'nextMatureAt', stateMutability: 'view', inputs: [{ name: 'u', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'totalStaked', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export function shortAddr(a?: string): string {
  return a && a.length === 42 ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}
