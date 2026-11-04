// Sputnik DAO v2 adapter: reads a Sputnik DAO + the LisDao executor and maps
// them to the same shapes the UI uses for proposals.
export const FACTORY = "sputnikv2.testnet";
export const EXECUTOR = process.env.NEXT_PUBLIC_EXECUTOR_ID || "exec.lisdao-v2-1793741346.testnet";
export const DEMO_SPUTNIK = process.env.NEXT_PUBLIC_SPUTNIK_DAO || "lisdao-demo.sputnikv2.testnet";
export const FEED_DAO = 9000; // live feed key for executor tasks
export const RPCS = ["https://rpc.testnet.near.org", "https://test.rpc.fastnear.com"];
let rpcI = 0;
// Try each testnet RPC (6 s timeout each), up to 2 rounds; log real errors, throw only if all fail.
export async function rpcCall(method, params) {
  const errs = [];
  for (let i = 0; i < RPCS.length * 2; i++) {
    const url = RPCS[(rpcI + i) % RPCS.length]; const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(url, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const j = await r.json(); if (j.error || j.result?.error) { const e = new Error(JSON.stringify(j.error || j.result.error)); e.rpc = true; throw e; }
      rpcI = (rpcI + i) % RPCS.length; return j.result;
    } catch (e) { errs.push(url + ": " + (e?.message || e)); if (e.rpc && i >= 1) break; } finally { clearTimeout(to); }
  }
  console.error("NEAR RPC failed", method, errs); throw new Error(errs[errs.length - 1]);
}
const rpc = params => rpcCall("query", params);
export async function viewAt(account_id, method_name, args = {}) {
  const r = await rpc({ request_type: "call_function", finality: "optimistic", account_id, method_name, args_base64: btoa(JSON.stringify(args)) });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result)));
}
const b64json = s => { try { return JSON.parse(atob(s)); } catch { return {}; } };
export const isSputnik = id => typeof id === "string" && id.endsWith("." + FACTORY);
// Sputnik ratio threshold: min(floor(n * num / den) + 1, n)
export const needed = (policy, n) => { const t = policy.default_vote_policy.threshold; return Array.isArray(t) ? Math.min(Math.floor(n * t[0] / t[1]) + 1, n) : Math.min(+t, n); };

export async function loadSputnik(id, cache = {}) {
  const [policy, acct, list, tasks] = await Promise.all([cache.policy || viewAt(id, "get_policy"),
    rpc({ request_type: "view_account", finality: "optimistic", account_id: id }),
    viewAt(id, "get_proposals", { from_index: 0, limit: 200 }), viewAt(EXECUTOR, "get_tasks", { dao: id }).catch(() => [])]);
  const council = policy.roles.filter(r => r.kind.Group && (r.permissions.includes("*:*") || r.permissions.some(p => p.endsWith(":VoteApprove")))).flatMap(r => r.kind.Group);
  const members = [...new Set(council)].map(a => [a, 1]);
  const free = BigInt(acct.amount) - BigInt(acct.storage_usage) * 10n ** 19n; // storage costs 1e19 yocto / byte
  const dao = { id, sputnik: true, name: (id.split(".")[0]).replace(/-/g, " "), owner: id, agent: EXECUTOR, policy,
    quorum_pct: Math.ceil(100 * needed(policy, members.length) / Math.max(1, members.length)), need: needed(policy, members.length),
    voting_period_ns: policy.proposal_period, treasury: (free > 0n ? free : 0n).toString(), total_weight: members.length, members };
  const props = list.map(x => {
    const fc = x.kind.FunctionCall, tr = x.kind.Transfer; let action, task;
    const dispatch = fc && fc.receiver_id === EXECUTOR && fc.actions.find(a => a.method_name === "dispatch_task");
    if (dispatch) { const a = b64json(dispatch.args); action = { AgentTask: { instructions: a.instructions || x.description, max_spend: a.max_spend || dispatch.deposit } };
      task = tasks.find(t => t.proposal_id === x.id) || tasks.find(t => t.title === a.title && !t.proposal_id && t.proposal_id !== 0); }
    else if (tr) action = { Transfer: { receiver_id: tr.receiver_id, amount: tr.amount } };
    else action = { Other: Object.keys(x.kind)[0] };
    const st = x.status;
    let status = st === "InProgress" ? "Active" : st === "Approved" ? (dispatch ? (task ? task.status : "Executing") : "Executed") : st === "Rejected" || st === "Removed" ? "Rejected" : "Failed";
    const v = Object.entries(x.votes || {});
    return { id: x.id, proposer: x.proposer, title: x.description.slice(0, 90), action, kind: x.kind, status,
      yes: v.filter(([, s]) => s === "Approve").length, no: v.filter(([, s]) => s === "Reject").length,
      votes: v.map(([a, s]) => [a, s === "Approve"]), deadline_ns: (BigInt(x.submission_time) + BigInt(policy.proposal_period)).toString(),
      result: task?.result || null, task, feed: task ? [FEED_DAO, task.id] : null, escalatedFrom: x.proposer === EXECUTOR };
  });
  return { dao, props, policy };
}
