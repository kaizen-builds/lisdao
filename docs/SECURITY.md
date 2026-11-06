# Security model and honest limits

LisDao is a hackathon project on **NEAR testnet**. It has not been audited. Do not use it with real funds.

## Enforced by the executor contract
- `dispatch_task` only accepts callers whose account ends in `.<factory>` (`.sputnikv2.testnet`), i.e. DAOs created by the Sputnik factory. It requires the attached deposit to be ≥ `max_spend`.
- When a task includes a concrete receiver in the proposal text, the executor enforces an exact `expected_receiver` match before a payout is allowed. The demo charity flow continues to be open-ended because the one-time deposit address is discovered only at runtime.
- Only the configured agent account can call `report_payout` and `report_result`. Only the owner can change the agent (`set_agent`).
- A payout must be > 0, ≤ `max_spend` and ≤ the task's escrow (`"over spending cap"`).
- Amounts above the proposer's auto-approve tier are never paid automatically; the escrow returns to the DAO and a Sputnik `Transfer` proposal is opened.
- A task can be settled only once (`status == Executing` is required).
- Covered by unit tests in `executor/src/lib.rs` for flow and tiers, expected receiver enforcement, mismatched receiver rejection, non-DAO caller, over cap, and non-agent caller.

## Enforced off-chain (you trust the operator)
- **The payout address.** The contract pays whatever receiver the agent reports, within the cap, unless a proposal explicitly includes an expected recipient. Page-text and OCR cross-checks reduce, but do not remove, the risk of a wrong or manipulated address.
- **One central agent.** A single agent account and key, run by the operator. No TEE or attestation.
- **Feed integrity.** Feed and heartbeat POSTs need the shared `AGENT_FEED_TOKEN`; the server refuses posts when it is not set. The feed is display only; it does not move funds.
- **LLM fallback.** If the vision LLM fails, a scripted planner (tuned for the demo charity page) does the step, labelled `[scripted]`/"scripted fallback" in the feed.

## Agent-side checks (`agent/browser_agent.py`, off-chain, tested locally with mocked chain calls)
- The payee is read only from the `#deposit-address` element of the demo charity page. The planner's address must equal it exactly; on a mismatch or a missing element the agent pays nothing and calls `report_result(false)`.
- The browser is locked to the charity origin: requests to other origins are aborted, and the agent stops if `page.url` leaves that origin. The LLM prompt marks page content as untrusted. This lowers, but does not remove, the risk of a manipulated page.
- If a run crashes twice for the same task, the agent calls `report_result(false)`. This only works while the agent is running.
- After `report_payout` on an executor task, the agent reads `get_task` and posts "Done" only if the status is `Executed` (or the escalation message if `Escalated`); otherwise it posts a failure.
- Feed POSTs are validated: `phase` in start/done/failed, `tx` a base58 hash, `address` an account id, `shot` base64 up to 400,000 characters.

## Fixed off-chain (web app)
- `POST /api/charity` rate limit (`web/lib/ratelimit.js`, unit test `web/test/ratelimit.test.mjs`).
- The wallet step no longer shows a false "Wallet did not respond" error when the popup is moved or loses focus: after 60 s it shows a "still waiting" note, clears it as soon as the wallet answers, and keeps the user informed.
- Task creation now parses a concrete receiver from task text when one is included, and passes that receiver as `expected_receiver` to the executor.

## Known contract limits (deployed executor, not fixed)
These need a contract change and redeploy; the planned fixes are in [ROADMAP.md](ROADMAP.md).

## Other limits
- **Receiver not always bound by the vote.** When a task's instructions do not name a concrete NEAR account, the agent still identifies the receiver dynamically from the page. This is acceptable for a demo flow, but it means the vote is only binding on amount and policy, not on destination identity, unless the task explicitly states an expected receiver.
- **Open dispatch, global reputation.** The only caller check is the `.sputnikv2.testnet` suffix; anyone can create such a DAO. Reputation is keyed by proposer only.
- **Escrow can stick.** There is no timeout or cancel. Only the agent settles; the owner can swap it.
- **No transfer callback.** Status is set before the transfer. If the receiver transfer fails, the task still reads `Executed` and the NEAR returns to the executor, not the DAO.
- **Escrow vs treasury.** While a task runs, `max_spend` sits in the executor; the rest of the treasury stays in Sputnik.
- **Feed status is not chain status.** The web UI shows "done"/"failed" from the agent's feed posts, not from a chain read; check the NearBlocks link.
- **Demo charity endpoint.** `POST /api/charity` is unauthenticated and stores a new keypair per call. It is rate limited in memory.
- **Feed.** Feed text is rendered by React as plain text. The token is compared in constant time (`web/lib/token.js`). Reads are public.
- Agent tasks are tuned for the demo charity flow, not arbitrary websites.
- `legacy/contract/` is an unused earlier prototype and is not deployed by the app.

## Limit test (over-cap payout is refused)
**What it shows:** the executor refuses a payout above the amount the DAO voted (`max_spend`), even when the call comes from the real agent account.

**Status:** reproducible steps below; **not yet run on testnet.** `report_payout` checks the task status (`Executing`) before the cap, and every task on the live executor is already settled (`Executed` / `Escalated` / `Failed`) before a new run.

Already on-chain: `report_payout` from a non-agent account fails `only agent`, nothing moves. The contract also guards `receiver mismatch` when an `expected_receiver` has been declared for the task.

**Steps (testnet):**
1. Stop the agent so it doesn't settle the task first.
2. In the demo DAO, create a proposal with a cap, e.g. "Donate 0.1 NEAR to the Water Project", and pass it with a council wallet. Sputnik calls `dispatch_task` with 0.1 NEAR escrow.
3. Find the task id: `near contract call-function as-read-only exec.lisdao-v2-1793741346.testnet pending_tasks json-args '{}' network-config testnet now`.
4. As the agent, report more than the cap:
   `near contract call-function as-transaction exec.lisdao-v2-1793741346.testnet report_payout json-args '{"task_id":<ID>,"receiver_id":"lisdao-voter-1793741346.testnet","amount":"2000000000000000000000000","report":"test"}' ...`
5. Expected: the transaction fails with `Smart contract panicked: over spending cap`; the task stays `Executing` with its full escrow (`get_task`).
6. Settle it: restart the agent (it completes the task normally), or call `report_result` with `success:false` to refund the escrow to the DAO.

## Reporting
Open a GitHub issue (or contact the maintainer privately for anything sensitive).

