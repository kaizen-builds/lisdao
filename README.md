# LisDao

**An AI executor for Sputnik DAO: the council votes in plain English, an AI agent carries out the result in a real web browser, and NEAR pays out under caps the contract enforces.**

LisDao is built on **Sputnik DAO v2**, NEAR's standard DAO contract. The money and the votes stay in the Sputnik DAO. We don't rebuild the multisig. LisDao adds what a community does with it: a proposal such as "Donate 0.1 NEAR to the water project" becomes a normal Sputnik `FunctionCall` proposal. When the council approves it, Sputnik itself calls the LisDao executor and escrows exactly the approved spending cap. An AI agent opens a real browser, works through the charity's donation page and reads the one-time deposit address. Then the executor contract pays, never the agent.

LisDao started as my own EVM idea. All code in this repo is new, written for NEAR during the hackathon window.

- **Live demo:** https://lisdao.vercel.app (NEAR testnet)
- **Demo video:** _coming soon (X post link)_

## What LisDao adds on top of Sputnik DAO

| Feature | How it works |
| --- | --- |
| **AI executor** | `dispatch_task` on `exec.lisdao-v2-1793741346.testnet` can only be called by a Sputnik DAO (an account under `sputnikv2.testnet`). That happens only when the council passes the proposal. |
| **Contract-enforced spending cap** | The DAO attaches `max_spend` as escrow. The agent can only report an address. `report_payout` rejects any amount above the cap or the escrow, and any caller other than the agent. Leftover escrow goes back to the DAO. |
| **Payout tiers (programmable approvals)** | A payout within the proposer's auto-approve tier is paid at once. Anything above it is **escalated**: the escrow returns to the DAO and the executor opens a normal Sputnik `Transfer` proposal, which the council votes on as usual. |
| **Reputation-based access** | Every finished task raises the proposer's reputation by 1, and each point raises their tier: 0.2 NEAR base + 0.1 NEAR per point, up to 1 NEAR. |
| **Works with any Sputnik DAO** | Any Sputnik DAO on testnet can use the executor. Create one from the app, or open an existing one with **Open my Sputnik DAO**. |

## Try it in two minutes

| Step | What to do | What you should see |
| --- | --- | --- |
| 1 | Open https://lisdao.vercel.app | The pitch, three steps, and **Demo DAO** |
| 2 | Tap **Demo DAO** | The Sputnik DAO `lisdao-demo.sputnikv2.testnet`: balance, council, "Votes needed: 1 of 2 council", AI executor, your auto-approve tier |
| 3 | Connect a testnet wallet on the council and tap **Create New Proposal** | One wallet transaction: Sputnik `add_proposal` (0.01 NEAR bond) with a `FunctionCall` to the executor |
| 4 | Tap **Vote Yes** | Sputnik `act_proposal VoteApprove`. The proposal passes, Sputnik calls the executor, and the live agent panel opens |
| 5 | Watch the panel | Browser screenshots and steps, then "paid by the LisDao executor from the DAO’s escrow" with a nearblocks link, in about 20 seconds |
| 6 | Open "Donate 0.5 NEAR…" | An example above the tier: the executor opened a Sputnik Transfer proposal ("LisDao task #1…") for the council |

## What is real, with receipts (NEAR testnet)

| Claim | Receipt |
| --- | --- |
| Sputnik DAO created with the `sputnikv2.testnet` factory | [lisdao-demo.sputnikv2.testnet](https://testnet.nearblocks.io/address/lisdao-demo.sputnikv2.testnet) |
| LisDao executor contract | [exec.lisdao-v2-1793741346.testnet](https://testnet.nearblocks.io/address/exec.lisdao-v2-1793741346.testnet) |
| AI task proposed in Sputnik (FunctionCall to the executor) | [HcdiwXF5…](https://testnet.nearblocks.io/txns/HcdiwXF5CS48KBjKcnZApjGqDU9w5LVjfNN72QLBedN1), [81SU59HM…](https://testnet.nearblocks.io/txns/81SU59HMkEcz6KRtXbw49XCsoAKkSxEEqnyWvQfPdU29) |
| Council vote passes it, and Sputnik dispatches the task and escrows the cap | [68niAobb…](https://testnet.nearblocks.io/txns/68niAobbxYkYjhdRdPVU6m2AXsaGH5REbXJfSCHkrdSj), [Azz5hwRX…](https://testnet.nearblocks.io/txns/Azz5hwRXdi7uC7hBdFd43EjERSkrhJsnCxcoMo347wcf) |
| Agent reports the address; the executor pays 0.1 NEAR | [31bQmyYa…](https://testnet.nearblocks.io/txns/31bQmyYaWd6XfvAkHoY2ey2BQzv9H7rqwA359YGPvhHb), [J2TjSVJD…](https://testnet.nearblocks.io/txns/J2TjSVJDL2riAS8HKVeZ1T1cJJygHJmTSipmvZkNCpjN) |
| 0.5 NEAR task above the tier escalated to a Sputnik Transfer proposal | proposal [H8TUW3pB…](https://testnet.nearblocks.io/txns/H8TUW3pBL4DPjNsDrDHkPMm6A3T6G7nQKoWLwQ2tJuQ4), vote [AVb82LL2…](https://testnet.nearblocks.io/txns/AVb82LL2owL5r1D8Fb9peigsKh7QtXVpb9hWSRWxcbMA), escalation [6nEvYNDs…](https://testnet.nearblocks.io/txns/6nEvYNDs8FBcFn4TZi9YcXBxWbPAua9Zc3bZF65VzQNr) |
| Browser agent is real | Playwright Chromium + vision LLM loop in `agent/browser_agent.py`. Each step's screenshot is shown in the UI. Measured: pickup about 3 s after the vote, payout about 20 s later |

**Not claimed:** not on mainnet; testnet only. The "Water Project (demo)" charity is a page in this repo, not a real charity, and no real money moves.

## Why NEAR

- **Sputnik DAO** is a battle-tested DAO standard. LisDao plugs into it instead of reinventing votes and custody.
- **Function-call proposals with attached deposits** let the DAO hand the executor exactly the approved budget and nothing more.
- **Named and implicit accounts.** The agent and the DAO have readable account ids. The charity creates a fresh one-time implicit address for every donation.
- **Cheap, fast finality**, so propose, vote, dispatch and payout fit in one live flow.

## Architecture

```
 web (Next.js, NEAR Connector) ── add_proposal / act_proposal ──► Sputnik DAO (lisdao-demo.sputnikv2.testnet)
      ▲ polls proposals, tasks, agent feed                           │ vote passes → FunctionCall + escrow
      │                                                              ▼
 /api/agent (Vercel Blob) ◄── steps ── agent (box) ◄─ pending_tasks ─ LisDao executor (exec.lisdao-v2-…testnet)
                                         │  report_payout ─────────►  ├─ within tier: pay receiver, refund rest, +reputation
                                         ▼                            └─ above tier: refund escrow + Sputnik Transfer proposal
                     Playwright browser + vision LLM (+ OCR check) → demo charity → one-time NEAR address
```

## Fail-closed / safety

- Only Sputnik DAOs can dispatch, and only the configured **agent account** can report.
- The payout is capped by `max_spend` and by the escrow the DAO attached. The DAO's main treasury never leaves Sputnik custody.
- Amounts above the tier are not paid; they go back to a human council vote.
- The receiver must be a valid NEAR `AccountId`. The agent checks the address against the page text and an OCR reading of the screenshot.
- If the vision LLM is unavailable, a **scripted fallback** plans that step instead. It is labelled `[scripted]` in the live feed.
- Only the agent can post to the feed endpoint (shared token).

## Testnet accounts

- Sputnik DAO: `lisdao-demo.sputnikv2.testnet` (council: `kaitrades.testnet`, `lisdao-voter-1793741346.testnet`; any 1 vote passes, threshold 1/3)
- Executor: `exec.lisdao-v2-1793741346.testnet`
- Agent: `lisdao-agent-1793741346.testnet`

## Layout

- `executor/`: Rust (near-sdk 5), the Sputnik executor. `dispatch_task`, `report_payout`, `report_result`. Views: `pending_tasks`, `get_task`, `get_tasks`, `reputation`, `auto_cap`, `get_config`. Run `cargo test`: 4 tests.
- `contract/`: an earlier all-in-one DAO contract with its own voting (not used by the web app).
- `web/`: Next.js app. `lib/sputnik.js` reads Sputnik DAOs and the executor. Also `/demo-charity`, `/api/agent`, and `e2e-buttons.py` (24 UI checks).
- `agent/`: `browser_agent.py` (Playwright + vision LLM; watches the executor) and `ocr.js` (tesseract.js).

## Run

1. `cd executor && cargo test`, then `cd ../contract && cargo test`.
2. `cd web && npm i && npm run dev`. Set `BLOB_READ_WRITE_TOKEN` and `AGENT_FEED_TOKEN` to match hosting.
3. `cd agent && npm i && pip install playwright && playwright install chromium`, then:
   `WEB_URL=https://lisdao.vercel.app AGENT_FEED_TOKEN=... LLM_API_KEY=... LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai LLM_MODEL=gemini-3.1-flash-lite python browser_agent.py`
   Any OpenAI-compatible vision endpoint works (for example NEAR AI Cloud, `LLM_BASE_URL=https://cloud-api.near.ai/v1`).

## Libraries

near-sdk, near-api-js, @hot-labs/near-connect (NEAR Connector), Next.js/React, @vercel/blob, qrcode, Playwright, tesseract.js. Built with help from AI coding tools.

## License

MIT
