#![no_std]

use soroban_sdk::{contract, contractimpl, token, vec, Address, Bytes, BytesN, Env, String, Vec};

mod storage;
mod types;
mod vault;
use storage::*;
pub use types::*;

#[contract]
pub struct Treasury;

#[contractimpl]
impl Treasury {
    /// Initialize atomically at deployment, so a third party cannot claim an
    /// uninitialized treasury between deployment and a separate init call.
    pub fn __constructor(
        env: Env,
        admin: Address,
        token: Address,
        name: String,
        dues_try: i128,
        quorum: u32,
        vault: Option<Address>,
    ) {
        Self::init(env, admin, token, name, dues_try, quorum, vault).unwrap();
    }

    /// Kept in the interface for explicit double-initialization rejection.
    pub fn init(
        env: Env,
        admin: Address,
        token: Address,
        name: String,
        dues_try: i128,
        quorum: u32,
        vault: Option<Address>,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        admin.require_auth();
        if dues_try <= 0 {
            return Err(Error::InvalidAmount);
        }
        if !(2..=MAX_MEMBERS).contains(&quorum) {
            return Err(Error::InvalidQuorum);
        }
        if name.is_empty() || name.len() > 80 {
            return Err(Error::InvalidText);
        }
        if let Some(vault_address) = &vault {
            vault::validate(&env, vault_address, &token)?;
        }
        let members = vec![&env, admin.clone()];
        env.storage().instance().set(
            &DataKey::Config,
            &Config {
                admin,
                token,
                name,
                dues_try,
                quorum,
                vault,
            },
        );
        env.storage().instance().set(&DataKey::Members, &members);
        env.storage()
            .instance()
            .set(&DataKey::ProposalCount, &0_u32);
        touch_instance(&env);
        Ok(())
    }

    pub fn set_dues(env: Env, dues_try: i128) -> Result<(), Error> {
        let mut config = load_config(&env)?;
        config.admin.require_auth();
        if dues_try <= 0 {
            return Err(Error::InvalidAmount);
        }
        config.dues_try = dues_try;
        env.storage().instance().set(&DataKey::Config, &config);
        Ok(())
    }

    pub fn add_member(env: Env, member: Address) -> Result<(), Error> {
        load_config(&env)?.admin.require_auth();
        append_member(&env, member)
    }

    pub fn create_invite(
        env: Env,
        code_hash: BytesN<32>,
        uses: u32,
        ttl_ledgers: u32,
    ) -> Result<(), Error> {
        load_config(&env)?.admin.require_auth();
        if uses == 0 || uses > MAX_MEMBERS {
            return Err(Error::InvalidInvite);
        }
        let expiry = expires_at(&env, ttl_ledgers)?;
        let key = DataKey::Invite(code_hash);
        let existing: Option<Invite> = env.storage().temporary().get(&key);
        if existing.is_some_and(|i| i.expires_at > env.ledger().sequence()) {
            return Err(Error::InviteExists);
        }
        env.storage().temporary().set(
            &key,
            &Invite {
                uses,
                expires_at: expiry,
            },
        );
        env.storage()
            .temporary()
            .extend_ttl(&key, ttl_ledgers, ttl_ledgers);
        Ok(())
    }

    pub fn join(env: Env, member: Address, code: Bytes) -> Result<(), Error> {
        load_config(&env)?;
        member.require_auth();
        if code.len() < 16 || code.len() > 128 {
            return Err(Error::InvalidInvite);
        }
        let key = DataKey::Invite(env.crypto().sha256(&code).to_bytes());
        let mut invite: Invite = env
            .storage()
            .temporary()
            .get(&key)
            .ok_or(Error::InvalidInvite)?;
        if invite.uses == 0 || env.ledger().sequence() >= invite.expires_at {
            return Err(Error::InvalidInvite);
        }
        append_member(&env, member)?;
        invite.uses -= 1;
        env.storage().temporary().set(&key, &invite);
        Ok(())
    }

    pub fn contribute(env: Env, from: Address, amount: i128) -> Result<(), Error> {
        let config = load_config(&env)?;
        require_member(&env, &from)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let key = DataKey::Contribution(from.clone());
        let total: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        let total = total.checked_add(amount).ok_or(Error::Arithmetic)?;
        token::Client::new(&env, &config.token).transfer(
            &from,
            env.current_contract_address(),
            &amount,
        );
        if config.vault.is_some() {
            vault::deposit(&env, &config, amount)?;
        }
        env.storage().persistent().set(&key, &total);
        touch(&env, &key);
        ContributionRecorded {
            member: from,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn propose(
        env: Env,
        proposer: Address,
        payee: Address,
        amount: i128,
        description: String,
    ) -> Result<u32, Error> {
        let config = load_config(&env)?;
        require_member(&env, &proposer)?;
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        if description.is_empty() || description.len() > 512 {
            return Err(Error::InvalidText);
        }
        if payee == env.current_contract_address() {
            return Err(Error::InvalidPayee);
        }
        if load_members(&env).len() < config.quorum {
            return Err(Error::QuorumUnreachable);
        }
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);
        let id = count.checked_add(1).ok_or(Error::Arithmetic)?;
        save_proposal(
            &env,
            &Proposal {
                id,
                proposer: proposer.clone(),
                payee: payee.clone(),
                amount,
                description,
                status: ProposalStatus::Pending,
                created_at: env.ledger().sequence(),
                executed_at: None,
            },
        );
        let key = DataKey::Approvals(id);
        env.storage().persistent().set(&key, &vec![&env, proposer]);
        touch(&env, &key);
        env.storage().instance().set(&DataKey::ProposalCount, &id);
        ExpenseProposed { id, payee, amount }.publish(&env);
        Ok(id)
    }

    pub fn approve(env: Env, member: Address, id: u32) -> Result<u32, Error> {
        load_config(&env)?;
        require_member(&env, &member)?;
        pending(&env, id)?;
        let mut approvals = load_approvals(&env, id)?;
        if approvals.contains(&member) {
            return Err(Error::AlreadyApproved);
        }
        approvals.push_back(member.clone());
        let key = DataKey::Approvals(id);
        env.storage().persistent().set(&key, &approvals);
        touch(&env, &key);
        let count = approvals.len();
        ExpenseApproved { id, member, count }.publish(&env);
        Ok(count)
    }

    /// Permissionless relay: neither caller nor administrator can change the
    /// recipient or amount members approved. Token errors roll back the status.
    pub fn execute(env: Env, id: u32) -> Result<(), Error> {
        let config = load_config(&env)?;
        let mut proposal = pending(&env, id)?;
        if load_approvals(&env, id)?.len() < config.quorum {
            return Err(Error::QuorumNotMet);
        }
        let token = token::Client::new(&env, &config.token);
        let treasury = env.current_contract_address();
        let liquid = token.balance(&treasury);
        if liquid < proposal.amount {
            let shortfall = proposal.amount - liquid;
            if vault::balance(&env, &config)? < shortfall {
                return Err(Error::InsufficientBalance);
            }
            vault::withdraw(&env, &config, shortfall)?;
        }
        proposal.status = ProposalStatus::Executed;
        proposal.executed_at = Some(env.ledger().sequence());
        save_proposal(&env, &proposal);
        token.transfer(&treasury, &proposal.payee, &proposal.amount);
        ExpenseExecuted {
            id,
            payee: proposal.payee,
            amount: proposal.amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn cancel(env: Env, id: u32) -> Result<(), Error> {
        load_config(&env)?.admin.require_auth();
        let mut proposal = pending(&env, id)?;
        proposal.status = ProposalStatus::Cancelled;
        save_proposal(&env, &proposal);
        ExpenseCancelled { id }.publish(&env);
        Ok(())
    }

    /// An expiring payee declaration; it does not prove bank settlement.
    pub fn record_payout(
        env: Env,
        id: u32,
        anchor_memo: u64,
        rate: i128,
        ttl: u32,
    ) -> Result<(), Error> {
        load_config(&env)?;
        let proposal = load_proposal(&env, id)?;
        if proposal.status != ProposalStatus::Executed {
            return Err(Error::NotExecuted);
        }
        proposal.payee.require_auth();
        if rate <= 0 {
            return Err(Error::InvalidAmount);
        }
        let expiry = expires_at(&env, ttl)?;
        if Self::payout_intent(env.clone(), id)?.is_some() {
            return Err(Error::PayoutActive);
        }
        let key = DataKey::Payout(id);
        env.storage().temporary().set(
            &key,
            &PayoutIntent {
                anchor_memo,
                rate,
                expires_at: expiry,
            },
        );
        env.storage().temporary().extend_ttl(&key, ttl, ttl);
        Ok(())
    }

    pub fn config(env: Env) -> Result<Config, Error> {
        load_config(&env)
    }

    pub fn members(env: Env) -> Result<Vec<Address>, Error> {
        load_config(&env)?;
        Ok(load_members(&env))
    }

    pub fn balance(env: Env) -> Result<i128, Error> {
        let config = load_config(&env)?;
        let liquid =
            token::Client::new(&env, &config.token).balance(&env.current_contract_address());
        liquid
            .checked_add(vault::balance(&env, &config)?)
            .ok_or(Error::Arithmetic)
    }

    pub fn liquid_balance(env: Env) -> Result<i128, Error> {
        let config = load_config(&env)?;
        Ok(token::Client::new(&env, &config.token).balance(&env.current_contract_address()))
    }

    pub fn vault_balance(env: Env) -> Result<i128, Error> {
        vault::balance(&env, &load_config(&env)?)
    }

    pub fn invest(env: Env, amount: i128) -> Result<(), Error> {
        let config = load_config(&env)?;
        config.admin.require_auth();
        vault::deposit(&env, &config, amount)
    }

    pub fn divest(env: Env, amount: i128) -> Result<(), Error> {
        let config = load_config(&env)?;
        config.admin.require_auth();
        vault::withdraw(&env, &config, amount)
    }

    pub fn contribution(env: Env, member: Address) -> Result<i128, Error> {
        load_config(&env)?;
        let key = DataKey::Contribution(member);
        let amount = env.storage().persistent().get(&key);
        if amount.is_some() {
            touch(&env, &key);
        }
        Ok(amount.unwrap_or(0))
    }

    pub fn proposal(env: Env, id: u32) -> Result<Proposal, Error> {
        load_config(&env)?;
        load_proposal(&env, id)
    }

    pub fn approvals(env: Env, id: u32) -> Result<Vec<Address>, Error> {
        load_config(&env)?;
        load_approvals(&env, id)
    }

    pub fn proposal_count(env: Env) -> Result<u32, Error> {
        load_config(&env)?;
        Ok(env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0))
    }

    pub fn payout_intent(env: Env, id: u32) -> Result<Option<PayoutIntent>, Error> {
        load_config(&env)?;
        let value: Option<PayoutIntent> = env.storage().temporary().get(&DataKey::Payout(id));
        Ok(value.filter(|i| env.ledger().sequence() < i.expires_at))
    }

    pub fn invite_uses(env: Env, code_hash: BytesN<32>) -> Result<u32, Error> {
        load_config(&env)?;
        let invite: Option<Invite> = env.storage().temporary().get(&DataKey::Invite(code_hash));
        Ok(invite
            .filter(|i| env.ledger().sequence() < i.expires_at)
            .map_or(0, |i| i.uses))
    }
}

#[cfg(test)]
mod test;
