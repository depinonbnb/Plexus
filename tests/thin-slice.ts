// Thin end-to-end slice: OpenAI-compatible request → orchestrator credit gate →
// worker dispatch → BNB-settled billing, all in one file with mocked inference
// and an in-memory credit ledger. Proves the control flow the full network
// implements, without needing a live chain, GPU, or DB.
//
// Run: npm run demo:slice
//
//   client ──/v1/chat/completions──▶ orchestrator
//                                      ├─ check credits (USD ledger, funded by USDC deposit)
//                                      ├─ pick fastest idle worker
//                                      ├─ deduct credits BEFORE dispatch
//                                      ├─ stream tokens back
//                                      └─ credit worker's earnings (70% / 80% if staked)
//
// The chain touch-points (deposit→credits, worker payout, staker boost) are the
// exact seams where lib/payout.ts, lib/staking.ts and the keeper plug in.

import { CREDITS_PER_USD, WORKER_REVENUE_SHARE, WORKER_STAKED_REVENUE_SHARE } from '../src/lib/tokenomics.js';

// ── in-memory ledgers (the real network: SQLite + on-chain settlement) ──
const userCredits = new Map<string, number>(); // user -> credits (1 credit = $0.01)
const workerEarningsUsd = new Map<string, number>(); // worker -> USD owed (paid via sendUsdc)

interface Worker {
  id: string;
  tokensPerSec: number;
  busy: boolean;
  stakedAndMatured: boolean; // from Staking.hasWorkerBoost() on-chain
}
const workers: Worker[] = [
  { id: 'worker-a', tokensPerSec: 40, busy: false, stakedAndMatured: true },
  { id: 'worker-b', tokensPerSec: 25, busy: false, stakedAndMatured: false },
];

// A USDC deposit credits the user (lib/payout sweeps the deposit wallet, then
// the orchestrator credits CREDITS_PER_USD per $1).
function creditFromUsdcDeposit(user: string, usd: number): void {
  userCredits.set(user, (userCredits.get(user) ?? 0) + usd * CREDITS_PER_USD);
}

// Mocked inference — the real path streams from a contributor GPU (shard engine).
async function* mockInference(prompt: string, tps: number): AsyncGenerator<string> {
  const out = `echo(${prompt.slice(0, 24)}): the network served this without logging your prompt.`;
  for (const tok of out.split(' ')) {
    await new Promise((r) => setTimeout(r, Math.max(1, Math.floor(1000 / tps / 5))));
    yield tok + ' ';
  }
}

interface ChatRequest { user: string; model: string; content: string; }

async function handleChatCompletion(req: ChatRequest): Promise<{ ok: boolean; text?: string; error?: string }> {
  // 1. price the job (flat demo price: 8 credits = $0.08)
  const COST_CREDITS = 8;
  const have = userCredits.get(req.user) ?? 0;
  if (have < COST_CREDITS) return { ok: false, error: 'insufficient_credits' };

  // 2. pick the fastest idle worker
  const worker = workers.filter((w) => !w.busy).sort((a, b) => b.tokensPerSec - a.tokensPerSec)[0];
  if (!worker) return { ok: false, error: 'no_worker_available' };

  // 3. deduct credits BEFORE dispatch (never serve unpaid work)
  userCredits.set(req.user, have - COST_CREDITS);
  worker.busy = true;

  // 4. stream tokens
  let text = '';
  try {
    for await (const tok of mockInference(req.content, worker.tokensPerSec)) text += tok;
  } finally {
    worker.busy = false;
  }

  // 5. credit the worker's revenue share (boosted if their stake is matured)
  const usd = COST_CREDITS / CREDITS_PER_USD;
  const share = worker.stakedAndMatured ? WORKER_STAKED_REVENUE_SHARE : WORKER_REVENUE_SHARE;
  workerEarningsUsd.set(worker.id, (workerEarningsUsd.get(worker.id) ?? 0) + usd * share);

  return { ok: true, text: text.trim() };
}

async function main() {
  console.log('— Plexus thin slice —\n');
  creditFromUsdcDeposit('alice', 1.0); // $1 USDC deposit → 100 credits
  console.log(`alice deposited $1.00 USDC → ${userCredits.get('alice')} credits\n`);

  for (let i = 1; i <= 3; i++) {
    const res = await handleChatCompletion({ user: 'alice', model: 'plexus', content: `prompt #${i} about entropy` });
    console.log(`req#${i}:`, res.ok ? `OK — "${res.text}"` : `FAIL — ${res.error}`);
    console.log(`        alice credits left: ${userCredits.get('alice')}`);
  }

  console.log('\nworker earnings (USD owed, paid out via sendUsdc on BNB):');
  for (const [id, usd] of workerEarningsUsd) {
    const w = workers.find((x) => x.id === id)!;
    console.log(`  ${id}: $${usd.toFixed(4)} (${w.stakedAndMatured ? '80% staked-boost' : '70% base'})`);
  }
  console.log('\nNote: no prompt was persisted. Only the credit deltas are stored.');
}

main();
