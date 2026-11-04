import test from "node:test"; import assert from "node:assert/strict";
import { createLimiter } from "../lib/ratelimit.js";
test("per-IP limit then reset next window", () => {
  let t = 0; const c = createLimiter({ perIp: 5, global: 100, windowMs: 60000, now: () => t });
  for (let i = 0; i < 5; i++) assert.equal(c("a").ok, true);
  const r = c("a"); assert.equal(r.ok, false); assert.equal(r.retryAfter, 60);
  assert.equal(c("b").ok, true);
  t = 60000; assert.equal(c("a").ok, true);
});
test("global cap across IPs", () => {
  const c = createLimiter({ perIp: 5, global: 3, now: () => 0 });
  assert.equal(c("a").ok, true); assert.equal(c("b").ok, true); assert.equal(c("c").ok, true);
  assert.equal(c("d").ok, false);
});
