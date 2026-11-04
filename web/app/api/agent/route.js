// Live agent step feed. The agent (running on its own machine) POSTs steps; the UI polls GET.
import { putJson, listJson } from "../../../lib/store";
import { tokenOk } from "../../../lib/token";
export const dynamic = "force-dynamic";
const MAX_SHOT = 400_000; // base64 chars (~300 KB JPEG); agent shots are 420x760 q45
const B64 = /^[A-Za-z0-9+/]+={0,2}$/, TX = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/;
const ADDR = /^([0-9a-f]{64}|([a-z0-9_-]+\.)+(testnet|near))$/, PHASES = new Set(["start", "done", "failed"]);
const pad = n => String(n).padStart(15, "0");
export async function POST(req) {
  const tok = process.env.AGENT_FEED_TOKEN;
  if (!tok) return new Response("feed disabled: AGENT_FEED_TOKEN not set on server", { status: 503 });
  if (!tokenOk(req.headers.get("x-agent-token"), tok)) return new Response("forbidden", { status: 403 });
  const e = await req.json().catch(() => null); if (!e || typeof e !== "object") return new Response("bad json", { status: 400 }); const t = Date.now();
  if (!Number.isInteger(e.dao_id) || !Number.isInteger(e.proposal_id)) return new Response("bad request", { status: 400 });
  if (e.shot != null && (typeof e.shot !== "string" || e.shot.length > MAX_SHOT || !B64.test(e.shot))) return new Response("bad shot", { status: 400 });
  if (e.phase != null && !PHASES.has(e.phase)) return new Response("bad phase", { status: 400 });
  if (e.tx != null && !TX.test(e.tx)) return new Response("bad tx", { status: 400 });
  if (e.address != null && !ADDR.test(e.address)) return new Response("bad address", { status: 400 });
  const rec = { dao_id: e.dao_id, proposal_id: e.proposal_id, text: String(e.text || "").slice(0, 600), shot: e.shot || null,
    phase: e.phase || null, tx: e.tx || null, address: e.address || null, escalated: !!e.escalated, reset: !!e.reset, t };
  await putJson(`feed/${e.dao_id}-${e.proposal_id}/${pad(t)}-${Math.random().toString(36).slice(2, 7)}.json`, rec);
  return Response.json({ ok: true });
}
export async function GET(req) {
  const u = new URL(req.url); const d = +u.searchParams.get("dao"), p = +u.searchParams.get("pid"), since = +(u.searchParams.get("since") || 0);
  let list = await listJson(`feed/${d}-${p}/`, `feed/${d}-${p}/${pad(since)}~`);
  const r = list.map(x => x.reset).lastIndexOf(true); if (r > 0) list = list.slice(r);
  return Response.json(list, { headers: { "Cache-Control": "no-store" } });
}
