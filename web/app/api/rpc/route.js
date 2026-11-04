// Same-origin NEAR testnet JSON-RPC passthrough: whitelisted read methods, server-side fallback, ~1 s cache.
export const dynamic = "force-dynamic";
const UP = ["https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"]; // fastnear first: rpc.testnet.near.org rate-limits (429) from Vercel
const OK = new Set(["query", "tx", "EXPERIMENTAL_tx_status", "status", "block", "gas_price"]);
const cache = new Map();
export async function POST(req) {
  const raw = await req.text();
  if (raw.length > 8192) return Response.json({ error: "too large" }, { status: 413 });
  let b; try { b = JSON.parse(raw); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (!OK.has(b.method) || (b.method === "query" && !["view_account", "call_function", "view_access_key_list"].includes(b.params?.request_type)))
    return Response.json({ error: "method not allowed" }, { status: 403 });
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: b.method, params: b.params });
  const cacheable = b.method === "query"; const hit = cacheable && cache.get(body);
  if (hit && Date.now() - hit.t < 1000) return Response.json(hit.j);
  let last;
  for (const u of UP) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch(u, { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body });
      if (!r.ok && r.status >= 500 || r.status === 429) throw new Error(u + " HTTP " + r.status);
      const j = await r.json();
      if (j.error && /TIMEOUT|INTERNAL_ERROR/i.test(JSON.stringify(j.error)) && u !== UP[UP.length - 1]) throw new Error(u + " " + JSON.stringify(j.error).slice(0, 120));
      if (cacheable && !j.error) { cache.set(body, { t: Date.now(), j }); if (cache.size > 500) cache.clear(); }
      return Response.json(j);
    } catch (e) { last = String(e?.message || e); console.error("rpc upstream", last); } finally { clearTimeout(to); }
  }
  return Response.json({ error: { message: "all NEAR RPCs failed: " + last } }, { status: 502 });
}
