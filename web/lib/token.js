// Constant-time check of the x-agent-token header against AGENT_FEED_TOKEN.
import { createHash, timingSafeEqual } from "node:crypto";
const h = s => createHash("sha256").update(String(s ?? "")).digest();
export const tokenOk = (given, expected) => timingSafeEqual(h(given), h(expected));
