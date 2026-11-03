# LisDao — DAOs with AI agents that act in the real world (NEAR)

Built at NEAR HACKATHON (Nov 2026). Communities create a DAO, give members weighted voting power, vote on plain-English proposals, and an authorized AI agent executes approved tasks off-chain (purchases, donations, messages) and writes a verified report back on-chain. Only the DAO's designated agent account can report results, so the outcome trail is auditable on NEAR.

Disclosure (Q-002): LisDAO originally existed as an EVM project (Dynamic + wagmi + hardhat). This repo is a fresh NEAR-native rewrite made during the hackathon window.

## Live (testnet)
Contract: `lisdao-1793738031.testnet` — https://testnet.nearblocks.io/address/lisdao-1793738031.testnet

## Layout
- `contract/` Rust (near-sdk 5) contract: `create_dao`, `set_member`, `deposit`, `propose`, `vote`, `execute`, `report_result`; views `list_daos`, `get_dao`, `get_proposals`, `get_votes`, `pending_tasks`.
- `web/` Next.js + NEAR Wallet Selector (MyNearWallet, Meteor).
- `agent/` Node agent: polls `pending_tasks`, plans with NEAR AI Cloud (`NEAR_AI_API_KEY`, optional), executes (dry-run stub; Playwright/OCR hook), calls `report_result`.

## Try it
1. `cd contract && cargo test` — see 4 tests pass (weighted approval, rejection, no double vote, only agent can report).
2. `cd web && npm i && npm run dev` — open http://localhost:3000, connect a testnet wallet, create a DAO with members `you.testnet:3, friend.testnet:1`, see voting power %.
3. Add a proposal "Donate $5 to Wikipedia", vote Yes — see status `Approved`; click "Send to agent" — see `Executing`.
4. `cd agent && npm i && AGENT_ID=<agent account> CONTRACT_ID=lisdao-1793738031.testnet node index.js --once` (agent key in `~/.near-credentials/testnet`) — refresh the UI, see `Executed` with the agent report.

## Proposal lifecycle
Active → Approved (yes weight ≥ quorum%) / Rejected → `execute` → Transfer actions pay out from treasury immediately; AgentTask actions go `Executing` → agent `report_result` → Executed / Failed.

## Libraries
near-sdk, near-api-js, @near-wallet-selector, Next.js/React. AI code assistance used.

## License
MIT
