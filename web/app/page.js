"use client";
import { useEffect, useState } from "react";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupModal } from "@near-wallet-selector/modal-ui";
import { setupMyNearWallet } from "@near-wallet-selector/my-near-wallet";
import { setupMeteorWallet } from "@near-wallet-selector/meteor-wallet";

const CONTRACT = process.env.NEXT_PUBLIC_CONTRACT_ID || "lisdao-1793738031.testnet";
const RPC = "https://rpc.testnet.near.org";

async function view(method, args = {}) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "call_function", finality: "final",
      account_id: CONTRACT, method_name: method, args_base64: btoa(JSON.stringify(args)) } }) });
  const j = await r.json(); if (j.error || j.result?.error) throw new Error(JSON.stringify(j.error || j.result.error));
  return JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
}

export default function Home() {
  const [sel, setSel] = useState(); const [modal, setModal] = useState(); const [acct, setAcct] = useState();
  const [daos, setDaos] = useState([]); const [cur, setCur] = useState(null); const [props, setProps] = useState([]);
  const [f, setF] = useState({ name: "", members: "", quorum: 51, agent: CONTRACT, title: "", task: "", budget: 10 });

  useEffect(() => { (async () => {
    const s = await setupWalletSelector({ network: "testnet", modules: [setupMyNearWallet(), setupMeteorWallet()] });
    setSel(s); setModal(setupModal(s, { contractId: CONTRACT }));
    const upd = st => setAcct(st.accounts.find(a => a.active)?.accountId); upd(s.store.getState()); s.store.observable.subscribe(upd);
    load();
  })(); }, []);
  async function load() { setDaos(await view("list_daos")); }
  async function open(id) { setCur(id); setProps(await view("get_proposals", { dao_id: id })); }
  async function call(methodName, args) {
    const w = await sel.wallet();
    await w.signAndSendTransaction({ receiverId: CONTRACT, actions: [{ type: "FunctionCall",
      params: { methodName, args, gas: "100000000000000", deposit: "0" } }] });
    await load(); if (cur !== null) await open(cur);
  }
  const inp = (k, p) => <input placeholder={p} value={f[k]} onChange={e => setF({ ...f, [k]: e.target.value })} style={{ display: "block", width: "100%", margin: "4px 0", padding: 6 }} />;
  const dao = daos.find(d => d.id === cur);

  return <main>
    <h1>LisDAO</h1><p>DAOs whose votes are carried out in the real world by an AI agent, settled on NEAR.</p>
    {acct ? <p>Signed in as <b>{acct}</b> <button onClick={async () => (await sel.wallet()).signOut()}>Sign out</button></p>
          : <button onClick={() => modal.show()}>Connect NEAR wallet</button>}
    <h2>Create a DAO</h2>
    {inp("name", "DAO name")}{inp("members", "members: alice.testnet:3, bob.testnet:1")}{inp("quorum", "quorum %")}{inp("agent", "agent account")}
    <button disabled={!acct} onClick={() => call("create_dao", { name: f.name, agent: f.agent, quorum_pct: +f.quorum, voting_period_minutes: 10080,
      members: f.members.split(",").map(s => s.trim()).filter(Boolean).map(s => { const [a, w] = s.split(":"); return [a, +(w || 1)]; }) })}>Create</button>
    <h2>DAOs</h2>
    {daos.map(d => <div key={d.id} onClick={() => open(d.id)} style={{ cursor: "pointer", border: "1px solid #ccc", padding: 8, margin: 4 }}>#{d.id} {d.name} · {d.members.length} members · quorum {d.quorum_pct}%</div>)}
    {dao && <section>
      <h2>{dao.name}</h2>
      <h3>Voting power</h3>
      {dao.members.map(([a, w]) => <div key={a}>{a}: {w} ({Math.round(100 * w / dao.total_weight)}%)</div>)}
      <h3>New proposal for the agent</h3>
      {inp("title", "title")}{inp("task", "plain-English task, e.g. Donate $20 to Red Cross")}{inp("budget", "max spend USD")}
      <button disabled={!acct} onClick={() => call("propose", { dao_id: dao.id, title: f.title, action: { AgentTask: { instructions: f.task, max_spend_usd: +f.budget } } })}>Propose</button>
      <h3>Proposals</h3>
      {props.map(p => <div key={p.id} style={{ border: "1px solid #ddd", padding: 8, margin: 4 }}>
        <b>{p.title}</b> — {p.status} · yes {p.yes} / no {p.no} of {dao.total_weight}
        <div>{p.action.AgentTask?.instructions}</div>
        {p.result && <div>Agent report: {p.result}</div>}
        {p.status === "Active" && <><button onClick={() => call("vote", { dao_id: dao.id, proposal_id: p.id, approve: true })}>Yes</button>
          <button onClick={() => call("vote", { dao_id: dao.id, proposal_id: p.id, approve: false })}>No</button></>}
        {p.status === "Approved" && <button onClick={() => call("execute", { dao_id: dao.id, proposal_id: p.id })}>Send to agent</button>}
      </div>)}
    </section>}
  </main>;
}
