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
- Any Sputnik DAO can dispatch to the shared executor; reputation is per proposer across all DAOs.
- Agent tasks are tuned for the demo charity flow, not arbitrary websites.
- `legacy/contract/` is an unused earlier prototype and is not deployed by the app.

## Reporting
Open a GitHub issue (or contact the maintainer privately for anything sensitive).
