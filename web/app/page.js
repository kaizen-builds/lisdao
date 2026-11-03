"use client";
import { useEffect, useState } from "react";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "lisdao-1793738031.testnet";
const RPC = "https://rpc.testnet.near.org";
async function view(method, args = {}) {
  for (let i = 0; ; i++) { try { return await view1(method, args); } catch (e) { if (i > 2) throw e; await new Promise(r => setTimeout(r, 800)); } }
}
async function view1(method, args) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final",
      account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
  const j = await r.json(); if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
}
const short = a => a && a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a;
const badge = s => ({ Active: "Voting", Approved: "Passed", Executing: "Passed", Executed: "Passed", Rejected: "Rejected", Failed: "Rejected" }[s]);
const yocto = y => (Number(BigInt(y) / 10n ** 20n) / 1e4).toFixed(4);
const fmt = ns => new Date(Number(BigInt(ns) / 1000000n)).toLocaleString();

function Agent({ p, onClose }) {
  const task = p.action.AgentTask?.instructions || p.title;
  const steps = ["Reading approved proposal from NEAR", `Planning: "${task}"`, "Opening browser", "Filling checkout form", "Confirming payment", "Capturing receipt (OCR)", "Reporting result on-chain"];
  const [n, setN] = useState(0);
  useEffect(() => { const t = setInterval(() => setN(x => Math.min(x + 1, steps.length)), 900); return () => clearInterval(t); }, []);
  const done = n >= steps.length;
  return <div className="agent"><div className="chrome"><span /><span /><span /> lisdao-agent · browser</div>
    <div className="screen">
      {steps.slice(0, n).map((s, i) => <div className="step" key={i}>✓ {s}</div>)}
      {!done && <div style={{ position: "relative", height: 60 }}><div className="ripple" style={{ left: 120, top: 20 }} /><div className="ripple b" style={{ left: 120, top: 20 }} /></div>}
      {done && <div className="receipt"><b>Reported on-chain</b><div style={{ marginTop: 6 }}>{p.result || "Waiting for agent report…"}</div>
        <div style={{ marginTop: 6, fontSize: 12 }}>Status: {p.status}</div></div>}
    </div>
    <div style={{ padding: 10 }}><button className="btn full" onClick={onClose}>Close</button></div></div>;
}

export default function Home() {
  const [sel, setSel] = useState(); const [modal, setModal] = useState(); const [acct, setAcct] = useState();
  const [daos, setDaos] = useState([]); const [cur, setCur] = useState(null); const [props, setProps] = useState([]);
  const [votes, setVotes] = useState([]); const [pane, setPane] = useState("summary"); const [pid, setPid] = useState(null);
  const [agent, setAgent] = useState(false); const [busy, setBusy] = useState(false); const [menu, setMenu] = useState(false);
  const [f, setF] = useState({ name: "", members: "", quorum: 51, title: "", desc: "" });

  useEffect(() => { (async () => {
    const q = new URLSearchParams(location.search);
    try {
      await load();
      if (q.get("dao")) { const d = +q.get("dao"); await open(d); if (q.get("p")) await showP(d, +q.get("p")); }
      if (q.get("pane")) setPane(q.get("pane")); if (q.get("agent")) setAgent(true);
    } catch (e) { console.error("init", e); }
    const s = await setupWalletSelector({ network: "testnet", modules: [setupMyNearWallet(), setupMeteorWallet()] });
    setSel(s); setModal(setupModal(s, { contractId: CONTRACT }));
    const upd = st => setAcct(st.accounts.find(a => a.active)?.accountId); upd(s.store.getState()); s.store.observable.subscribe(upd);
  })(); }, []);
  async function load() { setDaos(await view("list_daos")); }
  async function open(id) { setCur(id); setPane("summary"); setProps(await view("get_proposals", { dao_id: id })); }
  async function showP(d, p) { setPid(p); setPane("proposal"); setVotes(await view("get_votes", { dao_id: d, proposal_id: p })); }
  async function call(methodName, args) {
    if (!acct) return modal.show();
    setBusy(true);
    try { const w = await sel.wallet();
      await w.signAndSendTransaction({ receiverId: CONTRACT, actions: [{ type: "FunctionCall", params: { methodName, args, gas: "100000000000000", deposit: "0" } }] });
      await load(); if (cur !== null) { setProps(await view("get_proposals", { dao_id: cur })); if (pid !== null) setVotes(await view("get_votes", { dao_id: cur, proposal_id: pid })); }
    } finally { setBusy(false); }
  }
  const dao = daos.find(d => d.id === cur); const p = props.find(x => x.id === pid);

  const nav = <div className="nav"><div className="net">● NEAR Testnet</div>
    <div style={{ position: "relative" }}>{acct
      ? <button className="btn" onClick={() => setMenu(!menu)}>👛 {short(acct)} ▾</button>
      : <button className="btn" onClick={() => modal?.show()}>👛 Connect wallet</button>}
      {menu && <div className="panel" style={{ position: "absolute", right: 0, top: 42, padding: 8, zIndex: 5 }}>
        <button className="btn sm" onClick={async () => { (await sel.wallet()).signOut(); setMenu(false); }}>Sign out</button></div>}</div></div>;

  if (cur === null && pane !== "create-dao") return <>{nav}<div className="center">
    <div className="logo">✦</div><h1 className="brand">LisDAO</h1><div className="muted">Select a DAO to continue:</div>
    {daos.map(d => <button key={d.id} className="btn full" onClick={() => open(d.id)}>{d.name}</button>)}
    <button className="btn p full" onClick={() => setPane("create-dao")}>Create New DAO</button></div></>;

  if (pane === "create-dao") return <>{nav}<div className="center" style={{ textAlign: "left" }}><div className="panel">
    <h2>Create New DAO</h2>
    <label>DAO Name</label><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} />
    <label>Members (account:votes)</label><input placeholder="alice.testnet:3, bob.testnet:1" value={f.members} onChange={e => setF({ ...f, members: e.target.value })} />
    <label>Quorum %</label><input value={f.quorum} onChange={e => setF({ ...f, quorum: e.target.value })} />
    <button className="btn p full" disabled={busy} onClick={async () => { await call("create_dao", { name: f.name, agent: CONTRACT, quorum_pct: +f.quorum, voting_period_minutes: 10080,
      members: f.members.split(",").map(s => s.trim()).filter(Boolean).map(s => { const [a, w] = s.split(":"); return [a, +(w || 1)]; }) }); setPane("summary"); }}>{busy ? "Creating..." : "Create DAO"}</button>
    <button className="btn full" style={{ marginTop: 8 }} onClick={() => setPane("summary")}>Back</button></div></div></>;

  if (!dao) return nav;
  const used = votes.length ? votes.reduce((s, [a]) => s + (dao.members.find(m => m[0] === a)?.[1] || 0), 0) : 0;
  const myW = dao.members.find(m => m[0] === acct)?.[1] || 0;
  const pct = p ? Math.round(100 * p.yes / dao.total_weight) : 0;

  return <>{nav}{agent && p && <Agent p={p} onClose={() => setAgent(false)} />}
    <div className="grid">
      <div className="panel">
        <div className="row"><h2 style={{ margin: 0 }}>{dao.name}</h2><button className="btn sm" onClick={() => { setCur(null); setPane("summary"); }}>Switch</button></div>
        <div className="row" style={{ marginTop: 24 }}><h3 style={{ margin: 0 }}>Proposals</h3><button className="btn p sm" onClick={() => setPane("create")}>Create New Proposal</button></div>
        <div className="card" onClick={() => setPane("summary")} style={{ background: "#F9FAFB" }}>Summary</div>
        {props.slice().reverse().map(x => <div key={x.id} className={"card" + (x.id === pid && pane === "proposal" ? " on" : "")} onClick={() => showP(dao.id, x.id)}>
          <div className="row"><span>{x.title}</span><span className={"badge " + badge(x.status)}>{badge(x.status)}</span></div></div>)}
      </div>
      <div className="panel">
        {pane === "summary" && <>
          <h2>Summary</h2>
          {[["Name", dao.name], ["Created At", "DAO #" + dao.id + " on NEAR testnet"], ["Creator Account", dao.owner], ["DAO Account", CONTRACT + " #" + dao.id], ["Balance in NEAR", yocto(dao.treasury)], ["Agent", dao.agent], ["Quorum", dao.quorum_pct + "%"]]
            .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          <h3 style={{ marginTop: 28 }}>Members</h3>
          <div className="muted">Remaining Votes: {myW} out of {dao.total_weight}</div>
          <table style={{ marginTop: 10 }}><thead><tr><th>WALLET ADDRESS</th><th>VOTES</th><th>ACTIONS</th></tr></thead><tbody>
            {dao.members.map(([a, w]) => <tr key={a}><td>{a}</td><td>{w} ({Math.round(100 * w / dao.total_weight)}%)</td>
              <td><button className="btn sm" title="Edit votes" onClick={() => { const n = prompt("New votes for " + a, w); if (n !== null) call("set_member", { dao_id: dao.id, account_id: a, weight: +n }); }}>✎</button></td></tr>)}
          </tbody></table></>}
        {pane === "create" && <>
          <h2>Create Proposal</h2>
          <label>Proposal Title</label><input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
          <label>Proposal Description</label><textarea rows={5} placeholder="donate 0.1 NEAR to the water project" value={f.desc} onChange={e => setF({ ...f, desc: e.target.value })} />
          <button className="btn p" disabled={busy} onClick={async () => { await call("propose", { dao_id: dao.id, title: f.title, action: { AgentTask: { instructions: f.desc, max_spend_usd: 50 } } }); setPane("summary"); }}>{busy ? "Creating..." : "Create Proposal"}</button></>}
        {pane === "proposal" && p && <>
          <h1 style={{ marginTop: 0 }}>{p.title}</h1>
          <p className="muted">{p.action.AgentTask?.instructions || `Transfer ${yocto(p.action.Transfer.amount)} NEAR to ${p.action.Transfer.receiver_id}`}</p>
          <div className="panel" style={{ background: "#F9FAFB", boxShadow: "none", border: "1px solid #E5E7EB" }}>
            {[["Status", p.status === "Active" ? "Voting In Progress" : p.status === "Executing" ? "Passed · Agent executing" : p.status === "Executed" ? "Passed · Executed" : p.status],
              ["Created", fmt(BigInt(p.deadline_ns) - BigInt(dao.voting_period_ns))], ["Voting Ends", fmt(p.deadline_ns)], ["Created by", p.proposer]]
              .map(([k, v]) => <div className="kv" key={k}><b>{k}</b><span>{v}</span></div>)}
          </div>
          <div className="row" style={{ margin: "20px 0" }}><b>Progress: {p.yes} / {dao.total_weight} votes</b><div className="bar"><i style={{ width: pct + "%" }} /></div><span>{pct}%</span></div>
          {p.status === "Active" && <button className="btn p full" disabled={busy} onClick={() => call("vote", { dao_id: dao.id, proposal_id: p.id, approve: true })}>{busy ? "Voting..." : "Vote Yes"}</button>}
          {p.status === "Approved" && <button className="btn p full" disabled={busy} onClick={async () => { await call("execute", { dao_id: dao.id, proposal_id: p.id }); setAgent(true); }}>{busy ? "Sending..." : "Send to Agent"}</button>}
          {(p.status === "Executing" || p.status === "Executed" || p.status === "Failed") && <button className="btn p full" onClick={() => setAgent(true)}>View Agent Execution</button>}
          {p.result && <div className="receipt" style={{ marginTop: 14 }}><b>Agent report (on-chain):</b> {p.result}</div>}
        </>}
      </div></div></>;
}
