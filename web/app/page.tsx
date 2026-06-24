import Link from 'next/link';

const GITHUB = 'https://github.com/depinonbnb/Plexus';

function Nav() {
  return (
    <header className="sticky top-0 z-30 border-b border-edge/60 bg-ink/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-3 w-3 rounded-full bg-plex shadow-[0_0_16px_4px_rgba(34,211,168,0.5)]" />
          plexus
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
          <a href="#how" className="hover:text-white">how it works</a>
          <a href="#roles" className="hover:text-white">roles</a>
          <a href="#token" className="hover:text-white">$PLEX</a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-white">github</a>
        </nav>
        <Link
          href="/stake"
          className="rounded-lg border border-plex/40 bg-plex/10 px-4 py-2 text-sm font-medium text-plex hover:bg-plex/20"
        >
          stake $PLEX
        </Link>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mesh-grid absolute inset-0 -z-10 h-[640px]" />
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-20 md:pt-28">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-edge bg-panel/60 px-3 py-1 text-xs text-white/60">
          <span className="h-1.5 w-1.5 animate-pulseglow rounded-full bg-plex" />
          DePIN AI inference · settled on BNB Chain
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Uncensored, private,
          <br />
          <span className="glow-text text-plex">decentralized</span> AI inference.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/65">
          Plexus is an AI network where the GPUs are <span className="text-white">contributed, not rented</span>.
          Run any model through an OpenAI-compatible API — no account gate, no prompt logging, no content
          filter. Contribute a GPU and earn <span className="text-plex">$PLEX</span> for the tokens it serves.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link href="/stake" className="rounded-lg bg-plex px-5 py-3 text-sm font-semibold text-ink hover:brightness-110">
            Launch the dashboard →
          </Link>
          <a
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-edge bg-panel px-5 py-3 text-sm font-medium text-white/80 hover:border-white/30"
          >
            Read the code
          </a>
        </div>

        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['OpenAI-compatible', 'drop-in /v1 API'],
            ['No logs', 'prompts never stored'],
            ['No filter', 'only illegal content blocked'],
            ['On-chain', 'BNB Chain settlement'],
          ].map(([t, s]) => (
            <div key={t} className="card p-4">
              <div className="text-sm font-semibold text-white">{t}</div>
              <div className="mt-1 text-xs text-white/50">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pillars() {
  const items = [
    {
      k: 'Uncensored',
      d: 'The only hard line is illegal content (CSAM). No model-level refusal layer decides what you can ask.',
    },
    {
      k: 'Private',
      d: 'Prompts and generated images are never persisted. The only thing stored is the credit transaction that bills the job.',
    },
    {
      k: 'Decentralized',
      d: 'Inference runs on contributor GPUs — browser (WebGPU) or native — not centralized infra. Payouts settle on-chain.',
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.k} className="card p-6">
            <div className="text-lg font-semibold text-plex">{it.k}</div>
            <p className="mt-3 text-sm leading-relaxed text-white/60">{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
      <p className="mt-3 max-w-2xl text-white/55">
        A thin orchestrator routes each request to the fastest idle GPU, bills credits before dispatch,
        streams tokens back, and pays the worker on-chain. Nothing about your prompt is kept.
      </p>
      <div className="card mt-8 overflow-x-auto p-6">
        <pre className="text-xs leading-relaxed text-white/70 md:text-sm">{`  user / API client
        │  prompt
        ▼
  ┌───────────────┐      job        ┌──────────────────────┐
  │  web + API    │ ─────────────▶  │  orchestrator        │
  │  credits,     │ ◀─────────────  │  routing · billing   │
  │  auth         │  streamed tokens│  anti-cheat · payouts│
  └───────────────┘                 └──────────┬───────────┘
                                               │ dispatch
                                               ▼
                                 ┌─────────────────────────┐
                                 │  contributor GPU workers │
                                 │  browser (WebGPU) /      │
                                 │  native pipeline-parallel│
                                 └─────────────────────────┘

  $PLEX keeper ── buyback + burn (PancakeSwap)  +  USDC staker rewards (Merkle)`}</pre>
      </div>
    </section>
  );
}

function Roles() {
  const roles = [
    { t: 'User', s: 'Top up USDC → get credits → chat or generate. Prompts never saved, nothing off-limits but illegal content.', cta: ['Start building', GITHUB] },
    { t: 'Worker', s: 'Run one app on your GPU and earn for every answer it serves — 70%, or 80% if your stake is matured.', cta: ['Run a worker', GITHUB] },
    { t: 'Staker', s: 'Lock $PLEX, earn a daily USDC cut of network profit, and benefit from the buyback making $PLEX scarcer.', cta: ['Stake $PLEX', '/stake'] },
    { t: 'Developer', s: 'Point any OpenAI client at the Plexus base URL with an sk-plexus key. Same code you already write.', cta: ['API docs', GITHUB] },
  ];
  return (
    <section id="roles" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Four ways to plug in</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.t} className="card flex flex-col p-6">
            <div className="text-lg font-semibold text-white">{r.t}</div>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-white/60">{r.s}</p>
            <Link href={r.cta[1]} className="mt-4 text-sm font-medium text-plex hover:underline">
              {r.cta[0]} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

function Token() {
  return (
    <section id="token" className="mx-auto max-w-6xl px-5 py-16">
      <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
        <span className="text-plex">$PLEX</span> — the network token
      </h2>
      <p className="mt-3 max-w-2xl text-white/55">
        A fixed-supply, burnable BEP-20. Network profit drives a daily buyback that buys $PLEX on PancakeSwap
        and burns it, while stakers earn USDC rewards pro-rata to their matured stake.
      </p>
      <div className="card mt-8 grid gap-px overflow-hidden bg-edge md:grid-cols-2">
        <div className="bg-panel p-6">
          <div className="text-sm font-semibold text-white">Money flow</div>
          <pre className="mt-3 text-xs leading-relaxed text-white/60">{`compute margin ── 100% ─▶ buyback pool
trading fees ──── 35%  ─▶ buyback pool
buyback pool ── 50% ─▶ buy + burn $PLEX
             └─ 50% ─▶ USDC staker rewards`}</pre>
        </div>
        <div className="bg-panel p-6">
          <div className="text-sm font-semibold text-white">On-chain (BNB Chain)</div>
          <ul className="mt-3 space-y-2 text-xs text-white/60">
            <li>• Fixed-supply burnable token — supply only shrinks</li>
            <li>• Self-custody staking: 24h maturity, LIFO unstake, worker boost</li>
            <li>• Cumulative-Merkle USDC rewards — one tx per epoch</li>
            <li>• Atomic buyback-and-burn via PancakeSwap</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-edge/60">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-5 py-10 text-sm text-white/50 md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-plex" />
          plexus · DePIN AI inference on BNB Chain
        </div>
        <div className="flex gap-6">
          <a href={GITHUB} target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          <Link href="/stake" className="hover:text-white">Dashboard</Link>
        </div>
      </div>
    </footer>
  );
}

export default function Home() {
  return (
    <main>
      <Nav />
      <Hero />
      <Pillars />
      <HowItWorks />
      <Roles />
      <Token />
      <Footer />
    </main>
  );
}
