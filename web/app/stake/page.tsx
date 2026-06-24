'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  createPublicClient, createWalletClient, custom, http, formatUnits, parseUnits, type Address,
} from 'viem';
import { CHAIN, ADDR, LAUNCHED, PLEX_DECIMALS, ERC20_ABI, STAKING_ABI, shortAddr } from '@/lib/contracts';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };
function getEth(): Eth | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ethereum?: Eth }).ethereum ?? null;
}

const viemChain = {
  id: CHAIN.id,
  name: CHAIN.name,
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: [CHAIN.rpc] } },
} as const;

const publicClient = createPublicClient({ chain: viemChain, transport: http(CHAIN.rpc) });
const fmt = (v: bigint) => Number(formatUnits(v, PLEX_DECIMALS)).toLocaleString(undefined, { maximumFractionDigits: 4 });

export default function StakePage() {
  const [account, setAccount] = useState<Address | null>(null);
  const [wallet, setWallet] = useState('');
  const [staked, setStaked] = useState(0n);
  const [matured, setMatured] = useState(0n);
  const [nextAt, setNextAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0n);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const cooling = useMemo(() => (staked > matured ? staked - matured : 0n), [staked, matured]);

  const refresh = useCallback(async (who?: Address) => {
    if (!LAUNCHED) return;
    try {
      const t = (await publicClient.readContract({ address: ADDR.staking as Address, abi: STAKING_ABI, functionName: 'totalStaked' })) as bigint;
      setTotal(t);
      const target = who ?? account;
      if (target) {
        const [s, m, n, w] = await Promise.all([
          publicClient.readContract({ address: ADDR.staking as Address, abi: STAKING_ABI, functionName: 'stakedOf', args: [target] }) as Promise<bigint>,
          publicClient.readContract({ address: ADDR.staking as Address, abi: STAKING_ABI, functionName: 'maturedStakeOf', args: [target] }) as Promise<bigint>,
          publicClient.readContract({ address: ADDR.staking as Address, abi: STAKING_ABI, functionName: 'nextMatureAt', args: [target] }) as Promise<bigint>,
          publicClient.readContract({ address: ADDR.plex as Address, abi: ERC20_ABI, functionName: 'balanceOf', args: [target] }) as Promise<bigint>,
        ]);
        setStaked(s); setMatured(m); setNextAt(n > 0n ? Number(n) * 1000 : null); setWallet(fmt(w));
      }
    } catch (e) {
      setMsg({ kind: 'err', text: `read failed: ${(e as Error).message.slice(0, 120)}` });
    }
  }, [account]);

  useEffect(() => { refresh(); }, [refresh]);

  async function connect() {
    const eth = getEth();
    if (!eth) { setMsg({ kind: 'err', text: 'No EVM wallet found. Install MetaMask or a BSC-compatible wallet.' }); return; }
    try {
      const accs = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const a = accs[0] as Address;
      setAccount(a);
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: `0x${CHAIN.id.toString(16)}` }] }).catch(() => {});
      refresh(a);
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  }

  async function writeStaking(fn: 'stake' | 'unstake') {
    const eth = getEth();
    if (!eth || !account) return;
    if (!amount || Number(amount) <= 0) { setMsg({ kind: 'err', text: 'enter an amount' }); return; }
    const wc = createWalletClient({ account, chain: viemChain, transport: custom(eth) });
    const value = parseUnits(amount, PLEX_DECIMALS);
    try {
      setBusy(fn);
      if (fn === 'stake') {
        setMsg({ kind: 'info', text: 'approving $PLEX…' });
        const allowance = (await publicClient.readContract({ address: ADDR.plex as Address, abi: ERC20_ABI, functionName: 'allowance', args: [account, ADDR.staking as Address] })) as bigint;
        if (allowance < value) {
          const ah = await wc.writeContract({ address: ADDR.plex as Address, abi: ERC20_ABI, functionName: 'approve', args: [ADDR.staking as Address, value] });
          await publicClient.waitForTransactionReceipt({ hash: ah });
        }
      }
      setMsg({ kind: 'info', text: `${fn} pending…` });
      const hash = await wc.writeContract({ address: ADDR.staking as Address, abi: STAKING_ABI, functionName: fn, args: [value] });
      await publicClient.waitForTransactionReceipt({ hash });
      setMsg({ kind: 'ok', text: `${fn} confirmed` });
      setAmount('');
      refresh();
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message.slice(0, 140) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-3 w-3 rounded-full bg-plex shadow-[0_0_16px_4px_rgba(34,211,168,0.5)]" />
          plexus
        </Link>
        {account ? (
          <span className="rounded-lg border border-edge bg-panel px-3 py-2 text-xs text-white/70">{shortAddr(account)}</span>
        ) : (
          <button onClick={connect} className="rounded-lg bg-plex px-4 py-2 text-sm font-semibold text-ink hover:brightness-110">
            Connect wallet
          </button>
        )}
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Stake $PLEX</h1>
      <p className="mt-2 text-sm text-white/55">
        Lock $PLEX to earn a daily USDC cut of network profit. Each deposit matures over 24h before it earns;
        unstaking burns the youngest deposits first, so aged stake keeps earning.
      </p>

      {!LAUNCHED && (
        <div className="card mt-6 border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-300/90">
          Contracts aren&apos;t deployed yet — the dashboard is live but read/write activate once
          $PLEX ships on {CHAIN.name}. Everything below is wired and ready.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          ['Your stake', `${fmt(staked)}`],
          ['Matured (earning)', `${fmt(matured)}`],
          ['Cooling (<24h)', `${fmt(cooling)}`],
          ['Network total', `${fmt(total)}`],
        ].map(([k, v]) => (
          <div key={k} className="card p-4">
            <div className="text-xs text-white/45">{k}</div>
            <div className="mt-1 text-lg font-semibold text-white">{v}</div>
          </div>
        ))}
      </div>

      {nextAt && (
        <div className="mt-3 text-xs text-white/50">
          next deposit matures: {new Date(nextAt).toLocaleString()}
        </div>
      )}

      <div className="card mt-6 p-6">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-white/70">Amount ($PLEX)</span>
          <span className="text-white/40">wallet: {account ? wallet : '—'}</span>
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
          placeholder="0.0"
          inputMode="decimal"
          className="w-full rounded-lg border border-edge bg-ink px-4 py-3 text-lg outline-none focus:border-plex/50"
        />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={!account || !LAUNCHED || busy !== null}
            onClick={() => writeStaking('stake')}
            className="rounded-lg bg-plex px-4 py-3 text-sm font-semibold text-ink hover:brightness-110 disabled:opacity-40"
          >
            {busy === 'stake' ? 'staking…' : 'Stake'}
          </button>
          <button
            disabled={!account || !LAUNCHED || busy !== null}
            onClick={() => writeStaking('unstake')}
            className="rounded-lg border border-edge bg-panel px-4 py-3 text-sm font-medium text-white/85 hover:border-white/30 disabled:opacity-40"
          >
            {busy === 'unstake' ? 'unstaking…' : 'Unstake'}
          </button>
        </div>
        {msg && (
          <div
            className={`mt-4 rounded-lg px-3 py-2 text-xs ${
              msg.kind === 'ok' ? 'bg-plex/10 text-plex' : msg.kind === 'err' ? 'bg-red-500/10 text-red-300' : 'bg-white/5 text-white/60'
            }`}
          >
            {msg.text}
          </div>
        )}
      </div>

      <div className="mt-6 text-center text-xs text-white/40">
        {CHAIN.name} · <a className="hover:text-white" href={CHAIN.explorer} target="_blank" rel="noreferrer">{new URL(CHAIN.explorer).host}</a>
      </div>
    </main>
  );
}
