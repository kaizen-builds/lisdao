# LisDao: DAOs that can act in the real world (NEAR)

Built at NEAR HACKATHON (Nov 2026). LisDao is a DAO that can control a web browser for the whole DAO, so no single human has to be trusted. Members vote on a plain-English proposal like "Donate 0.1 NEAR to the water project". When it passes, an AI agent runs a real Chromium browser, finds the charity's one-time deposit address, and reports it on-chain. The **DAO contract itself** then pays from the treasury, capped by the amount the proposal approved.

Disclosure (Q-002): LisDao started as an EVM project (Dynamic, wagmi, hardhat). This repo is a fresh NEAR-native rewrite written during the hackathon window.

## What's real vs demo
- **Real:** NEAR testnet contract, weighted voting, auto-dispatch on pass, agent-only `report_payout` with a spending cap, and the on-chain treasury transfer. The Playwright browser is real, driven by a vision LLM loop (screenshot → JSON action → highlight + act → screenshot → verify). Address extraction is cross-checked against page text, with Tesseract OCR (tesseract.js) as a backup. The UI's live agent panel is fed by real agent step events.
- **Demo:** the charity. thewaterproject.org doesn't accept NEAR, so `/demo-charity` ("The Water Project, DEMO, not a real charity") copies its flow: a crypto dropdown, an amount box pre-filled with 25, Next Step, an optional tax-receipt step, and then a fresh one-time NEAR testnet implicit address with a QR code. Keys are kept server-side in `.charity-keys/` (gitignored).
- **Fallback:** if the LLM is unavailable (no key, or a 503), the agent switches to a scripted planner for that step and labels it `[scripted]` in the live feed.

## Testnet
- Contract: `lisdao-v2-1793741346.testnet`
- Agent: `lisdao-agent-1793741346.testnet`
- Demo voter: `lisdao-voter-1793741346.testnet` (holds 6 of 9 votes in Demo DAO, so one Yes vote passes a proposal)
- Example payout tx (proposal 0): https://testnet.nearblocks.io/txns/66Q1jEszTdQDa6AMbLCR8kZbwxQWWBWxEdPas5WgQo7F

## Layout
- `contract/`: Rust (near-sdk 5). Methods: `create_dao`, `set_member`, `deposit`, `propose`, `vote` (an AgentTask that passes goes straight to `Executing`), `execute` (Transfer proposals), `report_payout` (agent only, amount ≤ `max_spend`, receiver must be a valid AccountId, contract transfers), `report_result`. Views: `list_daos`, `get_dao`, `get_proposals`, `get_votes`, `pending_tasks`.
- `web/`: Next.js with NEAR Wallet Selector. Includes `/demo-charity`, `/api/charity` (one-time address) and `/api/agent` (live step feed, in-memory).
- `agent/browser_agent.py`: Playwright + vision LLM agent. `agent/ocr.js`: Tesseract OCR.

## Run
1. `cd contract && cargo test`: 7 tests should pass.
2. `cd web && npm i && npm run build && npx next start -p 3000`
3. `cd agent && npm i && pip install playwright && playwright install chromium`
   `LLM_API_KEY=... LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai LLM_MODEL=gemini-3-flash-preview WEB_URL=http://localhost:3000 python browser_agent.py`
   This works with any OpenAI-compatible vision endpoint (e.g. NEAR AI Cloud: `LLM_BASE_URL=https://cloud-api.near.ai/v1`, `LLM_API_KEY=<NEAR AI key>`, with a vision model). The agent signs with the key for `AGENT_ID` in `~/.near-credentials/testnet`.
4. Open http://localhost:3000, click **Demo DAO**, then Create New Proposal: "Donate to the water project" / "Donate 0.1 NEAR to the water project". Vote Yes with a wallet that holds enough votes. The agent panel opens on its own and shows the live browser steps. It finishes with the one-time address and a link to the transaction.

## Libraries
near-sdk, near-api-js, @near-wallet-selector, Next.js/React, qrcode, Playwright, tesseract.js. Built with help from AI coding tools.

## License
MIT
