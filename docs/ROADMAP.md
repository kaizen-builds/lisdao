# Proposed contract fixes (NOT deployed)

None of this is in the deployed executor `exec.lisdao-v2-1793741346.testnet`. It runs the code described in [SECURITY.md](SECURITY.md).

1. **Bind the receiver.** Add `receiver: Option<AccountId>` (or a receiver prefix/allow-list) to `dispatch_task` args, so it is part of what the council votes on; `report_payout` requires `receiver_id` to match.
2. **DAO allow-list and per-DAO reputation.** Owner- or DAO-managed `allowed_daos` set checked in `dispatch_task`; key `rep` by `(dao, proposer)`.
3. **Timeout refund.** `cancel_expired(task_id)`, callable by anyone once `block_timestamp > created_ns + timeout`, marks the task `Failed` and returns escrow to the DAO.
4. **Transfer callback.** Chain `.then(on_payout(task_id))`; on failure mark `Failed` and refund the DAO.
5. **Owner as DAO/multisig**, and a function-call-only agent key limited to `report_payout`/`report_result` on the executor.
6. Verifiable agent (TEE / NEAR AI), multiple agents with stake/slashing, mainnet only after an audit.
