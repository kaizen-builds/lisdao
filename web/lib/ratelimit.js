// Small in-memory fixed-window rate limiter (per server instance; resets on cold start).
// Used to stop casual spam of POST /api/charity. Not a substitute for a shared store.
export function createLimiter({ perIp = 5, global = 60, windowMs = 60_000, now = () => Date.now() } = {}) {
  const hits = new Map(); let win = 0, total = 0;
  return function check(ip) {
    const t = now(), w = Math.floor(t / windowMs);
    if (w !== win) { win = w; total = 0; hits.clear(); }
    const n = hits.get(ip) || 0;
    if (n >= perIp || total >= global) return { ok: false, retryAfter: Math.ceil(((w + 1) * windowMs - t) / 1000) };
    hits.set(ip, n + 1); total++;
    return { ok: true };
  };
}
export function clientIp(req) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
