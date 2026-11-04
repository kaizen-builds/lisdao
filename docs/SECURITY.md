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

## Other limits
- **Receiver not bound by the vote.** `report_payout` (`executor/src/lib.rs:85-104`) pays the agent's `receiver_id` with no check against the proposal. In `agent/browser_agent.py:177` the agent falls back to the first account-like string in the page text if the LLM's address is not found there, so page content decides the receiver.
- **Open dispatch, global reputation.** The only caller check is the `.sputnikv2.testnet` suffix (`lib.rs:73`); anyone can create such a DAO. Reputation is keyed by proposer only (`lib.rs:55,99-100`), so it can be farmed in a throwaway DAO. Any such DAO can also send task text to the agent's browser.
- **Escrow can stick.** There is no timeout or cancel. Only the agent settles (`lib.rs:86,119`); the owner, a single account, can replace it (`lib.rs:128`).
- **No transfer callback.** Status is set before the transfer (`lib.rs:96,102`). If the receiver transfer fails, the task still reads `Executed` and the NEAR returns to the executor, not the DAO. If the escalation `add_proposal` fails, that batch (`lib.rs:112-113`) reverts and the escrow also stays in the executor.
- **Escrow vs treasury.** While a task runs, `max_spend` sits in the executor; the rest of the treasury stays in Sputnik.
- **Feed.** Feed text is rendered by React as plain text (no `dangerouslySetInnerHTML` in `web/`). The token is compared in constant time (`web/lib/token.js`). Reads are public.
- Agent tasks are tuned for the demo charity flow, not arbitrary websites.
- `legacy/contract/` is an unused earlier prototype and is not deployed by the app.

## Reporting
Open a GitHub issue (or contact the maintainer privately for anything sensitive).
