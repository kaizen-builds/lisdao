// Agent heartbeat: the agent POSTs on every state change and otherwise every ~20s; the UI shows "agent online" / "agent is starting".
import { putJson, getJsonFresh } from "../../../lib/store";
import { tokenOk } from "../../../lib/token";
export const dynamic = "force-dynamic";
export async function POST(req) {
  const tok = process.env.AGENT_FEED_TOKEN;
  if (!tok) return new Response("feed disabled: AGENT_FEED_TOKEN not set on server", { status: 503 });
  if (!tokenOk(req.headers.get("x-agent-token"), tok)) return new Response("forbidden", { status: 403 });
  const e = await req.json();
  const rec = { t: Date.now(), state: String(e.state || "idle").slice(0, 20), dao_id: Number.isInteger(e.dao_id) ? e.dao_id : null,
    proposal_id: Number.isInteger(e.proposal_id) ? e.proposal_id : null, model: String(e.model || "").slice(0, 80) };
  await putJson("heartbeat.json", rec);
  return Response.json({ ok: true });
}
export async function GET() {
  const hb = await getJsonFresh("heartbeat.json");
  return Response.json({ ...(hb || {}), online: !!hb && Date.now() - hb.t < 45000, now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
