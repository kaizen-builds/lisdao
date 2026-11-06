# LisDao Hackathon Submission Guide
+
+This project is built for the NEAR Hackathon AI Agents / Open Innovation narrative: a DAO votes on a real-world task, an AI browser agent performs it on testnet, and the executor contract enforces the spending and escalation rules on-chain.
+
+## Why it fits
+
+- **NEAR-native governance:** the app is built on Sputnik DAO v2 and the executor contract.
+- **AI agent execution:** the browser agent drives a real browser, reads a page, and executes the task without a developer manually doing the action.
+- **Autonomous payment guardrails:** the executor keeps the treasury in escrow and only pays within the voted cap or escalates above-tier payouts back to the DAO.
+- **Working testnet proof:** the project includes live demo and transaction links, plus reproducible contract tests.
+
+## Judging alignment
+
+Strongest fit against common hackathon rubric items:
+
+- **Innovation:** a DAO that delegates a real browser task to an AI agent.
+- **Technical execution:** smart contract logic, NEAR RPC integration, browser automation, and live policy checks.
+- **Real-world usefulness:** a practical pattern for funding actions approved by a DAO and audited by the chain.
+- **User experience:** simple task proposal flow, live browser feed, and transparent payout status.
+
+## Submission checklist
+
+Before submitting, confirm all of the following:
+
+1. The repo is public and includes a clear README.
+2. A live testnet flow works from proposal creation through vote and agent execution.
+3. The demo uses a real NEAR testnet DAO and executor contract.
+4. The README clearly separates what is enforced on-chain from what remains operator-trusted off-chain.
+5. The project is mapped to the intended track and uses the NEAR ecosystem appropriately.
+
+## Demo path judges can verify
+
+1. Open the app and load the demo DAO.
+2. Create a proposal such as “Donate 0.1 NEAR to the Water Project”.
+3. Vote Yes as a council member.
+4. Watch the live browser agent step through the charity donation flow.
+5. Verify on-chain payout status and the executor task result.
+
+## 60-second pitch
+
+“LisDao turns a DAO vote into a real browser task. A community member writes the goal in plain English, the council approves it, and the browser agent performs the action on testnet. The executor contract keeps the funds in escrow and only pays within the voted cap; larger amounts are escalated back to the DAO. The result is a practical pattern for AI-managed, policy-bounded on-chain work.”
+
+## Risk honesty for the judges
+
+This is a strong testnet prototype, not a production financial system. The README and `docs/SECURITY.md` clearly call out the places where the design relies on an operator-trusted browser agent and where future work will strengthen the guarantees.
+
+This honesty is useful to judges because it shows the project understands the security boundary and where the next iteration would improve it.
+
+## Recommended final layers before submission
+
+- Add a `HACKATHON.md` or track-specific summary.
+- Include a clean “How to run” path for a fresh environment.
+- Keep the demo and transaction links current.
+- Ensure the repo story is simple enough for a judge to evaluate in under 5 minutes.
+
+This project is already close to a strong NEAR AI-agent submission: the remaining work is mainly polish, tighter security language, and clearer evidence for the judge.
+
