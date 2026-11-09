"use client";
import { useEffect, useRef, useState } from "react";
import { Drop, Wordmark } from "./Logo";
import { VoteArt, WorkArt, PayArt } from "./Sticks";
import { loadSputnik, isSputnik, viewAt, rpcCall, DEMO_SPUTNIK, EXECUTOR, FACTORY } from "../lib/sputnik";
import { autoTier, policyCheck, nearStr } from "../lib/policy";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "lisdao-v2-1793741346.testnet";
const AGENT = process.env.NEXT_PUBLIC_AGENT_ID || "lisdao-agent-1793741346.testnet";
async function view(method, args = {}) { return viewAt(CONTRACT, method, args); }
const withTimeout = (pr, ms, msg) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
// Ask the RPC for the final outcome of a tx; throws with the on-chain error if any action or receipt failed.
async function verifyTx(hash, sender) {
  for (let i = 0; i < 20; i++) {
    { try {
      const j = { result: await rpcCall("EXPERIMENTAL_tx_status", { tx_hash: hash, sender_account_id: sender, wait_until: "EXECUTED_OPTIMISTIC" }) };
      if (j.result) { const bad = [j.result.transaction_outcome, ...(j.result.receipts_outcome || [])].map(o => o.outcome.status).find(st => st && st.Failure);
        if (j.result.status?.Failure || bad) throw new Error("ONCHAIN:" + JSON.stringify(j.result.status?.Failure || bad.Failure).slice(0, 160));
        if (j.result.status?.SuccessValue !== undefined || j.result.status?.SuccessReceiptId) return true; }
    } catch (e) { if (String(e.message).startsWith("ONCHAIN:")) throw e; } }
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error("Could not confirm the transaction on-chain");
}
const txHash = r => { const o = Array.isArray(r) ? r[r.length - 1] : r; return o?.transaction?.hash || o?.transaction_outcome?.id || o?.final_execution_outcome?.transaction?.hash || (typeof o === "string" ? o : null); };
const TX = h => `https://testnet.nearblocks.io/txns/${h}`;
const short = a => a && a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a;
const badge = s => ({ Active: "Voting", Approved: "Passed", Executing: "Passed", Executed: "Passed", Escalated: "Voting", Rejected: "Rejected", Failed: "Rejected" }[s]);
// Wallet selector with the standard modal (Meteor and other NEAR wallets). A session is live only when the selector has an account AND the wallet reports signed in.
const SEL_KEYS = /^(near-wallet-selector|_meteor_wallet|meteor|near_app_wallet|selected-wallet)/;
const resetWallet = () => { try { Object.keys(localStorage).filter(k => SEL_KEYS.test(k)).forEach(k => localStorage.removeItem(k)); } catch {} };
const yocto = y => (Number(BigInt(y) / 10n ** 20n) / 1e4).toFixed(4);
const fmt = ns => new Date(Number(BigInt(ns) / 1000000n)).toLocaleString();

function toYocto(n) { const [i, f = ""] = String(n).split("."); return (BigInt(i || 0) * 10n ** 24n + BigInt((f + "0".repeat(24)).slice(0, 24))).toString(); }

function Agent({ dao, p, onClose }) {
  const [ev, setEv] = useState([]); const [hb, setHb] = useState(null);
  useEffect(() => { let on = true; const h = async () => { try { const r = await (await fetch("/api/heartbeat", { cache: "no-store" })).json(); if (on) setHb(r); } catch {} };
    h(); const t = setInterval(h, 3000); return () => { on = false; clearInterval(t); }; }, []);
  const [fd, fp] = p.feed || (dao.sputnik ? [null, null] : [dao.id, p.id]);
  useEffect(() => { let on = true, since = 0; if (fd === null) return;
    const tick = async () => { try { const r = await (await fetch(`/api/agent?dao=${fd}&pid=${fp}&since=${since}`)).json();
      if (r.length && on) { since = r[r.length - 1].t; setEv(e => (r.some(x => x.reset) ? r : [...e, ...r])); } } catch {} };
    tick(); const t = setInterval(tick, 2000); return () => { on = false; clearInterval(t); }; }, [fd, fp]);
  const box = useRef(null); const [pick, setPick] = useState(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); setPick(null); }, [ev.length]);
  const shots = ev.filter(e => e.shot); const last = shots[shots.length - 1]; const done = ev.find(e => e.phase === "done");
  const failed = ev.find(e => e.phase === "failed"); const view = (pick !== null && ev[pick]?.shot) ? ev[pick] : last;
  const url = [...ev].reverse().find(e => e.url)?.url || "";
  const host = (() => { try { const u = new URL(url); return { o: u.host, p: u.pathname }; } catch { return null; } })();
  const working = !done && !failed && p.status === "Executing";
  const label = e => e.text.replace(/\s*\[(LLM|scripted)\]$/, "");
  return <div className="agent" role="dialog" aria-label="Agent live browser">
    <div className="chrome"><b>Live browser</b>{hb && <span className={"dot" + (hb.online ? " on" : "")}>{hb.online ? "agent online" : "agent offline"}</span>}</div>
    <div className="screen">
      <div className="bframe">
        <div className="bbar"><span className="lock" aria-hidden="true">{host?.o?.startsWith("localhost") ? "ⓘ" : "🔒"}</span>
          <span className="url" title={url} data-testid="agent-url">{host ? <><b>{host.o}</b>{host.p}</> : <span className="muted">waiting for the agent’s browser…</span>}</span>
          {working && <span className="pulse" aria-label="working" />}</div>
        <div className="bview">{view ? <img key={view.t} src={"data:image/jpeg;base64," + view.shot} alt={"Agent browser: " + label(view)} className="shot fade" />
          : <div className="sk" style={{ height: 220, margin: 0 }} />}
          {view?.step > 0 && <span className="bstep">Step {view.step}</span>}</div>
        {view && <div className="bcap">{label(view)}</div>}
      </div>
      <div className="slist" ref={box}>
      {ev.length === 0 && p.status === "Executing" && <div className="step">{hb?.online ? (hb.state === "working" && hb.dao_id === fd && hb.proposal_id === fp ? "Agent picked it up · opening the browser…" : "Agent online · starting the task…") : hb ? "Agent is offline right now · it will pick this up as soon as it is back" : "Checking the agent…"}</div>}
      <ol className="steps2">{ev.map((e, i) => <li key={e.t + "" + i} className={"s2" + (e.phase === "failed" ? " bad" : "") + (view === e ? " on" : "")}>
        <span className="tick" aria-hidden="true">{e.phase === "failed" ? "!" : "✓"}</span>
        <span className="s2t">{e.step > 0 && <b>Step {e.step} · </b>}{label(e)}</span>
        {e.shot && <button className="thumb" aria-label={"Show screenshot: " + label(e)} onClick={() => setPick(i)}><img src={"data:image/jpeg;base64," + e.shot} alt="" /></button>}</li>)}
        {working && <li className="s2 now"><span className="tick"><span className="pulse" /></span><span className="s2t">Working…</span></li>}</ol>
      {(done || p.status === "Executed" || p.status === "Escalated") && <div className="receipt"><b>{p.status === "Escalated" || done?.escalated ? "Above the auto-approve tier · sent to the council as a Sputnik Transfer proposal" : dao.sputnik ? "Reported on-chain · paid by the LisDao executor from the DAO’s escrow" : "Reported on-chain · paid by the DAO contract"}</b>
        {done?.address && <div>To: {done.address}</div>}
        {done?.tx && <div><a href={`https://testnet.nearblocks.io/txns/${done.tx}`} target="_blank" rel="noopener noreferrer">Agent payout tx ↗</a></div>}
        {p.result && <div className="small">{p.result}</div>}</div>}
    </div></div>
    <div className="pad"><button className="btn full" onClick={onClose}>Close</button></div></div>;
}

const STAGES = ["Demo", "Proposal", "Vote", "Agent", "Paid"];

// Live spending limits read from the executor contract (get_config + reputation), via /api/rpc.
const NBA = a => `https://testnet.nearblocks.io/address/${a}`;
function useLimits(proposer) {
  const [s, setS] = useState(null);
  useEffect(() => { let on = true; (async () => { try {
    const [cfg, rep] = await Promise.all([viewAt(EXECUTOR, "get_config"), proposer ? viewAt(EXECUTOR, "reputation", { account_id: proposer }) : 0]);
    if (on) setS({ cfg, rep, tier: autoTier(cfg, rep) }); } catch { if (on) setS({ err: true }); } })(); return () => { on = false; }; }, [proposer]);
  return s;
}
function Limits({ proposer }) {
  const s = useLimits(proposer);
  return <div className="box limits" aria-label="Spending limits"><h3>Spending limits <span className="muted small">· live from <a href={NBA(EXECUTOR)} target="_blank" rel="noopener noreferrer">{short(EXECUTOR)}</a></span></h3>
    {!s ? <p className="muted">Reading the contract…</p> : s.err ? <p className="muted">Could not read the contract right now.</p> : <div className="facts">
      {[["Per-payout cap", "The amount voted in the proposal (max_spend). Higher payouts are refused on-chain."],
        ["Auto-approve tier", `Starts at ${nearStr(s.cfg.base_cap)}, +${nearStr(s.cfg.rep_step)} per finished task, max ${nearStr(s.cfg.max_auto)}. Above it: council Transfer vote.`],
        ...(proposer ? [[`Tier for ${short(proposer)}`, `${nearStr(s.tier)} (${s.rep} finished task${s.rep === 1 ? "" : "s"})`]] : []),
        ["Only agent that can report", s.cfg.agent], ["Who can dispatch", `Sputnik DAOs (*.${s.cfg.factory}) through a passed vote`], ["Tasks so far", String(s.cfg.tasks)]]
        .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}</div>}</div>;
}
function PolicyCheck({ p }) {
  const s = useLimits(p.proposer);
  if (!p.action.AgentTask || !s || s.err) return null;
  const r = policyCheck({ maxSpend: p.action.AgentTask.max_spend, tier: s.tier, task: p.task });
  return <div className={"policy " + r.tone} role="status"><b>Policy check: {r.label}</b><span>{r.detail}</span></div>;
}
function Stepper({ at }) {
  return <div className="stepper" aria-label="Progress">{STAGES.map((n, i) =>
    <div key={n} className={"st" + (i < at || at >= STAGES.length ? " done" : "") + (i === Math.min(at, STAGES.length - 1) ? " now" : "")}><span>{i < at ? "✓" : i + 1}</span><em>{n}</em></div>)}</div>;
}
const Next = ({ children }) => <p className="next fade" role="status">{children}</p>;

export default function Home() {
  const [sel, setSel] = useState(); const [modal, setModal] = useState(); const [acct, setAcct] = useState(); const [needRe, setNeedRe] = useState(false);
  const [daos, setDaos] = useState([]); const [cur, setCur] = useState(null); const [props, setProps] = useState([]);
  const [votes, setVotes] = useState([]); const [pane, setPane] = useState("summary"); const [pid, setPid] = useState(null);
  const [agent, setAgent] = useState(false); const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false); const [loadingP, setLoadingP] = useState(false); const [toast, setToast] = useState(""); const [dismissed, setDismissed] = useState(null);
  const [f, setF] = useState({ name: "", members: "", quorum: 51, title: "", desc: "", amt: "" });
  const [lastTx, setLastTx] = useState(null); const [lastKind, setLastKind] = useState(""); const [wReady, setWReady] = useState(false); const [err, setErr] = useState(""); const [phase, setPhase] = useState(""); const [adv, setAdv] = useState(false);
  const [sdao, setSdao] = useState(null); const [tier, setTier] = useState(null); const pol = useRef(null); const [bal, setBal] = useState(null);

  useEffect(() => { const q = new URLSearchParams(location.search);
    (async () => {
    try {
      await load();
      if (q.get("dao")) { const d = isNaN(+q.get("dao")) ? q.get("dao") : +q.get("dao"); await open(d); if (q.get("p")) await showP(d, +q.get("p")); }
      if (q.get("pane")) setPane(q.get("pane")); if (q.get("agent")) setAgent(true);
    } catch (e) { console.error("init", e); }
    setReady(true);
    })();
    (async () => {
    if (q.get("e2e")) { // test mode: fake connected wallet that records txs instead of sending
      window.__txs = []; const fake = { wallet: async () => { if (q.get("e2e") === "dead") throw new Error("No accounts found"); return ({ signAndSendTransaction: async t => { window.__txs.push(t); return { transaction: { hash: "e2e" } }; } }); }, disconnect: async () => {} };
      setSel(fake); setModal({ show: () => { window.__connectClicked = true; setAcct("e2e-user.testnet"); } }); setAcct(q.get("e2e") === "out" ? undefined : "e2e-user.testnet"); setWReady(true); return;
    }
    const [{ setupWalletSelector, internalActionToNaj }, { setupModal }, ...m] = await Promise.all([import("@near-wallet-selector/core"), import("@near-wallet-selector/modal-ui"),
      import("@near-wallet-selector/meteor-wallet"), import("@near-wallet-selector/my-near-wallet"), import("@near-wallet-selector/hot-wallet"), import("@near-wallet-selector/here-wallet"),
      import("@near-wallet-selector/intear-wallet"), import("@near-wallet-selector/sender"), import("@near-wallet-selector/bitte-wallet"), import("@near-wallet-selector/near-mobile-wallet")]);
    const [{ setupMeteorWallet }, { setupMyNearWallet }, { setupHotWallet }, { setupHereWallet }, { setupIntearWallet }, { setupSender }, { setupBitteWallet }, { setupNearMobileWallet }] = m;
    const selector = await setupWalletSelector({ network: "testnet", modules: [setupMeteorWallet(), setupMyNearWallet(), setupHotWallet(), setupHereWallet(),
      setupIntearWallet(), setupSender(), setupBitteWallet(), setupNearMobileWallet()] });
    const getW = () => selector.wallet(); // whichever wallet the user picked in the modal
    const adapter = { // same shape the rest of the page uses: wallet(), disconnect()
      wallet: async () => { const w = await getW(); if (!(await w.isSignedIn?.() ?? true)) throw new Error("No accounts found");
        return { signAndSendTransaction: t => w.signAndSendTransaction({ ...t, actions: t.actions.map(internalActionToNaj) }) }; },
      disconnect: async () => { try { await (await getW()).signOut(); } catch {} resetWallet(); } };
    const sync = st => { const id = st.accounts?.find(x => x.active)?.accountId || st.accounts?.[0]?.accountId; setAcct(id); if (id) setNeedRe(false); };
    selector.store.observable.subscribe(sync);
    const ui = setupModal(selector, { contractId: "lisdao-demo.sputnikv2.testnet", methodNames: [] });
    setSel(adapter); setModal({ show: () => ui.show() });
    const st = selector.store.getState();
    if (st.accounts?.length) { try { const w = await getW(); if (await w.isSignedIn?.() ?? true) sync(st); else throw 0; }
      catch { console.warn("wallet: persisted account without live session"); try { await (await getW()).signOut(); } catch {} resetWallet(); setAcct(undefined); setNeedRe(true); } }
    setWReady(true);
  })().catch(e => { console.error("wallet init", e); setWReady(true); }); }, []);
  useEffect(() => { if (cur === null) return; const t = setInterval(async () => {
    if (isSputnik(cur)) { try { await loadS(cur); } catch {} return; }
    try { const [ps, ds] = await Promise.all([view("get_proposals", { dao_id: cur }), view("list_daos")]); setProps(old => [...ps, ...old.filter(x => x.optimistic && x.id >= ps.length)]); setDaos(ds); } catch {} }, 1500);
    return () => clearInterval(t); }, [cur]);
  useEffect(() => { const x = props.find(q => q.id === pid); if (x && x.status === "Executing" && pane === "proposal" && dismissed !== pid) setAgent(true); }, [props, pid, pane, dismissed]);
  useEffect(() => { if (pane !== "create-dao" || !acct) return; setBal(null);
    if (acct === "e2e-user.testnet") { setBal(3); return; }
    rpcCall("query", { request_type: "view_account", finality: "final", account_id: acct }).then(r => setBal(Number(BigInt(r.amount) / 10n ** 20n) / 1e4)).catch(() => {}); }, [pane, acct]);
  const live = useRef(null); // live connector wallet, fetched as soon as an account is known so a click can sign without slow awaits
  useEffect(() => { live.current = null; if (!acct || !sel) return; sel.wallet().then(w => { live.current = w; }).catch(e => console.warn("wallet warmup", e)); }, [acct, sel]);
  async function load() { for (let i = 0; i < 4; i++) { try { setDaos(await view("list_daos")); return; } catch (e) { await new Promise(r => setTimeout(r, 500 * (i + 1))); } } }
  async function loadS(id) { const r = await loadSputnik(id, { policy: pol.current?.[id] }); pol.current = { ...pol.current, [id]: r.policy };
    setSdao(r.dao); setProps(old => [...r.props, ...old.filter(x => x.optimistic && !r.props.some(y => y.id === x.id))]); return r; } // optimistic rows only exist in e2e test mode
  useEffect(() => { if (!acct || !isSputnik(cur)) return setTier(null);
    Promise.all([viewAt(EXECUTOR, "auto_cap", { account_id: acct }), viewAt(EXECUTOR, "reputation", { account_id: acct })]).then(([c, r]) => setTier({ cap: c, rep: r })).catch(() => {}); }, [acct, cur, props.filter(x => x.status === "Executed").length]);
  async function open(id) {
    if (isSputnik(id)) { setCur(id); setPane("summary"); setLoadingP(true); setProps([]); try { await loadS(id); } catch (e) { flash("Could not load that Sputnik DAO"); } finally { setLoadingP(false); } return; }
    setCur(id); setPane("summary"); setLoadingP(true); try { setProps(await view("get_proposals", { dao_id: id })); } finally { setLoadingP(false); } }
  async function showP(d, p) { setPid(p); setPane("proposal"); setErr(""); if (isSputnik(d)) return; setVotes(await view("get_votes", { dao_id: d, proposal_id: p })); }
  function flash(m) { setToast(m); setTimeout(() => setToast(""), 2500); }
  async function voteNo(d, x, w) {
    if (!acct) return modal.show();
    const snap = props; setProps(ps => ps.map(q => q.id === x.id ? { ...q, no: q.no + w } : q));
    if (d.sputnik) { if (!(await call("act_proposal", { id: x.id, action: "VoteReject", proposal: x.kind }, "0", d.id, "300000000000000"))) setProps(snap); else flash("No vote recorded"); return; }
    if (!(await call("vote", { dao_id: d.id, proposal_id: x.id, approve: false }))) setProps(snap); else flash("No vote recorded");
  }
  async function vote(d, x, w) {
    if (!acct) return modal.show();
    const snap = props;
    const e2e = acct === "e2e-user.testnet";
    if (x.optimistic && !e2e) return flash("This proposal is not on-chain yet");
    if (d.sputnik) { if (!e2e && !props.some(q => q.id === x.id && !q.optimistic)) return flash("That proposal does not exist on-chain");
      if (!(await call("act_proposal", { id: x.id, action: "VoteApprove", proposal: x.kind }, "0", d.id, "300000000000000"))) setProps(snap); else flash("Vote recorded in the Sputnik DAO"); return; }
    setProps(ps => ps.map(q => q.id === x.id ? { ...q, yes: q.yes + w, status: (q.yes + w) * 100 >= d.total_weight * d.quorum_pct ? (q.action.AgentTask ? "Executing" : "Approved") : q.status } : q));
    setVotes(v => [...v, [acct, true]]);
    if (!(await call("vote", { dao_id: d.id, proposal_id: x.id, approve: true }))) setProps(snap); else flash("Vote recorded on NEAR");
  }
  async function refresh() {
    if (isSputnik(cur)) { try { await loadS(cur); } catch {} return; }
    try { await load(); if (cur !== null) { const ps = await view("get_proposals", { dao_id: cur }); setProps(old => [...ps, ...old.filter(x => x.optimistic && x.id >= ps.length)]); if (pid !== null) setVotes(await view("get_votes", { dao_id: cur, proposal_id: pid })); } } catch {}
  }
  function reconnect() { resetWallet(); live.current = null; setAcct(undefined); setNeedRe(true); setErr("Reconnect wallet: the wallet session ended. Approve the connect request, then press the button again."); flash("Reconnect wallet"); modal?.show(); }
  // Returns true on success. Shows a short message on failure instead of throwing.
  async function call(methodName, args, deposit, receiverId = CONTRACT, gas = "100000000000000") {
    if (!acct) { modal?.show(); return false; }
    setBusy(true);
    setErr(""); setPhase("wallet");
    try { let w;
      try { w = live.current || await withTimeout(sel.wallet(), 8000, "no wallet"); live.current = w; }
      catch (e) { console.error("wallet session", e); reconnect(); return false; }
      // Wait for the wallet without failing early: a moved or blurred popup can still sign later.
      // After 60 s show a soft "still waiting" note; it is cleared as soon as any result arrives.
      // Only after 10 min with no result do we report WALLET_TIMEOUT; a late success still clears it.
      const sign = w.signAndSendTransaction({ receiverId, actions: [methodName === "$transfer" ? { type: "Transfer", params: { deposit } } : { type: "FunctionCall", params: { methodName, args, gas, deposit: deposit || "0" } }] });
      const slow = setTimeout(() => setErr("Still waiting for your wallet. Approve or reject the request there."), 60000);
      let res; try { res = await withTimeout(sign, 600000, "WALLET_TIMEOUT"); }
      catch (e) { if (String(e?.message) === "WALLET_TIMEOUT") sign.then(r => { if (txHash(r)) { setErr(""); setLastTx(txHash(r)); setLastKind(methodName); refresh(); } }, () => {}); throw e; }
      finally { clearTimeout(slow); }
      setErr("");
      const h = txHash(res); if (!h) { if (res == null && acct !== "e2e-user.testnet") { reconnect(); return false; } throw new Error("The wallet did not send a transaction"); }
      setPhase("confirm"); if (h !== "e2e") await verifyTx(h, acct);
      setLastTx(h); setLastKind(methodName); refresh(); return h;
    } catch (e) { console.error("tx", e); const m = String(e?.message || e); const msg = m === "WALLET_TIMEOUT" ? "No answer from your wallet after 10 minutes. Open your wallet and try again." : m.includes("not a member") || m.includes("ERR_PERMISSION_DENIED") ? "Your wallet isn't on this DAO's council" : m.includes("already voted") || m.includes("ERR_ALREADY_VOTED") ? "You already voted" : m.includes("ERR_NO_PROPOSAL") ? "That proposal does not exist on-chain" : m.includes("ONCHAIN:") ? "Failed on-chain: " + m.slice(8, 110) : /reject|cancel|closed|denied/i.test(m) ? "Cancelled in wallet" : "Transaction failed: " + m.slice(0, 100);
      setErr(msg); flash(msg); return false; }
    finally { setBusy(false); setPhase(""); }
  }
  const dao = isSputnik(cur) ? (sdao?.id === cur ? sdao : null) : daos.find(d => d.id === cur); const p = props.find(x => x.id === pid);

  const wallet = <div className="navw">{acct
      ? <button className="btn" aria-expanded={menu} onClick={() => setMenu(!menu)}>{short(acct)} ▾</button>
      : !wReady ? <button className="btn" disabled aria-busy="true">Wallet…</button>
      : <button className="btn" onClick={() => modal?.show()}>{needRe ? "Reconnect wallet" : "Connect wallet"}</button>}
      {menu && <div className="menu">
        <button className="btn" onClick={async () => { await sel.disconnect().catch(() => {}); setAcct(undefined); setMenu(false); }}>Sign out</button></div>}</div>;
  const GH = "https://github.com/kaizen-builds/lisdao";
  const ext = { target: "_blank", rel: "noopener noreferrer" };
  const nav = <header className="nav"><div className="nav-in">
    <button className="brand" onClick={() => { setCur(null); setPane("summary"); }} aria-label="LisDao home"><Drop size={24} /><Wordmark /></button>
    <a className="navlink" href={GH} {...ext}>GitHub</a>{wallet}</div></header>;
  const foot = <footer className="foot">Built at NEAR HACKATHON · Testnet only · <a href={GH} {...ext}>GitHub (MIT)</a></footer>;

  const NB = "https://testnet.nearblocks.io";
  if (cur === null && pane !== "create-dao") return <div className="lp">{nav}
    <main className="main fade" id="top">
    <section className="lhero" aria-labelledby="hero-title">
      <Drop size={56} />
      <h1 id="hero-title">Your DAO votes.<br />An AI agent does the work.</h1>
      <p className="lsub">Members vote on a task in plain words. The agent does it in a real browser. A NEAR contract pays, within limits.</p>
      <button className="btn p big" onClick={() => open(DEMO_SPUTNIK)}>Try the demo</button>
      <p className="note">Testnet only. No real money.</p>
      <button className="link" aria-expanded={adv} onClick={() => setAdv(!adv)}>Advanced {adv ? "▴" : "▾"}</button>
      {adv && <div className="stack"><button className="btn full" onClick={() => setPane("create-dao")}>Create New DAO</button>
      <button className="btn full" onClick={() => { const a = prompt("Paste the address of a Sputnik DAO on testnet, e.g. lisdao-demo.sputnikv2.testnet", ""); if (a && isSputnik(a.trim())) open(a.trim()); else if (a) flash("Enter an address ending in .sputnikv2.testnet"); }}>Open my Sputnik DAO</button></div>}
    </section>
    <p className="pill" aria-label="Built on">Built on <b>NEAR</b> · <b>Sputnik DAO</b> · <b>NEAR AI Cloud</b></p>

    <section className="sec" id="how" aria-labelledby="how-title"><h2 id="how-title">How it works</h2><ol className="steps">
      <li className="box"><VoteArt /><span className="num">1</span><h3>The community votes</h3><p>Propose a task in plain words, like donating 0.1 NEAR to the water project. In the demo DAO one council vote passes it; with more members it's a normal vote.</p></li>
      <li className="box"><WorkArt /><span className="num">2</span><h3>The agent works</h3><p>It controls a real browser, reads screenshots with NEAR AI Cloud, and clicks through to the one-time deposit address. Watch it work in the Live browser view.</p></li>
      <li className="box"><PayArt /><span className="num">3</span><h3>The contract pays</h3><p>The contract sends the funds on-chain. Small payouts go through; big ones go back to a vote.</p></li></ol></section>

    <section className="sec" id="proof" aria-labelledby="proof-title"><h2 id="proof-title">Proof: proposal #9</h2>
      <div className="box proof"><p className="q">“Donate 0.1 NEAR to the water project”</p>
        <div className="row"><span className="badge Passed">Passed</span><span className="muted">Yes 1 · No 0</span></div>
        <div className="bar"><i style={{ width: "100%" }} /></div>
        <p className="muted">The agent's model ran on NEAR AI Cloud. The contract paid 0.1 NEAR from escrow.</p>
        <div className="links"><a href={`${NB}/txns/BLWit74iq8u1BUJ4QMdHacmt73hZeyc9rzWAGHxaQJYd`} {...ext}>Proposal ↗</a><a href={`${NB}/txns/2X3LdXx4xd8U85g3AsrTtGTXRCXdC8Zfy7fmZydbcEi2`} {...ext}>Vote ↗</a><a href={`${NB}/txns/BFijitUnuteeT7KP3VzhPt4eDMuQkKk56msMtQppEMH4`} {...ext}>Payout ↗</a></div>
      </div>
      <p className="muted small">More on-chain evidence is in the <a href={`${GH}#readme`} {...ext}>README</a>.</p></section>

    <section className="sec" id="limits" aria-labelledby="lim-title"><h2 id="lim-title">Limits</h2><div className="two">
      <div className="box"><h3>What the contract enforces</h3><ul>
        <li>The agent can't vote.</li><li>The agent can't take the treasury. Money waits in escrow.</li>
        <li>Auto-pay starts at 0.2 NEAR and caps at 1 NEAR. Bigger payouts go back to a vote.</li></ul></div>
      <div className="box"><h3>What it doesn't do yet</h3><ul>
        <li>Testnet only. One agent run by one operator.</li><li>The contract trusts the payee the agent reports, within the cap.</li>
        <li>No timeout refund yet.</li></ul></div></div><Limits /></section>

    <section className="cta" aria-labelledby="cta-title"><h2 id="cta-title">Create a task. Vote yes. Watch the agent.</h2>
      <button className="btn p big" onClick={() => open(DEMO_SPUTNIK)}>Open the demo</button></section>
    </main>
    {foot}
    {toast && <div className="toast" role="status">{toast}</div>}</div>;

  if (pane === "create-dao") return <>{nav}<main className="narrow fade"><div className="panel">
    <h2>Create New DAO</h2>
    <div className="muted">Creates a real Sputnik DAO on NEAR testnet. Sputnik needs about 6 NEAR to store the DAO; the rest becomes its treasury.</div>
    <label>DAO name</label><input placeholder="my-club" value={f.name} onChange={e => setF({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
    <div className="help">Your DAO's address will be <b>{(f.name.trim().replace(/^-+|-+$/g, "") || "name")}.sputnikv2.testnet</b></div>
    <label>Council members</label><input placeholder="alice.testnet, bob.testnet" value={f.members} onChange={e => setF({ ...f, members: e.target.value })} />
    <div className="help">Members who can vote. You are added automatically. Add friends' testnet accounts, e.g. alice.testnet</div>
    <label>Votes needed to approve</label><div className="choices" role="radiogroup" aria-label="Votes needed to approve">{[["1/3", "Any one member can approve", "fastest, good for testing"], ["1/2", "Majority must approve", "safer for real groups"]].map(([v, t, d]) => <button key={v} type="button" role="radio" aria-checked={(f.th || "1/3") === v} className={"choice" + ((f.th || "1/3") === v ? " on" : "")} onClick={() => setF({ ...f, th: v })}><b>{t}</b><span>{d}</span></button>)}</div>
    <div className="help">{(f.th || "1/3") === "1/3" ? "A single Yes vote from any council member passes a proposal." : "More than half of the council must vote Yes before a proposal passes."}</div>
    <label>NEAR to attach</label><input inputMode="decimal" value={f.dep ?? "6.5"} onChange={e => setF({ ...f, dep: e.target.value })} />
    <div className="help">Testnet NEAR. About 6 NEAR pays for storage; whatever is left becomes the DAO's treasury.</div>
    <div className="help">{acct ? (bal === null ? "Checking your wallet balance…" : <>Your wallet balance: <b>{bal.toFixed(2)} NEAR</b></>) : "Connect your wallet to see your balance."}</div>
    {acct && bal !== null && bal < (+(f.dep ?? "6.5") || 0) + 0.05 && <div className="warn">Not enough NEAR: you have {bal.toFixed(2)}, this needs about {(+(f.dep ?? "6.5") || 0).toFixed(2)} plus a little gas. Testnet NEAR is free: get more from a faucet such as near-faucet.io.</div>}
    {acct && bal !== null && (+(f.dep ?? "6.5") || 0) < 6 && <div className="warn">Attach at least 6 NEAR, or Sputnik can't store the DAO.</div>}
    <button className="btn p full" disabled={busy} onClick={async () => { const nm = f.name.trim().replace(/^-+|-+$/g, ""); if (!/^[a-z0-9-]{2,40}$/.test(nm)) return flash("Give your DAO a short lowercase name");
      if (!acct) return modal.show(); const council = [...new Set([acct, ...f.members.split(",").map(x => x.trim()).filter(Boolean)])];
      const [a, b] = (f.th || "1/3").split("/").map(Number);
      const policy = { roles: [{ name: "council", kind: { Group: council }, permissions: ["*:*"], vote_policy: {} }, { name: "all", kind: "Everyone", permissions: ["*:AddProposal"], vote_policy: {} }],
        default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [a, b] }, proposal_bond: "10000000000000000000000", proposal_period: "604800000000000", bounty_bond: "100000000000000000000000", bounty_forgiveness_period: "604800000000000" };
      const args = btoa(JSON.stringify({ config: { name: nm, purpose: "LisDao: council votes, AI agent executes tasks", metadata: "" }, policy }));
      if (await call("create", { name: nm, args }, toYocto(f.dep ?? "6.5"), FACTORY, "300000000000000")) { flash("Sputnik DAO created"); setTimeout(() => open(nm + "." + FACTORY), 1500); } }}>{busy ? "Creating..." : "Create Sputnik DAO"}</button>
    <button className="btn full" onClick={() => { setPane("summary"); }}>← Back</button></div></main>{foot}{toast && <div className="toast" role="status">{toast}</div>}</>;

  if (!dao) return <>{nav}<div className="grid" aria-busy="true"><div className="panel">{[0, 1, 2].map(i => <div key={i} className="sk big" />)}</div>
    <div className="panel"><p className="muted">Loading the DAO from NEAR testnet…</p>{[0, 1, 2, 3].map(i => <div key={i} className="sk" />)}</div></div>{toast && <div className="toast" role="status">{toast}</div>}</>;
  const votes2 = dao.sputnik ? (p?.votes || []) : votes;
  const used = votes2.length ? votes2.reduce((s, [a]) => s + (dao.members.find(m => m[0] === a)?.[1] || 0), 0) : 0;
  const myW = dao.members.find(m => m[0] === acct)?.[1] || 0; const goal = dao.sputnik ? dao.need : dao.total_weight;
  const pct = p ? Math.min(100, Math.round(100 * p.yes / (dao.sputnik ? dao.need : dao.total_weight))) : 0;
  const stage = pane === "create" ? 1 : pane === "proposal" && p ? ({ Active: 2, Approved: 2, Executing: 3, Executed: 5, Escalated: 4, Failed: 3, Rejected: 2 }[p.status] ?? 2) : 0;

  return <>{nav}{toast && <div className="toast" role="status">{toast}</div>}{agent && p && <Agent dao={dao} p={p} onClose={() => { setAgent(false); setDismissed(pid); }} />}
    <div className="wrap"><Stepper at={stage} /></div>
    <div className="grid">
      <div className="panel">
        <button className="link back" onClick={() => { setCur(null); setPane("summary"); }}>← Home</button>
        <div className="row"><h2>{dao.name}</h2><select className="btn sm" value={dao.id} onChange={e => e.target.value === "home" ? (setCur(null), setPane("summary")) : open(isSputnik(e.target.value) ? e.target.value : +e.target.value)} aria-label="Switch DAO">
          <option value={DEMO_SPUTNIK}>LisDao Demo (Sputnik)</option>{isSputnik(dao.id) && dao.id !== DEMO_SPUTNIK && <option value={dao.id}>{dao.name} (Sputnik)</option>}</select></div>
        <button className="btn p full" onClick={() => setPane("create")}>Create New Proposal</button>
        <h3 className="lh">Proposals</h3>
        <div className={"card" + (pane === "summary" ? " on" : "")} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())} onClick={() => setPane("summary")}>DAO summary</div>
        {loadingP && [0, 1].map(i => <div key={i} className="sk big" />)}
        {(() => { const all = props.slice().reverse(); const card = x => <div key={x.id} className={"card" + (x.id === pid && pane === "proposal" ? " on" : "")} role="button" tabIndex={0} onKeyDown={e => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), e.currentTarget.click())} onClick={() => showP(dao.id, x.id)}>
          <div className="row"><span className="ctitle">{x.title}</span><span className={"badge " + badge(x.status)}>{badge(x.status)}</span></div><div className="tally"><span>✓ {x.yes ?? 0} yes · ✕ {x.no ?? 0} no</span><span>{x.yes ?? 0} / {dao.sputnik ? dao.need : dao.total_weight} needed</span></div></div>;
          return <>{all.slice(0, 5).map(card)}{all.length > 5 && <details className="older"><summary>Older proposals ({all.length - 5})</summary>{all.slice(5).map(card)}</details>}</>; })()}
      </div>
      <div className="panel fade" key={pane + pid}>
        {pane === "summary" && <>
          <Next>Tap “Create New Proposal” to start</Next>
          {dao.sputnik && <div className="help" style={{ marginTop: 0 }}>Council members vote on every proposal here. In the demo DAO only council wallets vote.</div>}
          <h2>Summary</h2>
          {dao.sputnik ? <>{[["Name", dao.name], ["Sputnik DAO", <a key="a" href={`https://testnet.nearblocks.io/address/${dao.id}`} target="_blank" rel="noopener noreferrer">{dao.id} ↗</a>], ["Balance in NEAR", yocto(dao.treasury)],
            ["Votes needed", `${dao.need} of ${dao.total_weight} council`], ["AI executor", EXECUTOR], ["Your auto-approve tier", acct ? (tier ? `${yocto(tier.cap)} NEAR · reputation ${tier.rep}` : "…") : "connect wallet"]]
            .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
            <p className="muted small">Money and votes stay in the Sputnik DAO. A passed task escrows its cap with the executor. Payouts within your tier are paid at once; bigger ones go back to a council vote.</p></>
          : [["Name", dao.name], ["Created At", "DAO #" + dao.id + " on NEAR testnet"], ["Creator Account", dao.owner], ["Balance in NEAR", yocto(dao.treasury)], ["Agent", dao.agent], ["Quorum", dao.quorum_pct + "%"]]
            .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          <button className="link" disabled={busy} onClick={() => { const n = prompt("Deposit how much NEAR into the treasury?", "1"); if (n && +n > 0) (dao.sputnik ? call("$transfer", {}, toYocto(n), dao.id) : call("deposit", { dao_id: dao.id }, toYocto(n))).then(ok => ok && flash("Deposit sent")); }}>Fund treasury</button>
          <h3 className="lh">{dao.sputnik ? "Council" : "Members"}</h3>
          <div className="muted">Your votes: {myW} out of {dao.total_weight}</div>
          <div className="tbl"><table><thead><tr><th>WALLET ADDRESS</th><th>VOTES</th></tr></thead><tbody>
            {dao.members.map(([a, w]) => <tr key={a}><td>{a}</td><td>{w} ({Math.round(100 * w / dao.total_weight)}%)</td>
</tr>)}
          </tbody></table></div></>}
        {pane === "create" && <>
          <div className="row"><h2>Create Proposal</h2></div>
          <Next>Describe the task in plain English, then create it</Next>
<label>Proposal Title</label><input placeholder="e.g. Donate to the water project" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          {f.kind === "transfer" ? <>
            <label>Send to (NEAR account)</label><input placeholder="friend.testnet" value={f.to || ""} onChange={e => setF({ ...f, to: e.target.value.trim() })} />
            <label>Amount (NEAR)</label><input inputMode="decimal" placeholder="0.1" value={f.amt ?? ""} onChange={e => setF({ ...f, amt: e.target.value })} />
          </> : <>
            <label>What should the agent do?</label><textarea rows={4} placeholder="e.g. Donate 0.1 NEAR to the water project" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} />
          </>}
          <div className="help">The agent may spend up to the NEAR amount you write in the task.</div>
          {err && <div className="warn" role="alert">{err}</div>}
          <button className="btn p full big" disabled={busy} onClick={async () => {
            setErr("");
            if (!f.title.trim()) return setErr("Enter a proposal title");
            if (f.kind !== "transfer" && !f.desc.trim()) return setErr("Describe the task for the agent");
            if (f.kind !== "transfer" && !(+((f.desc.match(/([\d.]+)\s*NEAR/i) || [])[1]) > 0)) return setErr("Say how much NEAR the task may spend, e.g. 'Donate 0.1 NEAR to …'");
            const title = f.title.trim();
            let action;
            if (f.kind === "transfer") {
              if (!/^[a-z0-9._-]{2,64}$/.test(f.to || "") || !(+f.amt > 0)) return flash("Enter a valid account and amount");
              action = { Transfer: { receiver_id: f.to, amount: toYocto(f.amt) } };
            } else {
              const desc = f.desc.trim();
              action = { AgentTask: { instructions: desc, max_spend: toYocto(desc.match(/([\d.]+)\s*NEAR/i)[1]) } };
            }
            const n = props.length;
            let sent, kind, last;
            if (dao.sputnik) {
              const ids = props.filter(x => !x.optimistic).map(x => x.id); last = ids.length ? Math.max(...ids) + 1 : 0; // chain list, polled every 1.5 s; no await so the wallet popup keeps the click's user gesture
              kind = action.Transfer ? { Transfer: { token_id: "", receiver_id: action.Transfer.receiver_id, amount: action.Transfer.amount } }
                : { FunctionCall: { receiver_id: EXECUTOR, actions: [{ method_name: "dispatch_task", deposit: action.AgentTask.max_spend, gas: "50000000000000",
                    args: btoa(JSON.stringify({ title, instructions: action.AgentTask.instructions, max_spend: action.AgentTask.max_spend, proposer: acct, proposal_id: last })) }] } };
              sent = await call("add_proposal", { proposal: { description: action.AgentTask ? `${title}: ${action.AgentTask.instructions}` : title, kind } }, dao.policy.proposal_bond, dao.id);
            } else sent = await call("propose", { dao_id: dao.id, title, action });
            if (sent) { const id = dao.sputnik ? last : n;
              if (sent === "e2e") { setProps(ps => [...ps, { id, proposer: acct, title, action, kind, yes: 0, no: 0, votes: [], status: "Active", deadline_ns: String(BigInt(Date.now()) * 1000000n + BigInt(dao.voting_period_ns)), result: null, optimistic: true }]); }
              else if (dao.sputnik) { const ok = await viewAt(dao.id, "get_proposal", { id }).catch(() => null); if (!ok) return setErr("The transaction went through but no proposal appeared on-chain"); await loadS(dao.id); }
              flash("Proposal created on-chain"); setPid(id); setVotes([]); setPane("proposal"); } }}>{phase === "wallet" ? "Waiting for wallet…" : phase === "confirm" ? "Confirming on NEAR…" : busy ? "Checking…" : "Submit proposal"}</button></>}
        {pane === "proposal" && p && <>
          <h1 className="ptitle">{p.title}</h1>
          {p.status === "Escalated" && <Next>Above the auto-approve tier. Council: vote on the new Transfer proposal</Next>}
          {p.status === "Active" && <Next>{votes2.some(v => v[0] === acct) ? "Waiting for more Yes votes" : "Vote Yes to send it to the agent"}</Next>}
          {p.status === "Executing" && <Next><span className="pulse" /> The agent is working…</Next>}
          {p.status === "Executed" && <Next>Done. The DAO paid on-chain {p.result && <span className="muted"> · see receipt below</span>}</Next>}
          {p.status === "Approved" && <Next>Passed. Execute the transfer</Next>}
          <p className="muted">{p.action.AgentTask ? `${p.action.AgentTask.instructions} · cap ${yocto(p.action.AgentTask.max_spend)} NEAR` : p.action.Other ? `Sputnik ${p.action.Other} proposal` : `${p.escalatedFrom ? "Escalated by the AI executor · " : ""}Transfer ${yocto(p.action.Transfer.amount)} NEAR to ${p.action.Transfer.receiver_id}`}</p>
          <PolicyCheck p={p} />
          <div className="facts">
            {[["Status", p.status === "Active" ? "Voting In Progress" : p.status === "Executing" ? "Passed · Agent executing in browser" : p.status === "Executed" ? "Passed · Executed" : p.status === "Escalated" ? "Passed · payout sent to council vote" : p.status],
              ["Created", fmt(BigInt(p.deadline_ns) - BigInt(dao.voting_period_ns))], ["Voting Ends", fmt(p.deadline_ns)], ["Created by", p.proposer]]
              .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          </div>
          <div className="tallybox"><div className="row"><b>Progress: {p.yes} / {goal} votes{dao.sputnik ? " needed" : ""}</b><span className="muted">{p.no ?? 0} no · {pct}%</span></div><div className="bar"><i style={{ width: pct + "%" }} /></div></div>
          {p.status === "Active" && (votes2.some(v => v[0] === acct) ? <div className="receipt">You voted. Waiting for others…</div> : <>
            <button className="btn p full big" disabled={busy} onClick={() => vote(dao, p, myW || 1)}>{phase === "wallet" ? "Waiting for wallet…" : phase === "confirm" ? "Confirming on NEAR…" : "Vote Yes"}</button>
            <button className="btn full" disabled={busy} onClick={() => voteNo(dao, p, myW || 1)}>Vote No</button></>)}
          {err && <div className="warn" role="alert">{err}</div>}
          {p.status === "Approved" && <button className="btn p full" disabled={busy} onClick={() => call("execute", { dao_id: dao.id, proposal_id: p.id })}>{busy ? "Executing..." : "Execute transfer"}</button>}
          {(p.action.AgentTask && ["Executing", "Executed", "Failed", "Escalated"].includes(p.status)) && !agent && <button className="btn p full big" onClick={() => { setDismissed(null); setAgent(true); }}>View Agent Execution</button>}
          <div className="links">{lastTx && lastTx !== "e2e" && <a href={TX(lastTx)} target="_blank" rel="noopener noreferrer">{lastKind === "add_proposal" ? "Proposal created tx ↗" : lastKind === "act_proposal" ? "Vote tx ↗" : "Transaction ↗"}</a>}
            {dao.sputnik && !p.optimistic && <a href={`https://testnet.nearblocks.io/address/${dao.id}`} target="_blank" rel="noopener noreferrer">Proposal #{p.id} on the DAO ↗</a>}
            {p.task && <a href={NBA(EXECUTOR)} target="_blank" rel="noopener noreferrer">Audit trail: executor task #{p.task.id} ↗</a>}</div>
          {p.action.AgentTask && <Limits proposer={p.proposer} />}
          {p.result && <div className="receipt"><b>Agent report (on-chain):</b> {p.result}</div>}
        </>}
      </div></div>{foot}</>;
}
