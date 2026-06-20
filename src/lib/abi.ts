// Minimal ABIs for the Plexus contracts + ERC20, as viem const tuples.

export const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const STAKING_ABI = [
  { type: 'function', name: 'stakedOf', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'maturedStakeOf', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'nextMatureAt', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'hasWorkerBoost', stateMutability: 'view', inputs: [{ name: 'user', type: 'address' }, { name: 'threshold', type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'totalStaked', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'stake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'unstake', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
] as const;

export const REWARD_DISTRIBUTOR_ABI = [
  { type: 'function', name: 'updateRoot', stateMutability: 'nonpayable', inputs: [{ name: 'root', type: 'bytes32' }, { name: 'fundAmount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [{ name: 'cumulativeAmount', type: 'uint256' }, { name: 'proof', type: 'bytes32[]' }], outputs: [] },
  { type: 'function', name: 'claimed', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'epoch', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

export const BUYBACK_ABI = [
  { type: 'function', name: 'buybackAndBurn', stateMutability: 'nonpayable', inputs: [{ name: 'usdcIn', type: 'uint256' }, { name: 'minPlexOut', type: 'uint256' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
] as const;

export const PANCAKE_ROUTER_ABI = [
  { type: 'function', name: 'getAmountsOut', stateMutability: 'view', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'path', type: 'address[]' }], outputs: [{ name: 'amounts', type: 'uint256[]' }] },
] as const;
