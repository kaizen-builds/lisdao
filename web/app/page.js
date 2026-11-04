"use client";
import { useEffect, useRef, useState } from "react";
import { Drop, Wordmark } from "./Logo";
import { loadSputnik, isSputnik, viewAt, DEMO_SPUTNIK, EXECUTOR, FACTORY } from "../lib/sputnik";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "lisdao-v2-1793741346.testnet";
const AGENT = process.env.NEXT_PUBLIC_AGENT_ID || "lisdao-agent-1793741346.testnet";
const RPCS = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"];
let rpcI = 0;
async function view(method, args = {}) {
  for (let i = 0; ; i++) { try { return await view1(method, args); } catch (e) { if (i > 2) throw e; await new Promise(r => setTimeout(r, 800)); } }
}
async function view1(method, args) {
  const url = RPCS[rpcI % RPCS.length]; const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "optimistic",
        account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
    const j = await r.json(); if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
    return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
  } catch (e) { rpcI++; throw e; } finally { clearTimeout(to); }
}
const short = a => a && a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a;
const badge = s => ({ Active: "Voting", Approved: "Passed", Executing: "Passed", Executed: "Passed", Escalated: "Voting", Rejected: "Rejected", Failed: "Rejected" }[s]);
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
  const box = useRef(null);
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }); }, [ev.length]);
  const last = [...ev].reverse().find(e => e.shot); const done = ev.find(e => e.phase === "done");
  const failed = ev.find(e => e.phase === "failed");
  return <div className="agent"><div className="chrome"><span /><span /><span /> LisDao agent · live browser{hb && <em style={{ marginLeft: "auto", fontStyle: "normal", fontSize: 12, color: hb.online ? "#16a34a" : "#9ca3af" }}>● {hb.online ? "agent online" : "agent offline"}</em>}</div>
    <div className="screen" ref={box}>
      {last ? <img key={last.t} src={"data:image/jpeg;base64," + last.shot} alt="agent browser" className="shot fade" />
        : !done && <div className="sk" style={{ height: 220 }} />}
      {ev.length === 0 && p.status === "Executing" && <div className="step">{hb?.online ? (hb.state === "working" && hb.dao_id === fd && hb.proposal_id === fp ? "Agent picked it up · opening the browser…" : "Agent online · starting the task…") : hb ? "Agent is offline right now · it will pick this up as soon as it is back" : "Checking the agent…"}</div>}
      {ev.map((e, i) => <div className="step" key={e.t + "" + i}>{e.phase === "done" ? "✅" : e.phase === "failed" ? "⚠️" : "✓"} {e.text}</div>)}
      {!done && !failed && p.status === "Executing" && <div style={{ position: "relative", height: 40 }}><div className="ripple" style={{ left: 130, top: 10 }} /><div className="ripple b" style={{ left: 130, top: 10 }} /></div>}
      {(done || p.status === "Executed" || p.status === "Escalated") && <div className="receipt"><b>{p.status === "Escalated" || done?.escalated ? "Above the auto-approve tier · sent to the council as a Sputnik Transfer proposal" : dao.sputnik ? "Reported on-chain · paid by the LisDao executor from the DAO’s escrow" : "Reported on-chain · paid by the DAO contract"}</b>
        {done?.address && <div style={{ marginTop: 6, overflowWrap: "anywhere" }}>To: {done.address}</div>}
        {done?.tx && <div style={{ marginTop: 6 }}><a href={`https://testnet.nearblocks.io/txns/${done.tx}`} target="_blank">View transaction ↗</a></div>}
        {p.result && <div style={{ marginTop: 6, fontSize: 12 }}>{p.result}</div>}</div>}
    </div>
    <div style={{ padding: 10 }}><button className="btn full" onClick={onClose}>Close</button></div></div>;
}

const STAGES = ["Demo", "Proposal", "Vote", "Agent", "Paid"];
function Stepper({ at }) {
  return <div className="stepper" aria-label="Progress">{STAGES.map((n, i) =>
    <div key={n} className={"st" + (i < at || at >= STAGES.length ? " done" : "") + (i === Math.min(at, STAGES.length - 1) ? " now" : "")}><span>{i < at ? "✓" : i + 1}</span><em>{n}</em></div>)}</div>;
}
const Next = ({ children }) => <div className="next fade">→ {children}</div>;

export default function Home() {
  const [sel, setSel] = useState(); const [modal, setModal] = useState(); const [acct, setAcct] = useState();
  const [daos, setDaos] = useState([]); const [cur, setCur] = useState(null); const [props, setProps] = useState([]);
  const [votes, setVotes] = useState([]); const [pane, setPane] = useState("summary"); const [pid, setPid] = useState(null);
  const [agent, setAgent] = useState(false); const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false); const [loadingP, setLoadingP] = useState(false); const [toast, setToast] = useState(""); const [dismissed, setDismissed] = useState(null);
  const [f, setF] = useState({ name: "", members: "", quorum: 51, title: "", desc: "" });
  const [sdao, setSdao] = useState(null); const [tier, setTier] = useState(null); const pol = useRef(null);

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
      window.__txs = []; const fake = { wallet: async () => ({ signAndSendTransaction: async t => { window.__txs.push(t); return {}; } }), disconnect: async () => {} };
      setSel(fake); setModal({ show: () => { window.__connectClicked = true; setAcct("e2e-user.testnet"); } }); setAcct(q.get("e2e") === "out" ? undefined : "e2e-user.testnet"); return;
    }
    const { NearConnector } = await import("@hot-labs/near-connect");
    const nc = new NearConnector({ network: "testnet", autoConnect: true, features: { testnet: true } });
    nc.on("wallet:signIn", t => setAcct(t.accounts?.[0]?.accountId));
    nc.on("wallet:signOut", () => setAcct(undefined));
    setSel(nc); setModal({ show: () => nc.connect().catch(e => console.warn("connect", e)) });
    nc.getConnectedWallet().then(({ accounts }) => setAcct(accounts?.[0]?.accountId)).catch(() => {});
  })(); }, []);
  useEffect(() => { if (cur === null) return; const t = setInterval(async () => {
    if (isSputnik(cur)) { try { await loadS(cur); } catch {} return; }
    try { const [ps, ds] = await Promise.all([view("get_proposals", { dao_id: cur }), view("list_daos")]); setProps(old => [...ps, ...old.filter(x => x.optimistic && x.id >= ps.length)]); setDaos(ds); } catch {} }, 1500);
    return () => clearInterval(t); }, [cur]);
  useEffect(() => { const x = props.find(q => q.id === pid); if (x && x.status === "Executing" && pane === "proposal" && dismissed !== pid) setAgent(true); }, [props, pid, pane, dismissed]);
  async function load() { for (let i = 0; i < 4; i++) { try { setDaos(await view("list_daos")); return; } catch (e) { await new Promise(r => setTimeout(r, 500 * (i + 1))); } } }
  async function loadS(id) { const r = await loadSputnik(id, { policy: pol.current?.[id] }); pol.current = { ...pol.current, [id]: r.policy };
    setSdao(r.dao); setProps(old => [...r.props, ...old.filter(x => x.optimistic && x.id >= r.props.length)]); return r; }
  useEffect(() => { if (!acct || !isSputnik(cur)) return setTier(null);
    Promise.all([viewAt(EXECUTOR, "auto_cap", { account_id: acct }), viewAt(EXECUTOR, "reputation", { account_id: acct })]).then(([c, r]) => setTier({ cap: c, rep: r })).catch(() => {}); }, [acct, cur, props.filter(x => x.status === "Executed").length]);
  async function open(id) {
    if (isSputnik(id)) { setCur(id); setPane("summary"); setLoadingP(true); setProps([]); try { await loadS(id); } catch (e) { flash("Could not load that Sputnik DAO"); } finally { setLoadingP(false); } return; }
    setCur(id); setPane("summary"); setLoadingP(true); try { setProps(await view("get_proposals", { dao_id: id })); } finally { setLoadingP(false); } }
  async function showP(d, p) { setPid(p); setPane("proposal"); if (isSputnik(d)) return; setVotes(await view("get_votes", { dao_id: d, proposal_id: p })); }
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
    if (d.sputnik) { setProps(ps => ps.map(q => q.id === x.id ? { ...q, yes: q.yes + 1, votes: [...q.votes, [acct, true]], status: q.yes + 1 >= d.need ? (q.action.AgentTask ? "Executing" : "Executed") : q.status } : q));
      if (!(await call("act_proposal", { id: x.id, action: "VoteApprove", proposal: x.kind }, "0", d.id, "300000000000000"))) setProps(snap); else flash("Vote recorded in the Sputnik DAO"); return; }
    setProps(ps => ps.map(q => q.id === x.id ? { ...q, yes: q.yes + w, status: (q.yes + w) * 100 >= d.total_weight * d.quorum_pct ? (q.action.AgentTask ? "Executing" : "Approved") : q.status } : q));
    setVotes(v => [...v, [acct, true]]);
    if (!(await call("vote", { dao_id: d.id, proposal_id: x.id, approve: true }))) setProps(snap); else flash("Vote recorded on NEAR");
  }
  async function refresh() {
    if (isSputnik(cur)) { try { await loadS(cur); } catch {} return; }
    try { await load(); if (cur !== null) { const ps = await view("get_proposals", { dao_id: cur }); setProps(old => [...ps, ...old.filter(x => x.optimistic && x.id >= ps.length)]); if (pid !== null) setVotes(await view("get_votes", { dao_id: cur, proposal_id: pid })); } } catch {}
  }
  // Returns true on success. Shows a short message on failure instead of throwing.
  async function call(methodName, args, deposit, receiverId = CONTRACT, gas = "100000000000000") {
    if (!acct) { modal?.show(); return false; }
    setBusy(true);
    try { const w = await sel.wallet();
      await w.signAndSendTransaction({ receiverId, actions: [methodName === "$transfer" ? { type: "Transfer", params: { deposit } } : { type: "FunctionCall", params: { methodName, args, gas, deposit: deposit || "0" } }] });
      refresh(); setTimeout(refresh, 1200); return true;
    } catch (e) { const m = String(e?.message || e); flash(m.includes("not a member") || m.includes("ERR_PERMISSION_DENIED") ? "Your wallet isn't on this DAO's council" : m.includes("already voted") ? "You already voted" : m.includes("reject") || m.includes("cancel") ? "Cancelled in wallet" : "Transaction failed: " + m.slice(0, 80)); return false; }
    finally { setBusy(false); }
  }
  const dao = isSputnik(cur) ? (sdao?.id === cur ? sdao : null) : daos.find(d => d.id === cur); const p = props.find(x => x.id === pid);

  const nav = <div className="nav"><div className="brandrow"><Drop size={26} /><Wordmark /><span className="net">● NEAR Testnet</span></div>
    <div style={{ position: "relative" }}>{acct
      ? <button className="btn" onClick={() => setMenu(!menu)}>👛 {short(acct)} ▾</button>
      : <button className="btn" onClick={() => modal?.show()}>👛 Connect wallet</button>}
      {menu && <div className="panel" style={{ position: "absolute", right: 0, top: 42, padding: 8, zIndex: 5 }}>
        <button className="btn sm" onClick={async () => { await sel.disconnect().catch(() => {}); setAcct(undefined); setMenu(false); }}>Sign out</button></div>}</div></div>;

  if (cur === null && pane !== "create-dao") return <>{nav}<div className="center fade">
    <div><Drop size={96} /></div><h1 style={{ margin: "4px 0" }}><Wordmark size={40} /></h1><p className="pitch">A DAO whose AI agent does real-world tasks after members vote.</p>
    <div className="hint" style={{ marginTop: -6 }}>Built on Sputnik DAO · the DAO keeps the money and the votes, LisDao adds the agent</div>
    <ol className="how">
      <li style={{ animationDelay: ".05s" }}><b>1</b>Vote on a task</li>
      <li style={{ animationDelay: ".15s" }}><b>2</b>The agent does it in a real browser</li>
      <li style={{ animationDelay: ".25s" }}><b>3</b>The DAO pays automatically</li></ol>
    <button className="btn p full big glow" onClick={() => open(DEMO_SPUTNIK)}>Demo DAO</button>
    <div className="hint">Try it: create a proposal, vote Yes, watch the agent</div>
    <button className="btn full" onClick={() => setPane("create-dao")}>Create New DAO</button>
    <button className="btn full" style={{ marginTop: 8 }} onClick={() => { const a = prompt("Your Sputnik DAO address", "name.sputnikv2.testnet"); if (a && isSputnik(a.trim())) open(a.trim()); else if (a) flash("Enter an address ending in .sputnikv2.testnet"); }}>Open my Sputnik DAO</button>
    </div>{toast && <div className="toast">{toast}</div>}</>;

  if (pane === "create-dao") return <>{nav}<div className="center fade" style={{ textAlign: "left" }}><div className="panel">
    <h2>Create New DAO</h2>
    <div className="muted">Creates a real Sputnik DAO on NEAR testnet. Sputnik needs about 6 NEAR to store the DAO; the rest becomes its treasury.</div>
    <label>DAO Name (lowercase, no spaces)</label><input placeholder="my-club" value={f.name} onChange={e => setF({ ...f, name: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} />
    <label>Council (comma separated, you are added)</label><input placeholder="alice.testnet, bob.testnet" value={f.members} onChange={e => setF({ ...f, members: e.target.value })} />
    <label>Votes needed</label><select value={f.th || "1/3"} onChange={e => setF({ ...f, th: e.target.value })}><option value="1/3">Any one council member (1 of N for small councils)</option><option value="1/2">Majority</option></select>
    <label>NEAR to attach</label><input inputMode="decimal" value={f.dep ?? "6.5"} onChange={e => setF({ ...f, dep: e.target.value })} />
    <button className="btn p full" disabled={busy} onClick={async () => { const nm = f.name.trim().replace(/^-+|-+$/g, ""); if (!/^[a-z0-9-]{2,40}$/.test(nm)) return flash("Give your DAO a short lowercase name");
      if (!acct) return modal.show(); const council = [...new Set([acct, ...f.members.split(",").map(x => x.trim()).filter(Boolean)])];
      const [a, b] = (f.th || "1/3").split("/").map(Number);
      const policy = { roles: [{ name: "council", kind: { Group: council }, permissions: ["*:*"], vote_policy: {} }, { name: "all", kind: "Everyone", permissions: ["*:AddProposal"], vote_policy: {} }],
        default_vote_policy: { weight_kind: "RoleWeight", quorum: "0", threshold: [a, b] }, proposal_bond: "10000000000000000000000", proposal_period: "604800000000000", bounty_bond: "100000000000000000000000", bounty_forgiveness_period: "604800000000000" };
      const args = btoa(JSON.stringify({ config: { name: nm, purpose: "LisDao: council votes, AI agent executes tasks", metadata: "" }, policy }));
      if (await call("create", { name: nm, args }, toYocto(f.dep ?? "6.5"), FACTORY, "300000000000000")) { flash("Sputnik DAO created"); setTimeout(() => open(nm + "." + FACTORY), 1500); } }}>{busy ? "Creating..." : "Create Sputnik DAO"}</button>
    <button className="btn full" style={{ marginTop: 8 }} onClick={() => { setPane("summary"); }}>← Back</button></div></div>{toast && <div className="toast">{toast}</div>}</>;

  if (!dao) return <>{nav}<div className="grid"><div className="panel">{[0, 1, 2].map(i => <div key={i} className="sk big" />)}</div>
    <div className="panel">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="sk" />)}</div></div>{toast && <div className="toast">{toast}</div>}</>;
  const votes2 = dao.sputnik ? (p?.votes || []) : votes;
  const used = votes2.length ? votes2.reduce((s, [a]) => s + (dao.members.find(m => m[0] === a)?.[1] || 0), 0) : 0;
  const myW = dao.members.find(m => m[0] === acct)?.[1] || 0; const goal = dao.sputnik ? dao.need : dao.total_weight;
  const pct = p ? Math.min(100, Math.round(100 * p.yes / (dao.sputnik ? dao.need : dao.total_weight))) : 0;
  const stage = pane === "create" ? 1 : pane === "proposal" && p ? ({ Active: 2, Approved: 2, Executing: 3, Executed: 5, Escalated: 4, Failed: 3, Rejected: 2 }[p.status] ?? 2) : 0;

  return <>{nav}{toast && <div className="toast">{toast}</div>}{agent && p && <Agent dao={dao} p={p} onClose={() => { setAgent(false); setDismissed(pid); }} />}
    <div className="wrap"><Stepper at={stage} /></div>
    <div className="grid">
      <div className="panel">
        <div className="row"><h2 style={{ margin: 0 }}>{dao.name}</h2><select className="btn sm" value={dao.id} onChange={e => e.target.value === "home" ? (setCur(null), setPane("summary")) : open(isSputnik(e.target.value) ? e.target.value : +e.target.value)} aria-label="Switch DAO">
          <option value={DEMO_SPUTNIK}>LisDao Demo (Sputnik)</option>{isSputnik(dao.id) && dao.id !== DEMO_SPUTNIK && <option value={dao.id}>{dao.name} (Sputnik)</option>}<option value="home">← Home</option></select></div>
        <div className="row" style={{ marginTop: 24 }}><h3 style={{ margin: 0 }}>Proposals</h3><button className="btn p sm" onClick={() => setPane("create")}>Create New Proposal</button></div>
        <div className={"card" + (pane === "summary" ? " on" : "")} onClick={() => setPane("summary")}>Summary</div>
        {loadingP && [0, 1].map(i => <div key={i} className="sk big" />)}
        {props.slice().reverse().map(x => <div key={x.id} className={"card" + (x.id === pid && pane === "proposal" ? " on" : "")} onClick={() => showP(dao.id, x.id)}>
          <div className="row"><span>{x.title}</span><span className={"badge " + badge(x.status)}>{badge(x.status)}</span></div></div>)}
      </div>
      <div className="panel fade" key={pane + pid}>
        {pane === "summary" && <>
          <Next>Create a proposal to start <button className="btn p sm" onClick={() => setPane("create")}>Create proposal</button></Next>
          <h2>Summary</h2>
          {dao.sputnik ? <>{[["Name", dao.name], ["Sputnik DAO", <a key="a" href={`https://testnet.nearblocks.io/address/${dao.id}`} target="_blank">{dao.id} ↗</a>], ["Balance in NEAR", yocto(dao.treasury)],
            ["Votes needed", `${dao.need} of ${dao.total_weight} council`], ["AI executor", EXECUTOR], ["Your auto-approve tier", acct ? (tier ? `${yocto(tier.cap)} NEAR · reputation ${tier.rep}` : "…") : "connect wallet"]]
            .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
            <div className="muted" style={{ marginTop: 8 }}>Money and votes stay in the Sputnik DAO. When a task passes, the DAO escrows its spending cap with the LisDao executor. Payouts within your tier are paid at once; bigger ones go back to the council as a normal Sputnik Transfer proposal. Each finished task raises your tier.</div></>
          : [["Name", dao.name], ["Created At", "DAO #" + dao.id + " on NEAR testnet"], ["Creator Account", dao.owner], ["Balance in NEAR", yocto(dao.treasury)], ["Agent", dao.agent], ["Quorum", dao.quorum_pct + "%"]]
            .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          <button className="btn full" style={{ marginTop: 12 }} disabled={busy} onClick={() => { const n = prompt("Deposit how much NEAR into the treasury?", "1"); if (n && +n > 0) (dao.sputnik ? call("$transfer", {}, toYocto(n), dao.id) : call("deposit", { dao_id: dao.id }, toYocto(n))).then(ok => ok && flash("Deposit sent")); }}>+ Deposit NEAR</button>
          <h3 style={{ marginTop: 28 }}>{dao.sputnik ? "Council" : "Members"}</h3>
          <div className="muted">Your votes: {myW} out of {dao.total_weight}</div>
          <table style={{ marginTop: 10 }}><thead><tr><th>WALLET ADDRESS</th><th>VOTES</th><th>ACTIONS</th></tr></thead><tbody>
            {dao.members.map(([a, w]) => <tr key={a}><td>{a}</td><td>{w} ({Math.round(100 * w / dao.total_weight)}%)</td>
              <td><button className="btn sm" title="Edit votes" onClick={() => { if (dao.sputnik) return flash("Council changes are made with a Sputnik proposal"); if (acct !== dao.owner) return flash("Only the DAO owner can edit votes"); const n = prompt("New votes for " + a, w); if (n !== null && n.trim() !== "" && +n >= 0) call("set_member", { dao_id: dao.id, account_id: a, weight: Math.floor(+n) }); }}>✎</button></td></tr>)}
          </tbody></table></>}
        {pane === "create" && <>
          <div className="row"><h2>Create Proposal</h2><button className="btn sm" onClick={() => setPane("summary")}>← Back</button></div>
          <Next>Describe the task in plain English, then create it</Next>
          <div className="seg"><button className={"btn" + (f.kind !== "transfer" ? " p" : "")} onClick={() => setF({ ...f, kind: "agent" })}>AI agent task</button>
            <button className={"btn" + (f.kind === "transfer" ? " p" : "")} onClick={() => setF({ ...f, kind: "transfer" })}>Send NEAR</button></div>
          <label>Proposal Title</label><input placeholder="Donate to the water project" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          {f.kind === "transfer" ? <>
            <label>Send to (NEAR account)</label><input placeholder="friend.testnet" value={f.to || ""} onChange={e => setF({ ...f, to: e.target.value.trim() })} />
            <label>Amount (NEAR)</label><input inputMode="decimal" placeholder="0.1" value={f.amt || ""} onChange={e => setF({ ...f, amt: e.target.value })} />
          </> : <>
            <label>What should the agent do?</label><textarea rows={4} placeholder="Donate 0.1 NEAR to the water project" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} />
          </>}
          <button className="btn p full big" disabled={busy} onClick={async () => {
            const title = f.title.trim() || (f.kind === "transfer" ? "Send NEAR" : "Donate to the water project");
            let action;
            if (f.kind === "transfer") {
              if (!/^[a-z0-9._-]{2,64}$/.test(f.to || "") || !(+f.amt > 0)) return flash("Enter a valid account and amount");
              action = { Transfer: { receiver_id: f.to, amount: toYocto(f.amt) } };
            } else {
              const desc = f.desc.trim() || "Donate 0.1 NEAR to the water project";
              action = { AgentTask: { instructions: desc, max_spend: toYocto((desc.match(/([\d.]+)\s*NEAR/i) || [0, "0.1"])[1]) } };
            }
            const n = props.length;
            let sent, kind;
            if (dao.sputnik) {
              const last = await viewAt(dao.id, "get_last_proposal_id").catch(() => n);
              kind = action.Transfer ? { Transfer: { token_id: "", receiver_id: action.Transfer.receiver_id, amount: action.Transfer.amount } }
                : { FunctionCall: { receiver_id: EXECUTOR, actions: [{ method_name: "dispatch_task", deposit: action.AgentTask.max_spend, gas: "50000000000000",
                    args: btoa(JSON.stringify({ title, instructions: action.AgentTask.instructions, max_spend: action.AgentTask.max_spend, proposer: acct, proposal_id: last })) }] } };
              sent = await call("add_proposal", { proposal: { description: action.AgentTask ? `${title}: ${action.AgentTask.instructions}` : title, kind } }, dao.policy.proposal_bond, dao.id);
            } else sent = await call("propose", { dao_id: dao.id, title, action });
            if (sent) { flash("Proposal created"); setF({ ...f, title: "", desc: "", to: "", amt: "" });
              const optimistic = { id: n, proposer: acct, title, action, kind, yes: 0, no: 0, votes: [], status: "Active", deadline_ns: String(BigInt(Date.now()) * 1000000n + BigInt(dao.voting_period_ns)), result: null, optimistic: true };
              setProps(ps => ps.some(x => x.id === n) ? ps : [...ps, optimistic]); setPid(n); setVotes([]); setPane("proposal"); } }}>{busy ? "Creating..." : "Create Proposal"}</button></>}
        {pane === "proposal" && p && <>
          <div className="row"><h1 style={{ marginTop: 0 }}>{p.title}</h1><button className="btn sm" onClick={() => setPane("summary")}>← Back</button></div>
          {p.status === "Escalated" && <Next>Above the auto-approve tier. Council: vote on the new Transfer proposal</Next>}
          {p.status === "Active" && <Next>{votes2.some(v => v[0] === acct) ? "Waiting for more Yes votes" : "Vote Yes to send it to the agent"}</Next>}
          {p.status === "Executing" && <Next><span className="pulse" /> The agent is working…</Next>}
          {p.status === "Executed" && <Next>Done. The DAO paid on-chain {p.result && <span className="muted"> · see receipt below</span>}</Next>}
          {p.status === "Approved" && <Next>Passed. Execute the transfer</Next>}
          <p className="muted">{p.action.AgentTask ? `${p.action.AgentTask.instructions} · cap ${yocto(p.action.AgentTask.max_spend)} NEAR` : p.action.Other ? `Sputnik ${p.action.Other} proposal` : `${p.escalatedFrom ? "Escalated by the AI executor · " : ""}Transfer ${yocto(p.action.Transfer.amount)} NEAR to ${p.action.Transfer.receiver_id}`}</p>
          <div className="panel" style={{ background: "#FFFBF7", boxShadow: "none", border: "1px solid var(--line)" }}>
            {[["Status", p.status === "Active" ? "Voting In Progress" : p.status === "Executing" ? "Passed · Agent executing in browser" : p.status === "Executed" ? "Passed · Executed" : p.status === "Escalated" ? "Passed · payout sent to council vote" : p.status],
              ["Created", fmt(BigInt(p.deadline_ns) - BigInt(dao.voting_period_ns))], ["Voting Ends", fmt(p.deadline_ns)], ["Created by", p.proposer]]
              .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          </div>
          <div className="row" style={{ margin: "20px 0" }}><b>Progress: {p.yes} / {goal} votes{dao.sputnik ? " needed" : ""}</b><div className="bar"><i style={{ width: pct + "%" }} /></div><span>{pct}%</span></div>
          {p.status === "Active" && (votes2.some(v => v[0] === acct) ? <div className="receipt">You voted. Waiting for others…</div> : <>
            <button className="btn p full big" disabled={busy} onClick={() => vote(dao, p, myW || 1)}>{busy ? "Voting..." : "Vote Yes"}</button>
            <button className="btn full" style={{ marginTop: 8 }} disabled={busy} onClick={() => voteNo(dao, p, myW || 1)}>Vote No</button></>)}
          {p.status === "Approved" && <button className="btn p full" disabled={busy} onClick={() => call("execute", { dao_id: dao.id, proposal_id: p.id })}>{busy ? "Executing..." : "Execute transfer"}</button>}
          {(p.action.AgentTask && ["Executing", "Executed", "Failed", "Escalated"].includes(p.status)) && <button className="btn p full big" onClick={() => { setDismissed(null); setAgent(true); }}>Watch the agent</button>}
          {p.result && <div className="receipt" style={{ marginTop: 14 }}><b>Agent report (on-chain):</b> {p.result}</div>}
        </>}
      </div></div></>;
}
