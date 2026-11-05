// Spending-policy check, mirroring executor/src/lib.rs report_payout:
//   payout must be > 0 and <= max_spend (else the contract panics "over spending cap");
//   payout <= proposer's auto tier  -> paid at once;  above the tier -> escalated to a Sputnik Transfer vote.
// auto tier = min(base_cap + reputation * rep_step, max_auto). All amounts are yoctoNEAR strings.
export function autoTier(cfg, reputation) {
  const c = BigInt(cfg.base_cap) + BigInt(reputation || 0) * BigInt(cfg.rep_step);
  return c < BigInt(cfg.max_auto) ? c : BigInt(cfg.max_auto);
}
const near = y => { const s = (Number(BigInt(y) / 10n ** 20n) / 1e4).toString(); return s + " NEAR"; };
const paidOf = r => { const m = /^paid ([\d.]+) NEAR/.exec(r || ""); return m ? m[1] + " NEAR" : null; };
// maxSpend: the vote's cap; tier: proposer's current auto tier (bigint or string); task: executor task or null.
export function policyCheck({ maxSpend, tier, task }) {
  const cap = BigInt(maxSpend), t = BigInt(tier);
  if (task?.status === "Executed") return { tone: "ok", label: "Within limit", detail: `Paid ${paidOf(task.result) || "≤ " + near(cap)}: at most the voted cap (${near(cap)}) and within the auto-approve tier, so the contract paid at once.` };
  if (task?.status === "Escalated") return { tone: "warn", label: "Over auto tier: sent to council", detail: `The payout was above the proposer's auto-approve tier. The contract paid nothing and opened a Sputnik Transfer proposal instead.` };
  if (task?.status === "Failed") return { tone: "muted", label: "Nothing paid", detail: "The agent reported failure; the escrow went back to the DAO." };
  if (cap <= t) return { tone: "ok", label: "Within limit", detail: `Cap ${near(cap)} ≤ auto tier ${near(t)}: a payout up to the cap is paid at once. Anything above ${near(cap)} is refused by the contract.` };
  return { tone: "warn", label: "Over auto tier: council vote", detail: `Cap ${near(cap)} > auto tier ${near(t)}: a payout above ${near(t)} goes back to a council Transfer vote. Anything above ${near(cap)} is refused by the contract.` };
}
export const nearStr = near;
