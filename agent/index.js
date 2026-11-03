// LisDAO agent: polls the contract for approved AgentTask proposals, plans with
// NEAR AI Cloud (OpenAI-compatible) if NEAR_AI_API_KEY is set, executes (stub /
// Playwright hook), then reports the verified result on-chain via report_result.
import { connect, keyStores } from "near-api-js";
import os from "os"; import path from "path";

const CONTRACT = process.env.CONTRACT_ID || "lisdao-1793738031.testnet";
const AGENT = process.env.AGENT_ID || CONTRACT;
const near = await connect({ networkId: "testnet", nodeUrl: "https://rpc.testnet.near.org",
  keyStore: new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), ".near-credentials")) });
const account = await near.account(AGENT);

async function plan(task) {
  if (!process.env.NEAR_AI_API_KEY) return { steps: [`(no LLM key) would do: ${task.instructions}`], withinBudget: true };
  const r = await fetch("https://cloud-api.near.ai/v1/chat/completions", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.NEAR_AI_API_KEY}` },
    body: JSON.stringify({ model: process.env.NEAR_AI_MODEL || "deepseek-ai/DeepSeek-V3.1",
      messages: [{ role: "system", content: "You plan real-world tasks for a DAO. Reply JSON {steps:[string], withinBudget:boolean}. Refuse anything over the budget or unsafe." },
                 { role: "user", content: `Task: ${task.instructions}\nBudget USD: ${task.max_spend_usd}` }],
      response_format: { type: "json_object" } }) });
  return JSON.parse((await r.json()).choices[0].message.content);
}

// Hook for Playwright browser execution + Tesseract OCR of the receipt.
async function execute(task, p) {
  if (!p.withinBudget) return { success: false, report: "Refused: over budget or unsafe" };
  return { success: true, report: `DRY-RUN executed: ${p.steps.join(" -> ")}` };
}

async function tick() {
  const tasks = await account.viewFunction({ contractId: CONTRACT, methodName: "pending_tasks", args: { agent: AGENT } });
  for (const [daoId, prop] of tasks) {
    const task = prop.action.AgentTask; console.log("task", daoId, prop.id, task.instructions);
    const p = await plan(task); const res = await execute(task, p);
    await account.functionCall({ contractId: CONTRACT, methodName: "report_result",
      args: { dao_id: daoId, proposal_id: prop.id, success: res.success, report: res.report.slice(0, 500) }, gas: 50_000_000_000_000n });
    console.log("reported", res);
  }
}
if (process.argv.includes("--once")) await tick(); else { await tick(); setInterval(() => tick().catch(console.error), 15000); }
