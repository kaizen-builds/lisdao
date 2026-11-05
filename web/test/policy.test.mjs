import test from "node:test"; import assert from "node:assert/strict";
import { autoTier, policyCheck } from "../lib/policy.js";
const Y = n => (BigInt(Math.round(n * 1e4)) * 10n ** 20n).toString();
const cfg = { base_cap: Y(0.2), rep_step: Y(0.1), max_auto: Y(1) };
test("auto tier grows with reputation and caps at max_auto", () => {
  assert.equal(autoTier(cfg, 0), BigInt(Y(0.2))); assert.equal(autoTier(cfg, 7), BigInt(Y(0.9))); assert.equal(autoTier(cfg, 50), BigInt(Y(1)));
});
test("policy check before a run", () => {
  assert.equal(policyCheck({ maxSpend: Y(0.1), tier: Y(0.2) }).label, "Within limit");
  assert.match(policyCheck({ maxSpend: Y(0.5), tier: Y(0.2) }).label, /council/);
});
test("policy check after a run", () => {
  assert.equal(policyCheck({ maxSpend: Y(0.1), tier: Y(0.2), task: { status: "Executed", result: "paid 0.1 NEAR to x | ok" } }).detail.startsWith("Paid 0.1 NEAR"), true);
  assert.match(policyCheck({ maxSpend: Y(0.5), tier: Y(0.2), task: { status: "Escalated" } }).label, /Over auto tier/);
  assert.equal(policyCheck({ maxSpend: Y(0.1), tier: Y(0.2), task: { status: "Failed" } }).label, "Nothing paid");
});
