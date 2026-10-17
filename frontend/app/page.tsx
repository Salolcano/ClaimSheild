"use client";
import { useCallback, useEffect, useState } from "react";
import { CONTRACT, EXPLORER, connectWallet, fmt, readJson, send, short, toWei } from "../lib/chain";
import ShieldGauge from "../components/ShieldGauge";
import Donut from "../components/Donut";

type Stats = { owner: string; liquidity: string; reserved: string; free: string; premiums_total: string; paid_total: string; policy_count: number; claim_count: number };
type Policy = { id: number; holder: string; kind: string; subject: string; evidence_url: string; terms: string; premium: string; payout: string; status: string };
type Claim = { id: number; policy_id: number; holder: string; note: string; status: string; verdict: string; reason: string; appeals: number; evaluations: number; denied_at: number };

const PRESETS = [
  { name: "Demo: should pay", kind: "CUSTOM", subject: "2022 World Cup final went to penalties",
    url: "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_final",
    terms: "Pay if the page confirms the 2022 FIFA World Cup final was decided by a penalty shoot-out." },
  { name: "Demo: should deny", kind: "CUSTOM", subject: "Brazil won the 2022 World Cup",
    url: "https://en.wikipedia.org/wiki/2022_FIFA_World_Cup_final",
    terms: "Pay only if the page states that Brazil won the 2022 FIFA World Cup final." },
  { name: "Flight delay", kind: "FLIGHT_DELAY", subject: "Flight XY123 on 2026-11-01",
    url: "https://www.flightaware.com/live/flight/XY123",
    terms: "Pay if the page shows flight XY123 on 2026-11-01 arrived more than 3 hours after its scheduled arrival time." },
  { name: "Shipping delay", kind: "SHIPPING_DELAY", subject: "Parcel 1Z999 delivery",
    url: "https://example.com/track/1Z999",
    terms: "Pay if the tracking page shows the parcel was not delivered within 7 days of the ship date." },
];
const KINDS = ["FLIGHT_DELAY", "SHIPPING_DELAY", "EVENT_CANCELLATION", "CUSTOM"];
const TABS = ["Dashboard", "Get cover", "Claims", "Pool"] as const;

export default function Home() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Dashboard");
  const [account, setAccount] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [form, setForm] = useState({ kind: "CUSTOM", subject: "", url: "", terms: "", payout: "1", premium: "0.1" });
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [amount, setAmount] = useState("1");

  const me = account.toLowerCase();
  const isOwner = !!stats && me === stats.owner.toLowerCase();

  const refresh = useCallback(async () => {
    if (!CONTRACT) return;
    try {
      const [s, p, c] = await Promise.all([readJson<Stats>("get_stats"), readJson<Policy[]>("list_policies"), readJson<Claim[]>("list_claims")]);
      setStats(s); setPolicies(p); setClaims(c);
    } catch (e: any) { setToast({ msg: `Could not read the contract: ${e.shortMessage || e.message}`, err: true }); }
  }, []);

  useEffect(() => { refresh(); const t = setInterval(refresh, 20000); return () => clearInterval(t); }, [refresh]);

  async function connect() {
    try { setAccount(await connectWallet()); } catch (e: any) { setToast({ msg: e.message, err: true }); }
  }
  async function run(label: string, fn: string, args: any[], value = 0n, done = "Done") {
    if (!account) return setToast({ msg: "Connect your wallet first.", err: true });
    setBusy(label); setToast(null);
    try { const r = await send(account, fn, args, value); setToast({ msg: `${done} · tx ${short(r.hash)}` }); await refresh(); }
    catch (e: any) { setToast({ msg: e.shortMessage || e.message, err: true }); }
    finally { setBusy(""); }
  }

  const minPremium = (() => { try { return fmt((toWei(form.payout || "0") * 5n) / 100n); } catch { return "—"; } })();
  const myPolicies = policies.filter((p) => p.holder === me);
  const outcome = (s: string) => claims.filter((c) => c.status === s || (s === "DENIED" && c.status === "DENIED_FINAL")).length;
  const open = claims.filter((c) => ["PENDING", "INCONCLUSIVE"].includes(c.status)).length;

  if (!CONTRACT) return (
    <main className="wrap"><header><div className="brand">ClaimShield</div></header>
      <div className="card"><h3>Set the pool address</h3>
        <p className="muted">Deploy the contract with <code>npm run deploy:contract</code>, then set <code>NEXT_PUBLIC_POOL_ADDRESS</code> in <code>frontend/.env</code> (or in your Vercel project settings) and reload.</p></div></main>
  );

  return (
    <main className="wrap">
      <header>
        <div className="brand">
          <svg viewBox="0 0 26 30"><path d="M13 1 L24 5 V15 C24 22 19 27 13 29 C7 27 2 22 2 15 V5 Z" fill="none" stroke="#F5B544" strokeWidth="2.4" /><path d="M8 15 l4 4 7-8" stroke="#3DDC97" strokeWidth="2.4" fill="none" /></svg>
          ClaimShield
        </div>
        <a className="pill" href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">Pool {short(CONTRACT)}</a>
        <span className="pill ok">Studio Next</span>
        {account ? <span className="pill">{short(account)}{isOwner ? " · owner" : ""}</span> : <button className="btn" onClick={connect}>Connect wallet</button>}
      </header>
      <nav>{TABS.map((t) => <button key={t} aria-current={tab === t} onClick={() => setTab(t)}>{t}</button>)}</nav>

      {tab === "Dashboard" && <>
        <section className="hero">
          <div>
            <h1>Cover that pays when the evidence says so.</h1>
            <p>Buy a policy with plain-English terms and a public evidence page. If something goes wrong, GenLayer validators read the page, agree on a verdict, and the pool pays out on-chain. Denied? Appeal once.</p>
            <div className="chips"><button className="btn" onClick={() => setTab("Get cover")}>Get cover</button><button className="btn ghost" onClick={() => setTab("Claims")}>See claims</button></div>
          </div>
          <ShieldGauge liquidity={Number(stats?.liquidity ?? 0)} reserved={Number(stats?.reserved ?? 0)} label={fmt(stats?.liquidity)} />
        </section>
        <div className="stats">
          {[["Locked behind policies", fmt(stats?.reserved)], ["Free capacity", fmt(stats?.free)], ["Premiums earned", fmt(stats?.premiums_total)],
            ["Paid out", fmt(stats?.paid_total)], ["Policies", stats?.policy_count ?? 0], ["Claims", stats?.claim_count ?? 0]].map(([l, v]) =>
            <div className="card stat" key={l as string}><b>{v}</b><span>{l}</span></div>)}
        </div>
        <div className="grid2">
          <div className="card"><h3>Claim outcomes</h3>
            <Donut slices={[{ label: "Paid", value: outcome("PAID"), color: "#3DDC97" }, { label: "Denied", value: outcome("DENIED"), color: "#FF6B6B" }, { label: "Awaiting verdict", value: open, color: "#6AA7FF" }]} />
            <p className="muted">Payout ratio: {Number(stats?.premiums_total ?? 0) > 0 ? Math.round((Number(stats!.paid_total) / Number(stats!.premiums_total)) * 100) : 0}% of premiums</p></div>
          <div className="card"><h3>Latest verdicts</h3>
            {claims.length === 0 && <div className="empty">No claims yet. Buy a demo policy and file one.</div>}
            {[...claims].reverse().slice(0, 5).map((c) => <div className="row" key={c.id}>
              <span className={`tag ${c.status}`}>{c.status.replace("_", " ")}</span>
              <div className="grow"><b>{policies.find((p) => p.id === c.policy_id)?.subject}</b><div className="muted">{c.reason || "Waiting for validators"}</div></div></div>)}
          </div>
        </div>
      </>}

      {tab === "Get cover" && <div className="grid2">
        <div className="card"><h3>New policy</h3>
          <div className="chips" style={{ marginBottom: 14 }}>{PRESETS.map((p) =>
            <button key={p.name} className="chip" onClick={() => setForm({ ...form, kind: p.kind, subject: p.subject, url: p.url, terms: p.terms })}>{p.name}</button>)}</div>
          <div className="form">
            <label>Type<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
            <label>What is covered<input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Flight XY123 on 1 Nov" /></label>
            <label>Evidence page (public URL)<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></label>
            <label>Payout terms<textarea value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} placeholder="Pay if the page shows…" /></label>
            <div className="two">
              <label>Payout (GEN)<input value={form.payout} onChange={(e) => setForm({ ...form, payout: e.target.value })} /></label>
              <label>Premium (GEN, min {minPremium})<input value={form.premium} onChange={(e) => setForm({ ...form, premium: e.target.value })} /></label>
            </div>
            <button className="btn" disabled={!!busy} onClick={() => { try {
              run("Buying policy", "buy_policy", [form.kind, form.subject, form.url, form.terms, toWei(form.payout)], toWei(form.premium), "Policy bought");
            } catch (e: any) { setToast({ msg: e.message, err: true }); } }}>Buy policy</button>
          </div></div>
        <div className="card"><h3>Your policies</h3>
          {!account && <div className="empty">Connect your wallet to see your policies.</div>}
          {account && myPolicies.length === 0 && <div className="empty">No policies yet. Pick a demo above and buy one.</div>}
          {myPolicies.map((p) => <div className="row" key={p.id}>
            <div className="grow"><b>#{p.id} {p.subject}</b> <span className={`tag ${p.status}`}>{p.status}</span>
              <div className="muted">Pays {fmt(p.payout)} GEN · premium {fmt(p.premium)}</div>
              {p.status === "ACTIVE" && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <input placeholder="What happened? (optional)" value={notes[p.id] ?? ""} onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })} />
                <button className="btn sm" disabled={!!busy} onClick={() => run("Filing claim", "file_claim", [p.id, notes[p.id] ?? ""], 0n, "Claim filed")}>File claim</button></div>}
            </div></div>)}
        </div></div>}

      {tab === "Claims" && <div className="card"><h3>All claims</h3>
        {claims.length === 0 && <div className="empty">No claims yet. File one from a policy under Get cover.</div>}
        {[...claims].reverse().map((c) => { const p = policies.find((x) => x.id === c.policy_id); const mine = c.holder === me;
          const expired = !!stats && stats.claim_count >= c.denied_at + 3;
          return <div className="row" key={c.id}>
            <div className="grow"><b>Claim #{c.id} · {p?.subject}</b> <span className={`tag ${c.status}`}>{c.status.replace("_", " ")}</span>
              <div className="muted">Holder {short(c.holder)} · pays {fmt(p?.payout)} GEN · reviews {c.evaluations} · appeals {c.appeals}</div>
              {c.note && <div className="muted">“{c.note}”</div>}
              {c.reason && <div className="reason"><b>{c.verdict}</b> — {c.reason}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                {["PENDING", "INCONCLUSIVE"].includes(c.status) && (mine || isOwner) && <button className="btn sm" disabled={!!busy} onClick={() => run("Validators are reviewing the evidence", "evaluate_claim", [c.id], 0n, "Verdict reached")}>Run validators</button>}
                {["PENDING", "INCONCLUSIVE"].includes(c.status) && mine && <button className="btn sm ghost" disabled={!!busy} onClick={() => run("Withdrawing", "withdraw_claim", [c.id], 0n, "Claim withdrawn")}>Withdraw</button>}
                {c.status === "DENIED" && mine && c.appeals < 1 && <button className="btn sm" disabled={!!busy} onClick={() => run("Validators are reconsidering", "appeal_claim", [c.id], 0n, "Appeal decided")}>Appeal</button>}
                {c.status === "DENIED" && (mine || expired) && <button className="btn sm ghost" disabled={!!busy} onClick={() => run("Finalizing", "finalize_denial", [c.id], 0n, "Denial finalized")}>{mine ? "Accept denial" : "Release reserve"}</button>}
                {c.status === "DENIED" && !mine && !expired && <span className="muted">Appeal window open</span>}
              </div></div></div>; })}
      </div>}

      {tab === "Pool" && <div className="grid2">
        <div className="card"><h3>Back the pool</h3><p className="muted">Deposits increase capacity for new policies. Capacity locked behind open policies cannot be withdrawn.</p>
          <div className="form"><label>Amount (GEN)<input value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <button className="btn" disabled={!!busy} onClick={() => { try { run("Funding pool", "fund_pool", [], toWei(amount), "Pool funded"); } catch (e: any) { setToast({ msg: e.message, err: true }); } }}>Add liquidity</button>
            {isOwner && <button className="btn ghost" disabled={!!busy} onClick={() => { try { run("Withdrawing", "withdraw_free", [toWei(amount)], 0n, "Withdrawn"); } catch (e: any) { setToast({ msg: e.message, err: true }); } }}>Withdraw free liquidity (owner)</button>}</div></div>
        <div className="card"><h3>Pool health</h3>
          <div className="row"><div className="grow">Total liquidity</div><b>{fmt(stats?.liquidity)} GEN</b></div>
          <div className="row"><div className="grow">Locked behind policies</div><b>{fmt(stats?.reserved)} GEN</b></div>
          <div className="row"><div className="grow">Free capacity</div><b>{fmt(stats?.free)} GEN</b></div>
          <div className="row"><div className="grow">Owner</div><span className="muted">{short(stats?.owner ?? "")}</span></div></div></div>}

      {busy && <div className="toast"><span className="spin" />{busy}… validators may take a minute.</div>}
      {!busy && toast && <div className={`toast ${toast.err ? "err" : ""}`} role="status" onClick={() => setToast(null)}>{toast.msg}</div>}
    </main>
  );
}
