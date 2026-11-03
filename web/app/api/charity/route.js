// Demo charity: issues a fresh one-time NEAR testnet implicit account per donation.
import crypto from "crypto"; import fs from "fs"; import path from "path";
export const dynamic = "force-dynamic";
export async function POST(req) {
  const { amount, asset } = await req.json().catch(() => ({}));
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const priv = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
  const address = pub.toString("hex"); // NEAR implicit account id
  try { // keep the key so the demo charity can actually access the funds (gitignored; /tmp on serverless)
    const dir = process.env.VERCEL ? "/tmp/charity-keys" : path.join(process.cwd(), ".charity-keys");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, address + ".json"), JSON.stringify({ address, asset, amount, secret_hex: Buffer.concat([priv, pub]).toString("hex"), at: new Date().toISOString() }));
  } catch {}
  return Response.json({ address, asset, amount, network: "testnet" });
}
