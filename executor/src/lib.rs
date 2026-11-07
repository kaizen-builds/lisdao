//! LisDao Executor: an AI-agent executor for Sputnik DAO v2.
//!
//! Custody and voting stay in the Sputnik DAO. When a council passes a
//! FunctionCall proposal that calls `dispatch_task`, the DAO escrows exactly
//! `max_spend` here and the task goes to the agent. The agent browses the real
//! world, then reports the payout address. The contract (never the agent) pays:
//! - amount must be <= the task's max_spend (spending cap set by the vote);
//! - amounts within the proposer's auto-approve tier are paid at once;
//! - larger amounts are escalated: escrow goes back to the DAO and a normal
//!   Sputnik Transfer proposal is opened for the council to vote on.
//! Every finished task raises the proposer's reputation, which raises their tier.
use near_sdk::store::{LookupMap, Vector};
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise};
use near_sdk::borsh::BorshSerialize;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum Key { Tasks, Rep }

#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq, Debug)]
pub enum Status { Executing, Executed, Escalated, Failed }

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub enum Action { AgentTask { instructions: String, max_spend: NearToken } }

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Task {
    pub id: u32,
    pub dao: AccountId,
    pub proposal_id: Option<u64>,
    pub proposer: AccountId,
    pub title: String,
    pub action: Action,
    pub escrow: NearToken,
    pub status: Status,
    pub result: Option<String>,
    pub created_ns: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Executor {
    owner: AccountId,
    agent: AccountId,
    factory: String,
    base_cap: NearToken,
    rep_step: NearToken,
    max_auto: NearToken,
    bond: NearToken,
    tasks: Vector<Task>,
    rep: LookupMap<AccountId, u32>,
}

#[near]
impl Executor {
    #[init]
    pub fn new(owner: AccountId, agent: AccountId, factory: String, base_cap: NearToken,
               rep_step: NearToken, max_auto: NearToken, bond: NearToken) -> Self {
        Self { owner, agent, factory, base_cap, rep_step, max_auto, bond,
               tasks: Vector::new(Key::Tasks), rep: LookupMap::new(Key::Rep) }
    }

    /// Called by a Sputnik DAO (a sub-account of the factory) when its
    /// FunctionCall proposal passes. Attached deposit is the task's escrow.
    #[payable]
    pub fn dispatch_task(&mut self, title: String, instructions: String, max_spend: NearToken,
                         proposer: AccountId, proposal_id: Option<u64>) -> u32 {
        let dao = env::predecessor_account_id();
        require!(dao.as_str().ends_with(&format!(".{}", self.factory)), "only a Sputnik DAO can dispatch");
        require!(env::attached_deposit() >= max_spend && max_spend.as_yoctonear() > 0, "attach max_spend as escrow");
        require!(instructions.len() <= 500 && title.len() <= 120, "too long");
        let id = self.tasks.len();
        self.tasks.push(Task { id, dao: dao.clone(), proposal_id, proposer, title,
            action: Action::AgentTask { instructions, max_spend }, escrow: env::attached_deposit(),
            status: Status::Executing, result: None, created_ns: env::block_timestamp() });
        env::log_str(&format!("EVENT agent_task {dao} {id}"));
        id
    }

    /// Agent reports the payout address it read off the page.
    pub fn report_payout(&mut self, task_id: u32, receiver_id: AccountId, amount: NearToken, report: String) -> Promise {
        require!(env::predecessor_account_id() == self.agent, "only agent");
        require!(report.len() <= 1000, "report too long");
        let cap = self.auto_cap_of(&self.tasks.get(task_id).expect("no task").proposer.clone());
        let bond = self.bond;
        let t = self.tasks.get_mut(task_id).expect("no task");
        require!(t.status == Status::Executing, "not executing");
        let Action::AgentTask { max_spend, .. } = t.action.clone();
        require!(amount.as_yoctonear() > 0 && amount <= max_spend && amount <= t.escrow, "over spending cap");
        let dao = t.dao.clone(); let escrow = t.escrow; t.escrow = NearToken::from_yoctonear(0);
        if amount <= cap {
            t.status = Status::Executed;
            t.result = Some(format!("paid {} to {} | {}", amount.exact_amount_display(), receiver_id, report));
            let proposer = t.proposer.clone();
            let r = self.rep.get(&proposer).copied().unwrap_or(0);
            self.rep.insert(proposer, r + 1);
            env::log_str(&format!("EVENT payout {task_id} {receiver_id} {}", amount.as_yoctonear()));
            let pay = Promise::new(receiver_id).transfer(amount);
            let rest = escrow.saturating_sub(amount);
            if rest.as_yoctonear() > 0 { pay.and(Promise::new(dao).transfer(rest)) } else { pay }
        } else {
            t.status = Status::Escalated;
            t.result = Some(format!("{} to {} is above the auto-approve tier ({}); opened a Sputnik Transfer proposal | {}",
                amount.exact_amount_display(), receiver_id, cap.exact_amount_display(), report));
            env::log_str(&format!("EVENT escalated {task_id} {receiver_id} {}", amount.as_yoctonear()));
            let args = json!({"proposal": {"description": format!("LisDao task #{task_id}: agent payout over auto tier. {report}"),
                "kind": {"Transfer": {"token_id": "", "receiver_id": receiver_id, "amount": amount.as_yoctonear().to_string()}}}});
            Promise::new(dao).transfer(escrow)
                .function_call("add_proposal".to_string(), args.to_string().into_bytes(), bond, Gas::from_tgas(30))
        }
    }

    /// Agent reports failure; escrow returns to the DAO.
    pub fn report_result(&mut self, task_id: u32, success: bool, report: String) {
        require!(env::predecessor_account_id() == self.agent, "only agent");
        let t = self.tasks.get_mut(task_id).expect("no task");
        require!(t.status == Status::Executing, "not executing");
        require!(!success, "use report_payout for success");
        t.status = Status::Failed; t.result = Some(report);
        let e = t.escrow; t.escrow = NearToken::from_yoctonear(0);
        if e.as_yoctonear() > 0 { Promise::new(t.dao.clone()).transfer(e); }
    }

    pub fn set_agent(&mut self, agent: AccountId) { require!(env::predecessor_account_id() == self.owner, "only owner"); self.agent = agent; }

    // ---- views ----
    pub fn pending_tasks(&self) -> Vec<Task> { self.tasks.iter().filter(|t| t.status == Status::Executing).cloned().collect() }
    pub fn get_task(&self, task_id: u32) -> Option<Task> { self.tasks.get(task_id).cloned() }
    pub fn get_tasks(&self, dao: AccountId) -> Vec<Task> { self.tasks.iter().filter(|t| t.dao == dao).cloned().collect() }
    pub fn reputation(&self, account_id: AccountId) -> u32 { self.rep.get(&account_id).copied().unwrap_or(0) }
    pub fn auto_cap(&self, account_id: AccountId) -> NearToken { self.auto_cap_of(&account_id) }
    pub fn get_config(&self) -> near_sdk::serde_json::Value {
        json!({"owner": self.owner, "agent": self.agent, "factory": self.factory, "base_cap": self.base_cap,
               "rep_step": self.rep_step, "max_auto": self.max_auto, "bond": self.bond, "tasks": self.tasks.len()})
    }
    fn auto_cap_of(&self, a: &AccountId) -> NearToken {
        let r = self.rep.get(a).copied().unwrap_or(0) as u128;
        let c = self.base_cap.as_yoctonear() + r * self.rep_step.as_yoctonear();
        NearToken::from_yoctonear(c.min(self.max_auto.as_yoctonear()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::VMContextBuilder;
    use near_sdk::testing_env;
    fn n(x: u128) -> NearToken { NearToken::from_millinear(x) }
    fn ctx(p: &str, dep: NearToken) { testing_env!(VMContextBuilder::new().predecessor_account_id(p.parse().unwrap()).attached_deposit(dep).account_balance(NearToken::from_near(10)).build()); }
    fn mk() -> Executor { Executor::new("o.testnet".parse().unwrap(), "agent.testnet".parse().unwrap(), "sputnikv2.testnet".into(), n(200), n(100), n(1000), n(100)) }
    #[test] fn flow_and_tiers() {
        let mut c = mk();
        ctx("d.sputnikv2.testnet", n(100));
        let id = c.dispatch_task("t".into(), "donate 0.1 NEAR".into(), n(100), "k.testnet".parse().unwrap(), Some(3));
        ctx("agent.testnet", NearToken::from_yoctonear(0));
        c.report_payout(id, "x.testnet".parse().unwrap(), n(100), "ok".into());
        assert_eq!(c.get_task(id).unwrap().status, Status::Executed);
        assert_eq!(c.reputation("k.testnet".parse().unwrap()), 1);
        assert_eq!(c.auto_cap("k.testnet".parse().unwrap()), n(300));
        ctx("d.sputnikv2.testnet", n(500));
        let id2 = c.dispatch_task("t".into(), "donate 0.5 NEAR".into(), n(500), "k.testnet".parse().unwrap(), None);
        ctx("agent.testnet", NearToken::from_yoctonear(0));
        c.report_payout(id2, "x.testnet".parse().unwrap(), n(500), "ok".into());
        assert_eq!(c.get_task(id2).unwrap().status, Status::Escalated);
    }
    #[test] #[should_panic(expected = "only a Sputnik DAO")] fn not_dao() { let mut c = mk(); ctx("evil.testnet", n(100)); c.dispatch_task("t".into(), "i".into(), n(100), "k.testnet".parse().unwrap(), None); }
    #[test] #[should_panic(expected = "over spending cap")] fn over_cap() {
        let mut c = mk(); ctx("d.sputnikv2.testnet", n(100));
        let id = c.dispatch_task("t".into(), "i".into(), n(100), "k.testnet".parse().unwrap(), None);
        ctx("agent.testnet", NearToken::from_yoctonear(0)); c.report_payout(id, "x.testnet".parse().unwrap(), n(101), "".into());
    }
    #[test] #[should_panic(expected = "only agent")] fn not_agent() {
        let mut c = mk(); ctx("d.sputnikv2.testnet", n(100));
        let id = c.dispatch_task("t".into(), "i".into(), n(100), "k.testnet".parse().unwrap(), None);
        ctx("k.testnet", NearToken::from_yoctonear(0)); c.report_payout(id, "x.testnet".parse().unwrap(), n(100), "".into());
    }
}
