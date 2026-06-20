# Plexus — Specification & Migration Map

## 0. Thesis

Rebuild an uncensored, private, decentralized AI inference network on **BNB Chain**.
The product (OpenAI-compatible API, credit billing, worker anti-cheat, streaming,
UI) and the inference engine (pipeline-parallel GPU serving over WAN, speculative
decoding) are **chain-agnostic** and reused as-is. Only the **settlement layer**
is BNB-specific, and that is what this repo implements.

Three pillars, unchanged: **Uncensored**, **Private**, **Decentralized**.

## 1. Architecture

```
            ┌──────────── chain-agnostic (reused) ────────────┐
 client ─▶  │ web + OpenAI API ─▶ orchestrator ─▶ GPU workers │
            │  (Next.js, Privy)    (ws, billing,    (WebGPU /  │
            │                       anti-cheat)      native)   │
            └─────────────────────────┬───────────────────────┘
                                      │ USD credit deltas
            ┌─────────────────────────▼───────────────────────┐
            │            BNB settlement layer (this repo)      │
            │  PlexusToken · Staking · RewardDistributor ·     │
            │  Buyback   +   viem adapters   +   keeper        │
            └─────────────────────────────────────────────────┘
```

A request's lifecycle: client hits the OpenAI-compatible API → orchestrator
checks the user's USD credit balance → deducts credits **before** dispatch →
routes to the fastest idle worker → streams tokens → credits the worker's
revenue share (70%, or 80% if their `$PLEX` stake is matured ≥ 24h). USDC deposits
buy credits; worker/staker payouts and the daily buyback settle on BSC.

## 2. Solana → BNB migration map

The original settled on Solana. Every Solana-specific primitive has a BNB
equivalent. This is the exhaustive mapping.

| Concern | Original (Solana) | Plexus (BNB Chain) |
| --- | --- | --- |
| Token | SPL Token-2022 mint, 6 decimals, pump.fun launch | `PlexusToken` BEP-20, 18 decimals, PancakeSwap LP |
| Stable | USDC (classic SPL), 6 dec | USDC (BEP-20), **18 dec on BSC** — note the decimals change |
| RPC / client | `@solana/web3.js` `Connection` | `viem` `publicClient` over a BSC RPC |
| Server signing | `Keypair` + `sendAndConfirmTransaction` | `viem` `walletClient` + `writeContract` |
| Token accounts | ATAs, derived per (owner, mint), rent | none — ERC20 `balanceOf(address)` directly |
| Custodial wallets | ed25519 `Keypair`, AES-256-GCM | secp256k1 private key, **same** AES-256-GCM format |
| Deposit sweep | treasury fee-pays, deposit wallet co-signs (no SOL) | deposit wallet self-signs; keeper pre-funds dust BNB for gas |
| Staking | off-chain DB lots + on-chain SPL program (PDA vaults) | **all on-chain** in `Staking.sol` (lots + maturity + boost) |
| Lot maturity (24h) | tracked in SQLite + replayed from vault history | native in the contract (`since` per lot, `STAKE_MIN_AGE`) |
| LIFO unstake | DB transaction, youngest-first | contract pops youngest lots first |
| Worker boost | DB `getWorkerRevenueShare` over matured stake | `Staking.hasWorkerBoost(user, threshold)` view |
| Staker rewards | keeper funds each user's reward-vault PDA (N txs) | `RewardDistributor` cumulative Merkle root (1 tx/epoch) |
| Reward claim | rewards program instruction, user signs | `RewardDistributor.claim(cumulative, proof)` |
| Buyback budget | pump.fun **creator fees** (USDC) | treasury USDC budget (compute margin + LP/treasury fee share) |
| Buy ZERO | PumpSwap SDK swap, measure delta | PancakeSwap V2 router, inside `Buyback.sol` |
| Burn | separate `burnChecked` tx (buy/burn race) | **atomic** swap+burn in one tx (race eliminated) |
| Price feed | Solana price source | DexScreener BSC pair (`getPlexUsdPrice`) |
| Auth | Privy (X login, Solana embedded wallet) | Privy (X login, **EVM** embedded wallet) — same product |

### Design deltas (intentional improvements, not just translation)

1. **Staking is fully on-chain.** The original split stake state between a SQLite
   DB (custodial) and an SPL program (self-custody) during a migration. We skip
   that history: `Staking.sol` is the single source of truth, so the server only
   *reads* maturity — no lot bookkeeping, no resync bugs, no timer-reset class of
   failures.
2. **Rewards are a cumulative Merkle distributor**, not per-user vault funding.
   On Solana the keeper sent one funding tx per staker; on EVM that is N× gas
   every epoch. A cumulative root is one tx per epoch regardless of staker count,
   and `claimed[account]` makes double-claims impossible. Off-chain Merkle build
   uses the exact leaf encoding the contract verifies (`merkle.ts`), tested for
   parity in `tests/merkle.test.ts`.
3. **Buyback+burn is atomic.** `Buyback.sol` swaps USDC→PLEX and burns the
   measured balance delta in one transaction, so there is no window where bought
   PLEX sits unburned — the exact failure the original guarded against with
   polling and retries.

## 3. Contracts

### `PlexusToken.sol`
Fixed-supply, burnable BEP-20. Whole supply minted once to the treasury at
construction (seeds the PancakeSwap LP + treasury). No mint authority after — so
supply only decreases as the keeper burns. Buy+burn deflation, identical intent
to the original `$ZERO`.

### `Staking.sol`
Self-custody PLEX staking. Each top-up is a **lot** `{amount, since}`. Only lots
older than `STAKE_MIN_AGE` (24h) count as matured. `unstake` consumes the
youngest lots first (LIFO), preserving aged stake. Views the keeper reads:
`maturedStakeOf`, `nextMatureAt`, `hasWorkerBoost`, `lotsOf`. No server key ever
moves a user's stake.

### `RewardDistributor.sol`
Cumulative-Merkle USDC payouts. Each epoch the keeper posts a root over
`(account, cumulativeAmount)` leaves and funds the new delta. Stakers claim the
difference between their cumulative leaf and `claimed[account]`. Owner = keeper.

### `Buyback.sol`
Holds the USDC buyback budget; `buybackAndBurn(usdcIn, minPlexOut, deadline)`
swaps on PancakeSwap and burns the exact PLEX received. Owner = keeper.

## 4. Money flow (unchanged economics)

```
 compute margin (30%) ── 100% ──▶ buyback pool
 trading fees ─────────── 35% ──▶ buyback pool   (65% → treasury profit)
 buyback pool ── 50% ─▶ buy + burn $PLEX (PancakeSwap)
              └─ 50% ─▶ USDC staker rewards (pro-rata by matured stake, Merkle)
```

Splits live in `src/lib/tokenomics.ts` (`POOL_BURN_SPLIT`,
`TRADING_FEE_TO_POOL_PCT`, …) — env-tunable, same defaults as the original.

## 5. Keeper cycle (`src/lib/keeper/run.ts`)

1. Size the buyback pool from the treasury USDC budget.
2. Split `POOL_BURN_SPLIT` : rest between buy+burn and stakers.
3. `buybackAndBurn(burnHalf)` — atomic on-chain.
4. Discover stakers from `Staked` events → read `maturedStakeOf` for each →
   split the staker half pro-rata → add to each account's cumulative total →
   build the Merkle tree → `updateRoot(root, delta)` and fund the delta.
5. Persist proofs (`data/proofs.json`) for the web/API to serve to claimers.

Dry-run by default (`KEEPER_DRY_RUN !== 'false'`) — nothing moves until a human
flips the env, same safety posture as the original.

## 6. Privacy posture (carried over, honestly)

Prompts/images are never persisted; only credit deltas are stored. For the
multi-node inference engine, intermediate activations can leak a fraction of a
user's tokens to a malicious node — the mitigation plan (pin leaky boundary
layers to trusted/staked nodes, per-request trusted routing, never overclaim) is
inherited from the engine layer and is the number-one open problem. "Private"
earns its word as hardening lands; it is not asserted on day one.

## 7. Out of scope for this repo (reused as-is)

OpenAI-compatible API surface, orchestrator routing/anti-cheat, worker runtime,
web UI, the pipeline-parallel inference engine. These are ported wholesale from
the product layer with only the auth/wallet calls swapped Solana→EVM and the
billing seams pointed at the modules here (see `tests/thin-slice.ts` for the seams).
