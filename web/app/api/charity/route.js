// Demo charity: issues a fresh one-time NEAR testnet implicit account per donation.
import crypto from "crypto";
import { putJson } from "../../../lib/store";
import { createLimiter, clientIp } from "../../../lib/ratelimit";
const limit = createLimiter({ perIp: 5, global: 60, windowMs: 60_000 });
export const dynamic = "force-dynamic";
export async function POST(req) {
  const rl = limit(clientIp(req));
  if (!rl.ok) return Response.json({ error: "Too many requests, try again shortly" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  const { amount, asset } = await req.json().catch(() => ({}));
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const priv = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const address = pub.toString("hex"); // NEAR implicit account id
  // Keep the key so the demo charity can actually access the funds (private Blob when hosted, memory locally).
  await putJson(`charity-keys/${address}.json`, { address, asset, amount, secret_hex: Buffer.concat([priv, pub]).toString("hex"), at: new Date().toISOString() });
  return Response.json({ address, asset, amount, network: "testnet" });
}
