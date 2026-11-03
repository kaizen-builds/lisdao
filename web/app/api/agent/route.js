// Live agent step feed. The agent POSTs steps (with optional screenshot); the UI polls GET.
export const dynamic = "force-dynamic";
const store = globalThis.__lisAgent || (globalThis.__lisAgent = new Map());
const k = (d, p) => `${d}:${p}`;
export async function POST(req) {
  const tok = process.env.AGENT_FEED_TOKEN;
  if (tok && req.headers.get("x-agent-token") !== tok) return new Response("forbidden", { status: 403 });
  const e = await req.json(); const key = k(e.dao_id, e.proposal_id);
  const list = store.get(key) || []; if (e.reset) list.length = 0;
  list.push({ ...e, t: Date.now() }); store.set(key, list.slice(-60));
  return Response.json({ ok: true });
}
export async function GET(req) {
  const u = new URL(req.url); const list = store.get(k(u.searchParams.get("dao"), u.searchParams.get("pid"))) || [];
  const since = +(u.searchParams.get("since") || 0);
  return Response.json(list.filter(e => e.t > since));
}
