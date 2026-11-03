//! LisDAO: DAOs with weighted voting whose approved proposals are executed
//! in the real world by an authorized AI agent that reports results on-chain.
use near_sdk::store::{IterableMap, Vector};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise, BorshStorageKey};
use near_sdk::borsh::BorshSerialize;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum Key { Daos, Members(u32), Proposals(u32), Votes(u32, u32) }

#[near(serializers = [json, borsh])]
#[derive(Clone, PartialEq, Debug)]
pub enum Status { Active, Approved, Rejected, Executing, Executed, Failed }

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub enum Action {
    /// On-chain NEAR transfer from DAO treasury, executed by the contract.
    Transfer { receiver_id: AccountId, amount: NearToken },
    /// Real-world task in plain English, executed off-chain by the agent.
    AgentTask { instructions: String, max_spend: NearToken },
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct Proposal {
    pub id: u32,
    pub proposer: AccountId,
    pub title: String,
    pub action: Action,
    pub yes: u64,
    pub no: u64,
    pub status: Status,
    pub deadline_ns: u64,
    pub result: Option<String>,
}

#[near(serializers = [borsh])]
pub struct Dao {
    pub name: String,
    pub owner: AccountId,
    pub agent: AccountId,
    pub quorum_pct: u8,
    pub voting_period_ns: u64,
    pub treasury: NearToken,
    pub members: IterableMap<AccountId, u64>,
    pub total_weight: u64,
    pub proposals: Vector<Proposal>,
    pub votes: Vec<IterableMap<AccountId, bool>>,
}

#[near(serializers = [json])]
#[derive(Clone)]
pub struct DaoView {
    pub id: u32, pub name: String, pub owner: AccountId, pub agent: AccountId,
    pub quorum_pct: u8, pub voting_period_ns: u64, pub treasury: NearToken,
    pub total_weight: u64, pub members: Vec<(AccountId, u64)>, pub proposal_count: u32,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct LisDao { daos: Vector<Dao> }

#[near]
impl LisDao {
    #[init]
    pub fn new() -> Self { Self { daos: Vector::new(Key::Daos) } }

    /// Create a DAO. Caller becomes owner. `members` = [(account, weight)].
    pub fn create_dao(&mut self, name: String, agent: AccountId, quorum_pct: u8,
                      voting_period_minutes: u64, members: Vec<(AccountId, u64)>) -> u32 {
        require!(quorum_pct > 0 && quorum_pct <= 100, "quorum 1-100");
        let id = self.daos.len();
        let mut m = IterableMap::new(Key::Members(id));
        let mut total = 0;
        for (a, w) in members { total += w; m.insert(a, w); }
        let owner = env::predecessor_account_id();
        if !m.contains_key(&owner) { m.insert(owner.clone(), 1); total += 1; }
        self.daos.push(Dao { name, owner, agent, quorum_pct,
            voting_period_ns: voting_period_minutes * 60_000_000_000,
            treasury: NearToken::from_yoctonear(0), members: m, total_weight: total,
            proposals: Vector::new(Key::Proposals(id)), votes: vec![] });
        env::log_str(&format!("EVENT dao_created {id}"));
        id
    }

    pub fn set_member(&mut self, dao_id: u32, account_id: AccountId, weight: u64) {
        let dao = self.dao_mut(dao_id);
        require!(env::predecessor_account_id() == dao.owner, "only owner");
        let old = dao.members.get(&account_id).copied().unwrap_or(0);
        dao.total_weight = dao.total_weight - old + weight;
        if weight == 0 { dao.members.remove(&account_id); } else { dao.members.insert(account_id, weight); }
    }

    #[payable]
    pub fn deposit(&mut self, dao_id: u32) {
        let amt = env::attached_deposit();
        let dao = self.dao_mut(dao_id);
        dao.treasury = dao.treasury.saturating_add(amt);
    }

    pub fn propose(&mut self, dao_id: u32, title: String, action: Action) -> u32 {
        let caller = env::predecessor_account_id();
        let dao = self.dao_mut(dao_id);
        require!(dao.members.contains_key(&caller), "not a member");
        let pid = dao.proposals.len();
        let deadline_ns = env::block_timestamp() + dao.voting_period_ns;
        dao.proposals.push(Proposal { id: pid, proposer: caller, title, action,
            yes: 0, no: 0, status: Status::Active, deadline_ns, result: None });
        dao.votes.push(IterableMap::new(Key::Votes(dao_id, pid)));
        pid
    }

    pub fn vote(&mut self, dao_id: u32, proposal_id: u32, approve: bool) -> Status {
        let caller = env::predecessor_account_id();
        let dao = self.dao_mut(dao_id);
        let w = *dao.members.get(&caller).expect("not a member");
        let votes = &mut dao.votes[proposal_id as usize];
        require!(!votes.contains_key(&caller), "already voted");
        votes.insert(caller, approve);
        let total = dao.total_weight; let q = dao.quorum_pct as u64;
        let p = dao.proposals.get_mut(proposal_id).expect("no proposal");
        require!(p.status == Status::Active, "not active");
        require!(env::block_timestamp() <= p.deadline_ns, "voting closed");
        if approve { p.yes += w } else { p.no += w }
        if p.yes * 100 >= total * q {
            // Agent tasks are dispatched to the agent the moment they pass.
            if matches!(p.action, Action::AgentTask { .. }) {
                p.status = Status::Executing;
                env::log_str(&format!("EVENT agent_task {dao_id} {proposal_id}"));
            } else { p.status = Status::Approved; }
        }
        else if p.no * 100 > total * (100 - q) { p.status = Status::Rejected; }
        p.status.clone()
    }

    /// Anyone may trigger execution of an approved proposal.
    pub fn execute(&mut self, dao_id: u32, proposal_id: u32) -> Status {
        let dao = self.dao_mut(dao_id);
        let p = dao.proposals.get_mut(proposal_id).expect("no proposal");
        require!(p.status == Status::Approved, "not approved");
        match p.action.clone() {
            Action::Transfer { receiver_id, amount } => {
                require!(dao.treasury >= amount, "insufficient treasury");
                dao.treasury = dao.treasury.saturating_sub(amount);
                p.status = Status::Executed;
                p.result = Some(format!("transferred {} to {}", amount.exact_amount_display(), receiver_id));
                Promise::new(receiver_id).transfer(amount);
            }
            Action::AgentTask { .. } => {
                p.status = Status::Executing;
                env::log_str(&format!("EVENT agent_task {dao_id} {proposal_id}"));
            }
        }
        p.status.clone()
    }

    /// Only the DAO's agent can report the outcome (receipt / OCR proof summary).
    pub fn report_result(&mut self, dao_id: u32, proposal_id: u32, success: bool, report: String) {
        let caller = env::predecessor_account_id();
        let dao = self.dao_mut(dao_id);
        require!(caller == dao.agent, "only agent");
        let p = dao.proposals.get_mut(proposal_id).expect("no proposal");
        require!(p.status == Status::Executing, "not executing");
        p.status = if success { Status::Executed } else { Status::Failed };
        p.result = Some(report);
    }

    /// Agent reports the payout address it extracted (e.g. a charity's one-time
    /// deposit address). The contract itself pays from the treasury, capped by
    /// the proposal's max_spend. Only the DAO's agent may call this.
    pub fn report_payout(&mut self, dao_id: u32, proposal_id: u32, receiver_id: AccountId,
                         amount: NearToken, report: String) -> Promise {
        let caller = env::predecessor_account_id();
        let dao = self.dao_mut(dao_id);
        require!(caller == dao.agent, "only agent");
        let p = dao.proposals.get_mut(proposal_id).expect("no proposal");
        require!(p.status == Status::Executing, "not executing");
        let cap = match &p.action { Action::AgentTask { max_spend, .. } => *max_spend, _ => env::panic_str("not agent task") };
        require!(amount.as_yoctonear() > 0 && amount <= cap, "over spending cap");
        require!(dao.treasury >= amount, "insufficient treasury");
        require!(report.len() <= 1000, "report too long");
        dao.treasury = dao.treasury.saturating_sub(amount);
        p.status = Status::Executed;
        p.result = Some(format!("paid {} to {} | {}", amount.exact_amount_display(), receiver_id, report));
        env::log_str(&format!("EVENT payout {dao_id} {proposal_id} {receiver_id} {}", amount.as_yoctonear()));
        Promise::new(receiver_id).transfer(amount)
    }

    // ---- views ----
    pub fn get_dao(&self, dao_id: u32) -> DaoView { self.view(dao_id) }
    pub fn list_daos(&self) -> Vec<DaoView> { (0..self.daos.len()).map(|i| self.view(i)).collect() }
    pub fn get_proposals(&self, dao_id: u32) -> Vec<Proposal> {
        self.daos.get(dao_id).expect("no dao").proposals.iter().cloned().collect()
    }
    pub fn get_votes(&self, dao_id: u32, proposal_id: u32) -> Vec<(AccountId, bool)> {
        self.daos.get(dao_id).expect("no dao").votes[proposal_id as usize].iter().map(|(a, v)| (a.clone(), *v)).collect()
    }
    /// Proposals waiting on the agent.
    pub fn pending_tasks(&self, agent: AccountId) -> Vec<(u32, Proposal)> {
        let mut out = vec![];
        for (i, d) in self.daos.iter().enumerate() {
            if d.agent != agent { continue; }
            for p in d.proposals.iter() { if p.status == Status::Executing { out.push((i as u32, p.clone())); } }
        }
        out
    }

    fn dao_mut(&mut self, id: u32) -> &mut Dao { self.daos.get_mut(id).expect("no dao") }
    fn view(&self, id: u32) -> DaoView {
        let d = self.daos.get(id).expect("no dao");
        DaoView { id, name: d.name.clone(), owner: d.owner.clone(), agent: d.agent.clone(),
            quorum_pct: d.quorum_pct, voting_period_ns: d.voting_period_ns, treasury: d.treasury,
            total_weight: d.total_weight, members: d.members.iter().map(|(a, w)| (a.clone(), *w)).collect(),
            proposal_count: d.proposals.len() }
    }
}

#[cfg(test)]
mod tests {
    fn fund(c: &mut LisDao, id: u32, n: u128) {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(0)).attached_deposit(NearToken::from_near(n)).build());
        c.deposit(id);
    }
    #[test]
    fn payout_within_cap() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("W".into(), accounts(3), 51, 60, vec![]);
        fund(&mut c, id, 1);
        ctx(0);
        let pid = c.propose(id, "Donate".into(), Action::AgentTask { instructions: "Donate 0.1 NEAR".into(), max_spend: NearToken::from_millinear(100) });
        assert_eq!(c.vote(id, pid, true), Status::Executing);
        ctx(3);
        let _ = c.report_payout(id, pid, "charity.testnet".parse().unwrap(), NearToken::from_millinear(100), "addr from page".into());
        assert_eq!(c.get_proposals(id)[0].status, Status::Executed);
        assert_eq!(c.get_dao(id).treasury, NearToken::from_millinear(900));
    }
    #[test]
    #[should_panic(expected = "over spending cap")]
    fn payout_over_cap() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("W".into(), accounts(3), 51, 60, vec![]);
        fund(&mut c, id, 1); ctx(0);
        let pid = c.propose(id, "D".into(), Action::AgentTask { instructions: "x".into(), max_spend: NearToken::from_millinear(100) });
        c.vote(id, pid, true); ctx(3);
        let _ = c.report_payout(id, pid, "charity.testnet".parse().unwrap(), NearToken::from_millinear(200), "x".into());
    }
    #[test]
    #[should_panic(expected = "only agent")]
    fn payout_only_agent() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("W".into(), accounts(3), 51, 60, vec![]);
        fund(&mut c, id, 1); ctx(0);
        let pid = c.propose(id, "D".into(), Action::AgentTask { instructions: "x".into(), max_spend: NearToken::from_millinear(100) });
        c.vote(id, pid, true); ctx(1);
        let _ = c.report_payout(id, pid, accounts(1), NearToken::from_millinear(100), "x".into());
    }

    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;
    fn ctx(who: usize) { testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(who)).build()); }

    #[test]
    fn full_flow_agent_task() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("Lis".into(), accounts(3), 51, 60, vec![(accounts(1), 3), (accounts(2), 1)]);
        assert_eq!(c.get_dao(id).total_weight, 5);
        ctx(1);
        let pid = c.propose(id, "Donate".into(), Action::AgentTask { instructions: "Donate $20 to Red Cross".into(), max_spend: NearToken::from_millinear(100) });
        assert_eq!(c.vote(id, pid, true), Status::Executing); // 3/5 = 60% >= 51 -> auto-dispatch
        assert_eq!(c.pending_tasks(accounts(3)).len(), 1);
        ctx(3);
        c.report_result(id, pid, true, "receipt #123".into());
        assert_eq!(c.get_proposals(id)[0].status, Status::Executed);
    }

    #[test]
    #[should_panic(expected = "only agent")]
    fn non_agent_cannot_report() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("Lis".into(), accounts(3), 51, 60, vec![]);
        let pid = c.propose(id, "x".into(), Action::AgentTask { instructions: "x".into(), max_spend: NearToken::from_millinear(100) });
        c.vote(id, pid, true);
        ctx(1); c.report_result(id, pid, true, "fake".into());
    }

    #[test]
    #[should_panic(expected = "already voted")]
    fn no_double_vote() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("Lis".into(), accounts(3), 90, 60, vec![(accounts(1), 1)]);
        let pid = c.propose(id, "x".into(), Action::AgentTask { instructions: "x".into(), max_spend: NearToken::from_millinear(100) });
        c.vote(id, pid, true); c.vote(id, pid, true);
    }

    #[test]
    fn rejection() {
        ctx(0);
        let mut c = LisDao::new();
        let id = c.create_dao("Lis".into(), accounts(3), 51, 60, vec![(accounts(1), 9)]);
        let pid = c.propose(id, "x".into(), Action::AgentTask { instructions: "x".into(), max_spend: NearToken::from_millinear(100) });
        ctx(1); assert_eq!(c.vote(id, pid, false), Status::Rejected);
    }
}
