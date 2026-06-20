# ADR 0001 — Port the product layer, rewrite only the settlement layer

## Status
Accepted

## Context
The source network is split into a product/network layer (OpenAI-compatible API,
WebSocket orchestrator with credit billing + worker anti-cheat, contributor
workers, web UI) and an inference engine (pipeline-parallel GPU serving over WAN
with speculative decoding). The product layer and engine are chain-agnostic; only
settlement (token, staking, payouts, buyback) is tied to Solana.

We could (a) rewrite everything fresh for BNB, (b) start contracts-first, or
(c) port the product layer as-is and replace only the chain layer.

## Decision
**(c).** Keep the API, orchestrator, anti-cheat, worker runtime, and UI; isolate
all chain interaction behind a small adapter surface (`src/lib/*`) and implement a
BNB-native version of it (Foundry contracts + viem adapters + keeper).

## Consequences
- Fastest path to a working network — the hard product problems are already solved.
- The blast radius of the chain swap is ~8 modules + 4 contracts, not the whole app.
- The inference engine is untouched (it never knew which chain settled payments).
- We inherit the original's product behavior, including its tested anti-cheat and
  billing-before-dispatch invariant (see `tests/thin-slice.ts`).
