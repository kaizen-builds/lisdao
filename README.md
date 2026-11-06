# LisDao
+
+<h1 align="center">LisDao</h1>
+<p align="center"><strong>Your DAO votes. An AI agent does the job in a real browser. A NEAR contract pays, within limits the DAO sets.</strong></p>
+<p align="center">
+  <a href="https://lisdao.vercel.app"><strong>Live app ↗</strong></a> · <a href="#try">Try it</a> · <a href="#proof">On-chain proof</a> · <a href="#quickstart">Run it</a> · <a href="#trust">Trust</a>
+</p>
+<p align="center"><sub>NEAR TESTNET · SPUTNIK DAO v2 · RUST (near-sdk 5) · NEXT.JS 15 · PLAYWRIGHT · NEAR AI CLOUD · Built at NEAR HACKATHON</sub></p>
+
+> **Testnet only.** No mainnet deployment and no real money. The "Water Project" charity is a demo page in this repo.
+
+> **▶ Demo video (2 min):** https://lisdao.vercel.app/demo.mp4
+
+## What it is
+
+LisDao is an AI executor for **Sputnik DAO v2**. A DAO member writes a task in plain words ("Donate 0.1 NEAR to the water project"). The council votes in Sputnik. When the vote passes, the voted amount is escrowed and the agent drives a real browser to complete the task. The executor contract pays only within the DAO's approved cap and escalates above-tier payouts back to the DAO.
+
+## The problem
+
+Many real-world payees only accept crypto through a web page: a donation form that generates a fresh deposit address per donation, a checkout, a signup. A DAO can vote and hold funds, but it cannot click a web form. LisDao bridges that gap in a narrow and auditable way.
+
+## Submission focus for NEAR Hackathon
+
+This project aligns well with the **AI Agents** and **Open Innovation** themes:
+
+- a real DAO vote authorizes a task,
+- an AI browser agent completes it,
+- a NEAR contract enforces the spending rules,
+- the system is demonstrably live on testnet.
+
+See [HACKATHON.md](./HACKATHON.md) for the submission narrative, track fit, demo path, and judge checklist.
+
+<a id="try"></a>
+## Try it (do X, see Y)
+
+Live app: **https://lisdao.vercel.app** · demo DAO: **`lisdao-demo.sputnikv2.testnet`** · executor: **`exec.lisdao-v2-1793741346.testnet`**
+
+| Do | See |
+|---|---|
+| Open the live app, scroll to **Limits** | A **Spending limits** panel read live from the executor contract (`get_config`): auto-approve tier start / step / max, the only agent account allowed to report payouts |
+| Click **Try the demo** | The demo DAO's proposals, read live from Sputnik (`get_proposals`) and the executor (`get_tasks`) |
+| Open proposal **#11** ("Donate 0.1 NEAR to the Water Project") | Status `Passed · Executed`, a **Policy check: Within limit** box, the proposer's current tier, the on-chain agent report with the payout amount and receiver |
+| Click **View Agent Execution** | The **Live browser** panel: the agent's screenshots and each highlighted step it took |
+| Open the payout tx for #11 | `report_payout` by the agent account to the executor; the 0.1 NEAR transfer is visible on-chain |
+| (Wallet needed) Connect a testnet wallet, **Create New Proposal**, vote Yes as a council member | A new task is dispatched; the agent (when the operator's agent is online) runs it in the Live browser |
+| (No wallet) `cd executor && cargo test` | Contract tests pass, including the new receiver-match guard and over-cap checks |
+
+## How it works
+
+```mermaid
+flowchart LR
+  U[Member wallet<br/>Meteor via wallet-selector] -- add_proposal / act_proposal --> D[Sputnink DAO<br/>lisdao-demo.sputnikv2.testnet]
+  D -- vote passes: FunctionCall dispatch_task + escrow = max_spend --> E[LisDao executor<br/>exec.lisdao-v2-1793741346.testnet]
+  A[Agent<br/>browser_agent.py] -- polls pending_tasks --> E
+  A -- Playwright + vision LLM (NEAR AI Cloud) + OCR check --> C[Demo charity page<br/>one-time NEAR address]
+  A -- report_payout / report_result --> E
+  E -- within tier: pay receiver, refund rest, +1 reputation --> R[Receiver]
+  E -- above tier: refund escrow + open Transfer proposal --> D
+  A -- step feed (token) --> W[Web app /api/agent<br/>Neon Postgres]
+  W --> U
+```
+
+1. A member creates a Sputnik `FunctionCall` proposal that calls `dispatch_task` on the executor (escrow equals `max_spend`, natural cap chosen by the vote).
+2. The council votes. When it passes, Sputnik calls the executor and attaches `max_spend` as escrow; the rest of the treasury stays in Sputnik.
+3. The agent (`agent/browser_agent.py`) polls `pending_tasks`, drives a locked-down Playwright browser, sends screenshots to a vision LLM on **NEAR AI Cloud**, and reads the one-time deposit address.
+4. The agent calls `report_payout`. The **contract** decides: pay now (within the proposer's tier), escalate to a new Sputnik Transfer vote (above the tier), or refuse (above the voted cap).
+
+## NEAR's role, concretely
+
+- **Sputnik DAO v2** holds the treasury, the council and the votes. LisDao adds no voting of its own; it plugs in as the receiver of a `FunctionCall` proposal.
+- **Executor contract** (`executor/src/lib.rs`, Rust, near-sdk 5) enforces the spending limits:
+
+| Rule | Enforced in |
+|---|---|
+| Payout must be > 0, ≤ the voted `max_spend`, ≤ the task's escrow; otherwise the call panics `over spending cap` and nothing moves | `report_payout` |
+| When a task includes an explicit expected receiver, the payout must match exactly | `report_payout` |
+| Auto-approve tier = 0.2 NEAR + 0.1 NEAR per finished task of the proposer, max 1 NEAR (live values in the app's Spending limits panel) | `auto_cap_of` |
+| Within tier → pay receiver, return the rest of the escrow to the DAO, proposer +1 reputation | `report_payout` |
+| Above tier → escrow back to the DAO, executor opens a Sputnik `Transfer` proposal for the council | `report_payout` |
+| Only the configured agent can report; only `*.sputnikv2.testnet` DAOs can dispatch; a task settles once | `report_payout`, `report_result`, `dispatch_task` |
+| Failure → status `Failed`, escrow back to the DAO | `report_result` |
+
+- **NEAR AI Cloud** (`https://cloud-api.near.ai/v1`, OpenAI-compatible) runs the agent's vision model in the live demo (`x-ai/grok-4.7`). It chooses every click from screenshots and transcribes the page's one-time deposit address.
+- **Wallets:** NEAR wallet-selector (Meteor, MyNearWallet, HOT, Here, Intear, Sender, Bitte, Near Mobile). Only Meteor has been tested end to end with a real transaction.
+
+<a id="proof"></a>
+## On-chain proof (NEAR testnet)
+
+| What | Transaction |
+|---|---|
+| DAO | [lisdao-demo.sputnikv2.testnet](https://testnet.nearblocks.io/address/lisdao-demo.sputnikv2.testnet) |
+| Executor | [exec.lisdao-v2-1793741346.testnet](https://testnet.nearblocks.io/address/exec.lisdao-v2-1793741346.testnet) |
+| Proposal #5 created | [2RFPFNEW…](https://testnet.nearblocks.io/txns/2RFPFNEWBn9J7Lya8tLfdxGTWcG9SjYbMNwyiBBHtWJF) |
+| Proposal #5 approved by council | [C4gPFrU9…](https://testnet.nearblocks.io/txns/C4gPFrU9xjECcydmC61TY4vN99Y6dqKxdKN9omMniPL6) |
+| Proposal #6 payout: agent calls `report_payout` | [ogdnYy2S…](https://testnet.nearblocks.io/txns/ogdnYy2Sv8c1zq9NYXiiEuJWj6d3cmuoQvt8tYQK8oy3D) |
+| Proposal #7 payout: agent calls `report_payout` | [78pmYEL4…](https://testnet.nearblocks.io/txns/78pmYEL4PWZVuVnBNhkZsQAuAUKHZbGV1eKzj4eLh4P5) |
+| Proposal #9 created (live agent on NEAR AI Cloud) | [BLWit74i…](https://testnet.nearblocks.io/txns/BLWit74iq8u1BUJ4QMdHacmt73hZeyc9rzWAGHxaQJYd) |
+| Proposal #9 approved by council | [2X3LdXx4…](https://testnet.nearblocks.io/txns/2X3LdXx4xd8U85g3AsrTtGTXRCXdC8Zfy7fmZydbcEi2) |
+| Proposal #9 payout: agent calls `report_payout` | [BFijitUn…](https://testnet.nearblocks.io/txns/BFijitUnuteeT7KP3VzhPt4eDMuQkKk56msMtQppEM4) |
+| Proposal #11 payout | [6rt1nGof…](https://testnet.nearblocks.io/txns/6rt1nGofX9Hb2zBxnWSb6V3vuKPpAm1w64N5NzQ2GvkQ) |
+| Access control negative test: `report_payout` from non-agent account fails `only agent` | [5FA31kak…](https://testnet.nearblocks.io/txns/5FA31kakYN3PPqSk6q3A3cPdwe6QXiDoqeumX5wF2X3u) |
+
+<a id="trust"></a>
+## Trust model (honest)
+
+- **Today: one operator.** A single agent account and key, run by the project's operator. You trust the operator's agent for **which address** it reports; the contract limits **how much** it can pay.
+- **On-chain guarantees:** the agent cannot vote, cannot touch the treasury beyond the escrowed `max_spend`, cannot pay more than the voted cap, and cannot auto-pay above the proposer's tier.
+- **Off-chain checks** (reduce, don't remove, operator/LLM risk): payee read only from `#deposit-address` with an exact-match LLM read (up to 2 re-reads), browser locked to the charity origin, page content treated as untrusted, and `expected_receiver` enforcement when a concrete recipient is specified in the task.
+- **No TEE or attestation** is used today, and LisDao makes no private-inference claim for this deployment.
+- **Future:** multiple independent agents with stake/slashing, TEE-attested agent runs, and stronger receiver binding on task dispatch (see [docs/ROADMAP.md](docs/ROADMAP.md)).
+
+## Tracks fit
+
+- **Social:** a community decides together, in a Sputnik DAO, what real-world task gets done and paid.
+- **Security:** “give an AI money without the keys”: escrow, a per-payout cap from the vote, reputation-based auto-approve tiers and escalation, all enforced by the contract and shown live in the UI.
+- **Privacy / NEAR AI:** the agent's inference runs on NEAR AI Cloud. (No TEE/private-inference claim is made for this deployment.)
+- **Agents / open:** an AI agent doing real web work with on-chain consequences; MIT licensed, runnable locally.
+
+## Built during the hackathon
+
+- The hackathon was announced on 2026-10-19. This project was built entirely after that: the repo's first commit is dated 2026-11-03, and all work is in this repo's public git history.
+- Built in that window: the executor contract (escrow, voted cap, reputation tiers, escalation to a Sputnik Transfer vote), the Sputnik DAO v2 integration, the browser agent on NEAR AI Cloud with a locked-down browser flow, and the live demo UI.
+
+## Quickstart
+
+```bash
+# 1. Contract tests
+(cd executor && cargo test)
+
+# Build & deploy to testnet (build checked with cargo-near 0.22 + near-cli-rs 0.30; deploy/init not re-run, they spend testnet NEAR)
+cd executor
+cargo near build non-reproducible-wasm
+near deploy <your-exec>.testnet target/near/lisdao_executor.wasm
+
+# 2. Web (local: DATABASE_URL optional, in-memory store. Hosted on Vercel: set DATABASE_URL (Neon), the in-memory store does not persist there.)
+(cd web && npm ci && cp ../.env.example .env.local && npm run dev)
+
+# 3. Agent (config is read from ~/.lisdao/agent.env; needs the `near` CLI with the agent account's key)
+cd agent && npm ci && pip install playwright && playwright install chromium
+mkdir -p ~/.lisdao && cp ../.env.example ~/.lisdao/agent.env
+AGENT_PYTHON=$(which python3) ./run-agent.sh
+
+# 4. Tests: web unit tests and UI checks
+(cd web && npm test)
+python web/e2e-buttons.py http://localhost:3000/
+```
+
+## Repo map
+
+| Path | What |
+|---|---|
+| `executor/` | Rust executor contract (`dispatch_task`, `report_payout`, `report_result`, views) |
+| `agent/` | `browser_agent.py` (Playwright + vision LLM: NEAR AI Cloud or any OpenAI-compatible endpoint; `--dry-run`) |
+| `web/` | Next.js app; `lib/sputnik.js`, `/api/agent` feed, `/api/rpc` read-only RPC proxy, `/demo-charity` |
+| `docs/` | Architecture, security, demo script, roadmap |
+| `screenshots/` | Desktop and mobile screenshots |
+
+<a id="limits"></a>
+## Limitations
+
+- Testnet only; not audited. Single agent account run by one operator; no TEE / attestation.
+- When a task does not specify an expected receiver, the agent must discover the payee from the live page. The on-chain contract cannot bind the destination until a concrete recipient is named in the task.
+- Any account under `.sputnikv2.testnet` can dispatch, and anyone can create one; there is no DAO allow-list. Reputation is per proposer across all DAOs, so it can be raised in a throwaway DAO.
+- No timeout refund: only the agent settles a task; if it stops, the escrow waits in the executor. The owner (a single key) can swap the agent with `set_agent`.
+- Payout transfers have no callback: if a transfer fails, the task still reads `Executed` and the amount returns to the executor, not the DAO.
+- The policy check in the UI uses the proposer's **current** tier; the contract used the tier at payout time. The on-chain status (`Executed` / `Escalated` / `Failed`) is authoritative.
+- Agent tasks are tuned for the demo charity flow, not arbitrary websites.
+
+## Docs
+
+[Architecture](docs/ARCHITECTURE.md) · [Security + limit test](docs/SECURITY.md) · [Roadmap](docs/ROADMAP.md) · [Demo script](docs/DEMO.md) · [Hackathon fit](HACKATHON.md)
+
+## License
+
+MIT, see [LICENSE](LICENSE). Built at NEAR HACKATHON with help from AI coding tools.
+
+