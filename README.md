# Plexus

**Uncensored, private, decentralized AI inference — settled on BNB Chain.**

Plexus is a DePIN inference network where the GPUs are contributed, not rented.
Anyone can plug a machine in and earn `$PLEX`/USDC for the tokens it serves; anyone
can run a model through an OpenAI-compatible API without an account gate, without
their prompts being logged, and without a content filter deciding what they're
allowed to ask. The network is coordinated by a thin orchestrator and settled
on **BNB Chain (BSC)** through the **`$PLEX`** token.

Three pillars — every feature is measured against all three:

- **Uncensored** — the only hard line is illegal content (CSAM). No model-level refusal layer.
- **Private** — prompts and generated images are never persisted. The only thing stored is the
  credit transaction needed to bill the job.
- **Decentralized** — inference runs on contributor GPUs (browser via WebGPU, or native), not on
  centralized infra. Payouts settle on-chain on BSC.

---

## How it works

```
  user / API client
        │  prompt
        ▼
  ┌───────────────┐      job          ┌──────────────────────┐
  │  web + API    │ ───────────────▶  │  orchestrator (ws)   │
  │  (Next.js)    │                   │  routing, billing,    │
  │  credits,     │ ◀───────────────  │  anti-cheat, payouts  │
  │  auth (Privy) │   streamed tokens └──────────┬───────────┘
  └───────────────┘                              │ dispatch
                                                 ▼
                                    ┌─────────────────────────┐
                                    │  contributor GPU workers │
                                    │  browser (WebGPU) /      │
                                    │  native pipeline-parallel│
                                    └─────────────────────────┘

  $PLEX keeper ── reads treasury budget ─▶ buyback + burn (PancakeSwap)  +  USDC staker rewards (Merkle)
```

- **Web + API** (Next.js) — chat UI, image generation, credits, staking dashboard, OpenAI-compatible REST API.
- **Orchestrator** — a WebSocket server that queues jobs, routes to the fastest idle worker, deducts
  credits before dispatch, streams tokens back, and runs worker anti-cheat.
- **Workers** — the agent a contributor runs to serve inference (browser WebGPU or native).
- **Keeper** (`src/lib/keeper/`) — a scheduled job that runs the daily **buyback+burn** of `$PLEX` on
  PancakeSwap and distributes USDC staker rewards via a Merkle epoch.
- **On-chain** (`contracts/`) — `$PLEX` token, staking, reward distributor, and buyback, all on BSC.

## Settlement layer (this repo's focus)

The product layer (API, orchestrator, anti-cheat, UI) is chain-agnostic. This repo implements the
part that is BNB-specific:

| Piece | Contract / module |
| --- | --- |
| `$PLEX` BEP-20 token (burnable, fixed supply) | [`contracts/src/PlexusToken.sol`](contracts/src/PlexusToken.sol) |
| Self-custody staking — per-lot 24h maturity, LIFO unstake, worker boost | [`contracts/src/Staking.sol`](contracts/src/Staking.sol) |
| Per-epoch USDC staker rewards (cumulative Merkle claims) | [`contracts/src/RewardDistributor.sol`](contracts/src/RewardDistributor.sol) |
| Atomic buyback + burn via PancakeSwap | [`contracts/src/Buyback.sol`](contracts/src/Buyback.sol) |
| viem clients + addresses | [`src/lib/chain.ts`](src/lib/chain.ts) |
| Custodial deposit wallets (AES-256-GCM) | [`src/lib/wallets.ts`](src/lib/wallets.ts) |
| Treasury USDC payout + deposit sweeps | [`src/lib/payout.ts`](src/lib/payout.ts) |
| On-chain stake reads + worker share | [`src/lib/staking.ts`](src/lib/staking.ts) |
| Keeper: buyback + Merkle reward epoch | [`src/lib/keeper/`](src/lib/keeper/) |

Full design + the line-by-line migration map: [`docs/SPEC.md`](docs/SPEC.md).

## Running it

```bash
npm install
cp .env.example .env            # fill in the values
npm test                        # merkle tree ↔ Solidity verifier parity
npm run demo:slice              # end-to-end thin slice (mocked inference, BNB billing seams)

# contracts (Foundry)
cd contracts && ./install.sh    # fetch OZ + forge-std
forge test -vvv                 # staking + reward distributor suites
```

| script | what it runs |
| --- | --- |
| `npm run demo:slice` | API → orchestrator → worker → BNB credit deduction, fully local |
| `npm test` | Merkle parity tests (off-chain root accepted on-chain) |
| `npm run keeper` | one keeper cycle (buyback+burn + reward epoch); dry-run by default |
| `npm run contracts:test` | Foundry contract suite |

## Tech

TypeScript · **viem** (BSC) · Foundry + OpenZeppelin (Solidity 0.8.24) · PancakeSwap V2 · Privy auth
(EVM) · Next.js/socket.io (product layer, ported separately).

## License

TBD.
