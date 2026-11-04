# Security model and honest limits

LisDao is a hackathon project on **NEAR testnet**. It has not been audited. Do not use it with real funds.

## Enforced by the executor contract
- `dispatch_task` only accepts callers whose account ends in `.<factory>` (`.sputnikv2.testnet`), i.e. DAOs created by the Sputnik factory. It requires the attached deposit to be ≥ `max_spend`.
- Only the configured agent account can call `report_payout` and `report_result`. Only the owner can change the agent (`set_agent`).
- A payout must be > 0, ≤ `max_spend` and ≤ the task's escrow (`"over spending cap"`).
- Amounts above the proposer's auto-approve tier are never paid automatically; the escrow returns to the DAO and a Sputnik `Transfer` proposal is opened.
- A task can be settled only once (`status == Executing` is required).
- Covered by 4 unit tests in `executor/src/lib.rs` (flow and tiers, non-DAO caller, over cap, non-agent caller).

## Enforced off-chain (you trust the operator)
- **The payout address.** The contract pays whatever receiver the agent reports, within the cap. Page-text and OCR cross-checks reduce, but do not remove, the risk of a wrong or manipulated address.
- **One central agent.** A single agent account and key, run by the operator. No TEE or attestation.
- **Feed integrity.** Feed and heartbeat POSTs need the shared `AGENT_FEED_TOKEN`; the server refuses posts when it is not set. The feed is display only; it does not move funds.
- **LLM fallback.** If the vision LLM fails, a scripted planner (tuned for the demo charity page) does the step, labelled `[scripted]`/"scripted fallback" in the feed.

## Agent-side checks (`agent/browser_agent.py`, off-chain, tested locally with mocked chain calls)
- The payee is read only from the `#deposit-address` element of the demo charity page. The planner's address must equal it exactly; on a mismatch or a missing element the agent pays nothing and calls `report_result(false)`, which refunds the escrow. There is no page-wide fallback. OCR is advisory only. In scripted-fallback mode (no LLM) the address comes from that same element, so there is no second, independent read.
- The browser is locked to the charity origin: requests to other origins are aborted, and the agent stops if `page.url` leaves that origin. The LLM prompt marks page content as untrusted. This lowers, but does not remove, prompt-injection risk from the charity page itself.
- If a run crashes twice for the same task, the agent calls `report_result(false)`. This only works while the agent is running.
- After `report_payout` on an executor task, the agent reads `get_task` and posts "Done" only if the status is `Executed` (or the escalation message if `Escalated`); otherwise it posts a failure.
- Feed POSTs are validated: `phase` in start/done/failed, `tx` a base58 hash, `address` an account id, `shot` base64 up to 400,000 characters.

## Fixed off-chain (web app)
- `POST /api/charity` rate limit (`web/lib/ratelimit.js`, unit test `web/test/ratelimit.test.mjs`).
- The wallet step no longer shows a false "Wallet did not respond" error when the popup is moved or loses focus: after 60 s it shows a "still waiting" note, clears it as soon as the wallet answers, and only reports a timeout after 10 minutes with no answer. A late success after that still clears the message.

## Known contract limits (deployed executor, not fixed)
These need a contract change and redeploy; the planned fixes are in [ROADMAP.md](ROADMAP.md).

## Other limits
- **Receiver not bound by the vote.** `report_payout` (`executor/src/lib.rs:85-104`) pays the agent's `receiver_id` with no check against the proposal. The contract does not know which page or address the council meant; only the agent checks the address (below).
- **Open dispatch, global reputation.** The only caller check is the `.sputnikv2.testnet` suffix (`lib.rs:73`); anyone can create such a DAO. Reputation is keyed by proposer only (`lib.rs:55,99-100`), so it can be farmed in a throwaway DAO. Any such DAO can also send task text to the agent's browser.
- **Escrow can stick.** There is no timeout or cancel. Only the agent settles (`lib.rs:86,119`); the owner, a single account, can replace it (`lib.rs:128`).
- **No transfer callback.** Status is set before the transfer (`lib.rs:96,102`). If the receiver transfer fails, the task still reads `Executed` and the NEAR returns to the executor, not the DAO. If the escalation `add_proposal` fails, that batch (`lib.rs:112-113`) reverts and the escrow also stays in the executor.
- **Escrow vs treasury.** While a task runs, `max_spend` sits in the executor; the rest of the treasury stays in Sputnik.
- **Feed status is not chain status.** The web UI shows "done"/"failed" from the agent's feed posts, not from a chain read; check the NearBlocks link.
- **Demo charity endpoint.** `POST /api/charity` is unauthenticated and stores a new keypair per call. It is rate limited in memory (5 requests/min per IP, 60/min total per server instance, 429 above that), which slows spam but does not stop a distributed attacker or survive across serverless instances.
- **Feed.** Feed text is rendered by React as plain text (no `dangerouslySetInnerHTML` in `web/`). The token is compared in constant time (`web/lib/token.js`). Reads are public.
- Agent tasks are tuned for the demo charity flow, not arbitrary websites.
- `legacy/contract/` is an unused earlier prototype and is not deployed by the app.

## Reporting
Open a GitHub issue (or contact the maintainer privately for anything sensitive).
