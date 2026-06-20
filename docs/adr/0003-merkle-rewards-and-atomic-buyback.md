# ADR 0003 — Cumulative-Merkle rewards + atomic buyback-and-burn

## Status
Accepted

## Context
Two keeper actions move money each epoch: pay stakers their USDC share, and
buy+burn the token.

The source paid stakers by funding each staker's reward-vault PDA — one
transaction per staker per epoch. On EVM that is N transfers' worth of gas every
day; at scale it dominates keeper cost. The source also bought the token and
burned it in two separate transactions, and carried elaborate polling to handle
the window where a confirmed buy's output couldn't be measured before the burn
(a real incident: bought-but-unburned tokens).

## Decision
1. **Rewards → cumulative Merkle distributor.** The keeper posts one root per
   epoch over `(account, cumulativeAmount)` leaves and funds only the new delta.
   Stakers claim `cumulative − claimed[account]`. Off-chain tree (`merkle.ts`)
   uses the identical leaf/sorted-pair encoding the contract verifies, with a
   parity test (`tests/merkle.test.ts`).
2. **Buyback → atomic.** `Buyback.sol` swaps USDC→PLEX and burns the measured
   balance delta in a single transaction.

## Consequences
- Reward gas is O(1) on-chain per epoch (one `updateRoot`) instead of O(stakers).
- Stakers who miss epochs still claim everything owed in one tx (cumulative).
- The buy/burn race is structurally impossible — no polling, no unburned-token
  incident class.
- The keeper must serve Merkle proofs to claimers (`data/proofs.json`); the web/API
  exposes them. This is the one new piece of off-chain infrastructure the model adds.
