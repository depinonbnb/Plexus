# ADR 0002 — Staking lives fully on-chain

## Status
Accepted

## Context
The source tracked stake in two places at once during a custodial→self-custody
migration: a SQLite DB (per-deposit lots, 24h maturity, LIFO unstake) and an SPL
staking program (vaults). Keeping the two in sync required a resync loop and was
the source of a class of bugs (timer resets, RPC-429 false-zeroing a user's
stake, double-counting migrated lots).

On EVM we have a clean slate — no migration history to preserve.

## Decision
Put **all** staking state and rules in `Staking.sol`: lots `{amount, since}`,
`STAKE_MIN_AGE` maturity, LIFO unstake, and the worker-boost threshold check. The
server only **reads** the contract (`maturedStakeOf`, `hasWorkerBoost`,
`nextMatureAt`). There is no off-chain lot bookkeeping.

## Consequences
- Single source of truth; the resync/false-zero bug class is structurally gone.
- Gas cost: lot iteration is O(lots) in views (free, off-chain `eth_call`) and in
  unstake (paid). A user with pathologically many tiny lots pays more to unstake —
  acceptable, and bounded in practice by a stake minimum at the UI layer.
- Maturity is enforced by `block.timestamp`, mirrored as `STAKE_MIN_AGE_MS` in
  `tokenomics.ts` so the keeper's epoch math agrees with the contract exactly.
