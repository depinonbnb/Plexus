# Plexus — build state

**Concept:** uncensored, private, decentralized AI inference network (DePIN),
settled on BNB Chain. Token: `$PLEX`. Product layer + inference engine reused
chain-agnostically; this repo is the BNB settlement layer.

## Done (this pass)

- **Contracts** (`contracts/src/`) — written, not yet compiled here (Foundry not
  installed in this env):
  - `PlexusToken.sol` — fixed-supply burnable BEP-20.
  - `Staking.sol` — on-chain lots, 24h maturity, LIFO unstake, worker boost.
  - `RewardDistributor.sol` — cumulative-Merkle USDC reward claims.
  - `Buyback.sol` — atomic USDC→PLEX swap + burn (PancakeSwap V2).
  - Tests: `Staking.t.sol`, `RewardDistributor.t.sol`. Deploy: `script/Deploy.s.sol`.
- **viem adapter layer** (`src/lib/`) — typechecks clean:
  - `chain.ts`, `abi.ts`, `wallets.ts`, `payout.ts`, `staking.ts`, `token-price.ts`,
    `tokenomics.ts`, `keeper/{merkle,buyback,run}.ts`.
- **Tests that run green here:** `npm test` (5 Merkle parity tests vs the Solidity
  verifier convention), `npm run demo:slice` (end-to-end thin slice).
- **Docs:** `README.md`, `docs/SPEC.md` (full Solana→BNB migration map), 3 ADRs.

## Next

1. Install Foundry + run `cd contracts && ./install.sh && forge test` to confirm
   the contract suite (the TS side already verifies Merkle parity).
2. Port the product layer (Next.js API + orchestrator + workers + UI) from the
   source repo, swapping Privy Solana→EVM and pointing the billing seams at
   `src/lib/payout.ts` / `src/lib/staking.ts` (seams demonstrated in
   `tests/thin-slice.ts`).
3. Deploy contracts to BSC testnet, seed a PancakeSwap LP, run the keeper in
   dry-run, then flip `KEEPER_DRY_RUN=false`.
4. Wire a `/v1/rewards/proof` endpoint serving `data/proofs.json` to claimers.

## Invariants to preserve

- Credits deducted **before** dispatch (never serve unpaid work).
- Prompts/images never persisted — only credit deltas.
- Keeper dry-run by default; no money moves until env flip.
- Off-chain Merkle root must match the on-chain leaf encoding (tested).
