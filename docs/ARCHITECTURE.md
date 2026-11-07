# Architecture

LisDao has three parts. Votes and the treasury stay in a standard Sputnik DAO v2.

| Part | Where | Role |
|---|---|---|
| Sputnik DAO v2 | `lisdao-demo.sputnikv2.testnet` (factory `sputnikv2.testnet`) | Members create and vote on proposals; holds the treasury |
| Executor contract | `executor/` → `exec.lisdao-v2-1793741346.testnet` | Receives passed tasks with escrow; pays or escalates |
| Agent | `agent/browser_agent.py`, run by `agent/run-agent.sh` | Polls tasks, drives Chromium (Playwright + vision LLM; the live demo agent runs on NEAR AI Cloud (`x-ai/grok-4.7`, `LLM_PROVIDER=nearai`)), reports the payout address |
| Web app | `web/` (Next.js 15, hosted on Vercel) | Wallet UI (wallet-selector + Meteor), live agent feed, RPC proxy, demo charity page |

## Flow
1. A member signs a Sputnik `add_proposal` of kind `FunctionCall` → executor `dispatch_task(title, instructions, max_spend, proposer, proposal_id)`.
2. Council members sign `act_proposal` votes. When the policy threshold is reached, Sputnik calls `dispatch_task` and attaches `max_spend` as escrow.
3. `dispatch_task` rejects callers that are not sub-accounts of the configured factory and stores the task as `Executing`.
4. The agent polls `pending_tasks`, opens the task site in a browser, and reads the one-time deposit address only from `#deposit-address`. The vision model's read must match that element exactly (up to 2 re-reads); OCR (`agent/ocr.js`) is advisory only. If the vision LLM is unavailable, a scripted planner runs the step (labelled in the feed) and takes the address from that same element, so there is no second independent read.
5. The agent calls `report_payout` (or `report_result(false)` on failure) using the `near` CLI with the agent account key.
6. The executor computes the proposer's auto-approve tier (`auto_cap_of`): `base_cap + reputation × rep_step`, capped at `max_auto` (deployed: 0.2 + 0.1 × rep, max 1 NEAR).
   - Within tier: pay the receiver, return the rest of the escrow to the DAO, proposer reputation +1.
   - Above tier: return the escrow to the DAO and open a Sputnik `Transfer` proposal for the council.
7. The agent posts each step to `POST /api/agent` and liveness to `POST /api/heartbeat` (header `x-agent-token`). The web UI polls the GET endpoints.

## Web server routes
| Route | Purpose |
|---|---|
| `/api/agent` | Agent step feed. POST needs `AGENT_FEED_TOKEN`; GET is public |
| `/api/heartbeat` | Agent online status. POST needs `AGENT_FEED_TOKEN`; GET is public |
| `/api/rpc` | Same-origin NEAR testnet JSON-RPC proxy for whitelisted read methods |
| `/api/charity`, `/demo-charity` | The demo "Water Project" donation page and its one-time address |

Storage: Neon Postgres when `DATABASE_URL`/`POSTGRES_URL` is set, otherwise an in-memory map (`web/lib/store.js`).
