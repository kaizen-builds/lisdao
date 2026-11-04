// Tiny storage layer: Neon Postgres (one key/value table) when DATABASE_URL is set (hosted),
// in-memory otherwise (local dev). Same interface as before: putJson / listJson / getJsonFresh.
import { neon } from "@neondatabase/serverless";
const mem = globalThis.__lisMem || (globalThis.__lisMem = new Map());
const url = () => process.env.DATABASE_URL || process.env.POSTGRES_URL;
let ready;
function db() {
  const sql = neon(url());
  ready ||= sql`CREATE TABLE IF NOT EXISTS kv (k text PRIMARY KEY, v jsonb NOT NULL)`.catch(e => { ready = null; throw e; });
  return ready.then(() => sql);
}

export async function putJson(pathname, obj) {
  if (!url()) { mem.set(pathname, obj); return; }
  const sql = await db();
  await sql`INSERT INTO kv (k, v) VALUES (${pathname}, ${JSON.stringify(obj)}::jsonb) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v`;
}
export async function listJson(prefix, afterName = "") {
  if (!url()) return [...mem.entries()].filter(([k]) => k.startsWith(prefix) && k > afterName).sort().map(([, v]) => v);
  const sql = await db();
  const rows = await sql`SELECT v FROM kv WHERE starts_with(k, ${prefix}) AND k > ${afterName} ORDER BY k COLLATE "C"`;
  return rows.map(r => r.v);
}
export async function getJsonFresh(pathname) {
  if (!url()) return mem.get(pathname) ?? null;
  try { const sql = await db(); const r = await sql`SELECT v FROM kv WHERE k = ${pathname}`; return r[0]?.v ?? null; }
  catch { return null; }
}
