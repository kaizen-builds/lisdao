// Tiny storage layer: Vercel Blob (private) when BLOB_READ_WRITE_TOKEN is set (hosted),
// in-memory otherwise (local dev). Each record is its own blob, so there are no write races.
import { put, list, get } from "@vercel/blob";
const mem = globalThis.__lisMem || (globalThis.__lisMem = new Map());
const useBlob = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function putJson(pathname, obj) {
  if (!useBlob()) { mem.set(pathname, obj); return; }
  await put(pathname, JSON.stringify(obj), { access: "private", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
}
export async function listJson(prefix, afterName = "") {
  if (!useBlob()) return [...mem.entries()].filter(([k]) => k.startsWith(prefix) && k > afterName).sort().map(([, v]) => v);
  const names = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); names.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  const fresh = names.filter(n => n > afterName).sort();
  return Promise.all(fresh.map(async n => { const r = await get(n, { access: "private" }); return JSON.parse(await new Response(r.stream).text()); }));
}
export async function getJsonFresh(pathname) {
  if (!useBlob()) return mem.get(pathname) ?? null;
  try { const r = await get(pathname, { access: "private", useCache: false }); return r?.stream ? JSON.parse(await new Response(r.stream).text()) : null; }
  catch { return null; }
}
