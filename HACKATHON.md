# LisDao Hackathon Submission Guide

This project is built for the NEAR Hackathon AI Agents / Open Innovation narrative: a DAO votes on a real-world task, an AI browser agent performs it on testnet, and the executor contract enforces spending limits and return-to-DAO flows.

## Why it fits

- NEAR-native governance: the app is built on Sputnik DAO v2 and the executor contract.
- AI agent execution: the browser agent drives a real browser, reads a page, and executes the task without a developer manually doing the action.
- Autonomous payment guardrails: the executor keeps the treasury in escrow and only pays within the voted cap or escalates above-tier payouts back to the DAO.
- Working testnet proof: the project includes live demo and transaction links, plus reproducible contract tests.

## Judging alignment

Strongest fit against common hackathon rubric items:

- Innovation: a DAO that delegates a real browser task to an AI agent.
- Technical execution: smart contract logic, NEAR RPC integration, browser automation, and live policy checks.
- Real-world usefulness: a practical pattern for funding actions approved by a DAO and audited by the chain.
- User experience: simple task proposal flow, live browser feed, and transparent payout status.

## Submission checklist

Before submitting, confirm all of the following:

1. The repo is public and includes a clear README.
2. A live testnet flow works from proposal creation through vote and agent execution.
3. The demo uses a real NEAR testnet DAO and executor contract.
4. The README clearly separates what is enforced on-chain from what remains operator-trusted off-chain.
5. The project is mapped to the intended track and uses the NEAR ecosystem appropriately.
6. A judge cloning `main` sees the full app, not a placeholder shell: `cd executor && cargo test` and `cd web && npm test` both pass. CI fails if `web/app/page.js` loses the wallet, demo DAO, proposal, live browser, or limits UI.

## Demo path judges can verify

1. Open the app and load the demo DAO.
2. Create a proposal such as “Donate 0.1 NEAR to the Water Project”.
3. Vote Yes as a council member.
4. Watch the live browser agent step through the charity donation flow.
5. Verify on-chain payout status and the executor task result.

## 60-second pitch

“LisDao turns a DAO vote into a real browser task. A community member writes the goal in plain English, the council approves it, and the browser agent performs the action on testnet. The executor contract keeps the funds in escrow and only pays within the voted cap; larger amounts are escalated back to the DAO. The result is a practical pattern for AI-managed, policy-bounded on-chain work.”

## Risk honesty for the judges

This is a strong testnet prototype, not a production financial system. The README and `docs/SECURITY.md` clearly call out the places where the design relies on an operator-trusted browser agent and where future work would strengthen the guarantees.

This honesty is useful to judges because it shows the project understands the security boundary and where the next iteration would improve it.

## Remaining work (not just polish)

The next real improvements are listed in `docs/SECURITY.md` and `docs/ROADMAP.md`. They are contract and trust-model work, not cosmetic polish:

- The vote does not bind the payout receiver; the contract pays the address the agent reports, within the cap.
- `report_payout` records `Executed` before the transfer finishes, with no callback to reconcile a failed payment.
- There is no timeout or cancel, so escrow can sit in the executor if the agent stops.
- A single operator runs the agent account; there is no TEE or independent attestation.

Before submission, keep the demo and transaction links current, keep a clean “How to run” path, and make sure a judge cloning `main` sees the same full app as the live demo.
