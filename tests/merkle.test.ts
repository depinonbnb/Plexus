// Tests the keeper's Merkle tree against the exact leaf/pair encoding
// RewardDistributor.sol verifies, so an off-chain root + proof will be accepted
// on-chain. Run: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keccak256, encodePacked, type Address, type Hex } from 'viem';
import { buildTree, type Leaf } from '../src/lib/keeper/merkle.js';

const A = '0x0000000000000000000000000000000000000a11' as Address;
const B = '0x0000000000000000000000000000000000000b0b' as Address;
const C = '0x0000000000000000000000000000000000000c0c' as Address;

const hashLeaf = (l: Leaf): Hex => keccak256(encodePacked(['address', 'uint256'], [l.account, l.cumulative]));
const hashPair = (a: Hex, b: Hex): Hex =>
  a.toLowerCase() < b.toLowerCase()
    ? keccak256(encodePacked(['bytes32', 'bytes32'], [a, b]))
    : keccak256(encodePacked(['bytes32', 'bytes32'], [b, a]));

// Local verifier mirroring OpenZeppelin MerkleProof.verify (sorted-pair).
function verify(leaf: Hex, proof: Hex[], root: Hex): boolean {
  let computed = leaf;
  for (const p of proof) computed = hashPair(computed, p);
  return computed === root;
}

test('single-leaf tree: root is the leaf, empty proof verifies', () => {
  const leaves: Leaf[] = [{ account: A, cumulative: 100n }];
  const tree = buildTree(leaves);
  assert.equal(tree.root, hashLeaf(leaves[0]));
  assert.ok(verify(hashLeaf(leaves[0]), tree.proofFor(A), tree.root));
});

test('two-leaf tree: both proofs verify', () => {
  const leaves: Leaf[] = [{ account: A, cumulative: 100n }, { account: B, cumulative: 50n }];
  const tree = buildTree(leaves);
  for (const l of leaves) {
    assert.ok(verify(hashLeaf(l), tree.proofFor(l.account), tree.root), `proof for ${l.account}`);
  }
});

test('odd (three) leaves: all proofs verify (carry-up of unpaired node)', () => {
  const leaves: Leaf[] = [
    { account: A, cumulative: 100n },
    { account: B, cumulative: 50n },
    { account: C, cumulative: 25n },
  ];
  const tree = buildTree(leaves);
  for (const l of leaves) {
    assert.ok(verify(hashLeaf(l), tree.proofFor(l.account), tree.root), `proof for ${l.account}`);
  }
});

test('deterministic: same leaves in any order → same root', () => {
  const l1: Leaf[] = [{ account: A, cumulative: 1n }, { account: B, cumulative: 2n }, { account: C, cumulative: 3n }];
  const l2: Leaf[] = [l1[2], l1[0], l1[1]];
  assert.equal(buildTree(l1).root, buildTree(l2).root);
});

test('tampered cumulative does not verify against the root', () => {
  const leaves: Leaf[] = [{ account: A, cumulative: 100n }, { account: B, cumulative: 50n }];
  const tree = buildTree(leaves);
  const forged = hashLeaf({ account: A, cumulative: 999n });
  assert.equal(verify(forged, tree.proofFor(A), tree.root), false);
});
