// Cumulative-reward Merkle tree, matching RewardDistributor.sol's leaf encoding:
//   leaf = keccak256(abi.encodePacked(account, uint256 cumulativeAmount))
// Internal nodes hash sorted pairs (keccak256 of the two sorted children), the
// same convention as OpenZeppelin's MerkleProof.verify. Pure + dependency-light
// (viem's keccak256/encodePacked only) so the keeper and any verifier agree.

import { keccak256, encodePacked, type Address, type Hex } from 'viem';

export interface Leaf {
  account: Address;
  cumulative: bigint; // lifetime USDC owed, base units
}

const hashLeaf = (l: Leaf): Hex =>
  keccak256(encodePacked(['address', 'uint256'], [l.account, l.cumulative]));

const hashPair = (a: Hex, b: Hex): Hex =>
  a.toLowerCase() < b.toLowerCase()
    ? keccak256(encodePacked(['bytes32', 'bytes32'], [a, b]))
    : keccak256(encodePacked(['bytes32', 'bytes32'], [b, a]));

export interface MerkleTree {
  root: Hex;
  proofFor: (account: Address) => Hex[];
  leafByAccount: Map<Address, Leaf>;
}

export function buildTree(leaves: Leaf[]): MerkleTree {
  if (leaves.length === 0) {
    return { root: keccak256('0x'), proofFor: () => [], leafByAccount: new Map() };
  }
  // Stable order by account so the tree is deterministic across keeper runs.
  const sorted = [...leaves].sort((x, y) => (x.account.toLowerCase() < y.account.toLowerCase() ? -1 : 1));
  const leafHashes = sorted.map(hashLeaf);

  // Build levels bottom-up, remembering each leaf's path.
  const layers: Hex[][] = [leafHashes];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push(i + 1 < prev.length ? hashPair(prev[i], prev[i + 1]) : prev[i]);
    }
    layers.push(next);
  }

  const indexByAccount = new Map<Address, number>();
  sorted.forEach((l, i) => indexByAccount.set(l.account, i));

  const proofFor = (account: Address): Hex[] => {
    let idx = indexByAccount.get(account);
    if (idx === undefined) return [];
    const proof: Hex[] = [];
    for (let level = 0; level < layers.length - 1; level++) {
      const nodes = layers[level];
      const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
      if (pairIdx < nodes.length) proof.push(nodes[pairIdx]);
      idx = Math.floor(idx / 2);
    }
    return proof;
  };

  return {
    root: layers[layers.length - 1][0],
    proofFor,
    leafByAccount: new Map(sorted.map((l) => [l.account, l])),
  };
}
