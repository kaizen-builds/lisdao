# LisDao

**A DAO that votes in plain English, and an AI agent that carries out the result in a real web browser, with NEAR paying out.**

LisDao lets a community create a DAO, give members weighted votes, and pass proposals such as "Donate 0.1 NEAR to the water project". When a proposal passes, an AI agent opens a real browser, works through the charity's donation page and reads the one-time deposit address. The DAO contract then pays from its treasury, capped at the amount members approved. No single human has to be trusted to do the off-chain part.

LisDao started as my own EVM idea. All code in this repo is new, written for NEAR during the hackathon window.

- **Live demo:** https://lisdao.vercel.app (NEAR testnet)
- **Demo video:** _coming soon (X post link)_

## Try it in two minutes

| Step | What to do | What you should see |
| --- | --- | --- |
| 1 | Open https://lisdao.vercel.app | The LisDao drop logo and two buttons: **Demo DAO** and **Create New DAO** |
| 2 | Tap **Demo DAO** | Dashboard showing the treasury balance in NEAR and a members table with each member's votes and % |
| 3 | Tap a proposal named "Donate to the water project" | Status, created/ends dates, and a progress bar such as 6 / 9 votes (67%) |
| 4 | Tap **View Agent Execution** | The agent panel replays its browser screenshots and steps: select NEAR, clear "25" and type 0.1, Next Step, skip the tax receipt, read the address |
| 5 | Look at the end of the panel | "Reported on-chain · paid by the DAO contract", the one-time address, and a **View transaction** link to nearblocks |
| 6 | Connect a testnet wallet and use **Create New Proposal** / **Vote Yes** | Your vote updates the screen right away. If it passes, the agent panel opens on its own (the agent service must be running) |
| 7 | Open https://lisdao.vercel.app/demo-charity | The demo charity flow by hand: dropdown, amount box set to 25, Next Step, tax receipt, then a fresh one-time address with a QR code |

## What is real, with receipts

| Claim | Receipt |
| --- | --- |
| Contract deployed on NEAR testnet | [lisdao-v2-1793741346.testnet](https://testnet.nearblocks.io/address/lisdao-v2-1793741346.testnet) |
| Agent account (the only account allowed to report payouts) | [lisdao-agent-1793741346.testnet](https://testnet.nearblocks.io/address/lisdao-agent-1793741346.testnet) |
| Proposal created on-chain | [7jZL8emb…](https://testnet.nearblocks.io/txns/7jZL8emb5NJkhqRBFvM1t4Rchyyq9tewHgpKYfYcaiD9), [2Mv885hE…](https://testnet.nearblocks.io/txns/2Mv885hExNTrCoJjM2JzSyjyWaagkzce6p78y6GFKxHo) |
| Yes vote passes the proposal and sends it to the agent automatically | [8zRbmCKM…](https://testnet.nearblocks.io/txns/8zRbmCKMardYkaKDuqkW6FT5SEMAYRRRL8MMkkBJMC1F), [5kyxWuwu…](https://testnet.nearblocks.io/txns/5kyxWuwuUk5uoFzzCmJk9bXvNJ1vw4KjXmXUdNzrV7Ea) |
| Agent reports the address it read; contract pays 0.1 NEAR from treasury | [66Q1jEsz…](https://testnet.nearblocks.io/txns/66Q1jEszTdQDa6AMbLCR8kZbwxQWWBWxEdPas5WgQo7F), [7U8QGao3…](https://testnet.nearblocks.io/txns/7U8QGao3wY8aMahb4uqJtYkYF7o6PowBb3CmAsDYJo1T), [5eSvJmYo…](https://testnet.nearblocks.io/txns/5eSvJmYozSuDRdm1yZAUTQiznuAsqqswWPFDV8JRqdPZ), [nvD9r4pF…](https://testnet.nearblocks.io/txns/nvD9r4pFrgGva41XRCjYxzA92rK8QRz9Sd71jyKFhVT) (run against the hosted app) |
| Browser agent is real | Playwright Chromium + vision LLM loop in `agent/browser_agent.py`; each step's screenshot is shown in the UI |

**Not claimed:** not on mainnet; testnet only; the "Water Project (demo)" charity is a page in this repo, not a real charity, and no real money moves.

## Why NEAR

- **Named accounts and implicit accounts.** The agent and the DAO have readable account ids. The charity can create a fresh one-time address (an implicit account) for every donation with no setup.
- **The contract pays, not the agent.** The agent account can only report an address. The money moves from the DAO contract's treasury, under rules written in the contract.
- **Cheap, fast finality**, so voting, dispatching and paying out in one flow feels instant enough for a live demo.

## Architecture

```
  web (Next.js, Wallet Selector) ── propose / vote ──►  LisDao contract (NEAR testnet)
        ▲  polls proposals + agent feed                    │  vote passes → status Executing
        │                                                  ▼
  /api/agent (Vercel Blob)  ◄── step events ──  agent (box) ── pending_tasks / report_payout
                                                   │
                                                   ▼
                                  Playwright browser + vision LLM (+ OCR check)
                                                   │
                                                   ▼
                               demo charity (/demo-charity) → one-time NEAR address
```

## Fail-closed / safety

- Only the DAO's configured **agent account** can call `report_payout` or `report_result`.
- The payout **amount is capped** by the proposal's `max_spend`, and the treasury must cover it.
- The receiver must be a **valid NEAR account id** (`AccountId` type). The agent also checks the address against the page text and an OCR reading of the screenshot.
- If the vision LLM is unavailable, a **scripted fallback** plans that step instead. It is labelled `[scripted]` in the live feed.
- Only the agent can post to the feed endpoint (shared token kept in Vercel env and box env). Keys for the charity's one-time addresses are stored in a private Blob store, never in the repo.

## Testnet accounts

- Contract: `lisdao-v2-1793741346.testnet`
- Agent: `lisdao-agent-1793741346.testnet`
- Demo voter: `lisdao-voter-1793741346.testnet` (6 of 9 votes in Demo DAO)

## Layout

- `contract/`: Rust (near-sdk 5). Methods: `create_dao`, `set_member`, `deposit`, `propose`, `vote`, `execute`, `report_payout`, `report_result`. Views: `list_daos`, `get_dao`, `get_proposals`, `get_votes`, `pending_tasks`.
- `web/`: Next.js app, `/demo-charity`, `/api/charity`, `/api/agent`, and `lib/store.js` (Vercel Blob when hosted, memory locally).
- `agent/`: `browser_agent.py` (Playwright + vision LLM) and `ocr.js` (tesseract.js).

## Run

1. `cd contract && cargo test`: 7 tests should pass.
2. `cd web && npm i && npm run dev`: runs locally with an in-memory feed. Set `BLOB_READ_WRITE_TOKEN` and `AGENT_FEED_TOKEN` to match hosting.
3. `cd agent && npm i && pip install playwright && playwright install chromium`, then:
   `WEB_URL=https://lisdao.vercel.app AGENT_FEED_TOKEN=... LLM_API_KEY=... LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai LLM_MODEL=gemini-3-flash-preview python browser_agent.py`
   This works with any OpenAI-compatible vision endpoint (e.g. NEAR AI Cloud, `LLM_BASE_URL=https://cloud-api.near.ai/v1`). The agent signs with `AGENT_ID`'s key in `~/.near-credentials/testnet`.

## Libraries

near-sdk, near-api-js, @near-wallet-selector, Next.js/React, @vercel/blob, qrcode, Playwright, tesseract.js. Built with help from AI coding tools.

## License

MIT
