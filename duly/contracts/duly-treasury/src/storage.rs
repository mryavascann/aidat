use crate::{Config, DataKey, Error, Proposal};
use soroban_sdk::{Address, Env, Vec};

pub const MAX_MEMBERS: u32 = 128;
pub const MAX_TEMP_TTL: u32 = 17_280;
const RENEW_BELOW: u32 = 17_280;
const RETAIN_FOR: u32 = 535_680;

pub fn touch_instance(env: &Env) {
    let target = RETAIN_FOR.min(env.storage().max_ttl());
    env.storage()
        .instance()
        .extend_ttl(RENEW_BELOW.min(target), target);
}

pub fn touch(env: &Env, key: &DataKey) {
    let target = RETAIN_FOR.min(env.storage().max_ttl());
    env.storage()
        .persistent()
        .extend_ttl(key, RENEW_BELOW.min(target), target);
}

pub fn load_config(env: &Env) -> Result<Config, Error> {
    let config = env
        .storage()
        .instance()
        .get(&DataKey::Config)
        .ok_or(Error::NotInitialized)?;
    touch_instance(env);
    Ok(config)
}

pub fn load_members(env: &Env) -> Vec<Address> {
    env.storage()
        .instance()
        .get(&DataKey::Members)
        .unwrap_or(Vec::new(env))
}

pub fn require_member(env: &Env, member: &Address) -> Result<(), Error> {
    if !load_members(env).contains(member) {
        return Err(Error::NotMember);
    }
    member.require_auth();
    Ok(())
}

pub fn append_member(env: &Env, member: Address) -> Result<(), Error> {
    let mut members = load_members(env);
    if members.contains(&member) {
        return Err(Error::AlreadyMember);
    }
    if members.len() >= MAX_MEMBERS {
        return Err(Error::MemberLimit);
    }
    members.push_back(member.clone());
    env.storage().instance().set(&DataKey::Members, &members);
    crate::MemberAdded { member }.publish(env);
    Ok(())
}

pub fn load_proposal(env: &Env, id: u32) -> Result<Proposal, Error> {
    let key = DataKey::Proposal(id);
    let proposal = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::ProposalNotFound)?;
    touch(env, &key);
    // Keep a proposal and its votes alive together, including reads by strangers.
    touch(env, &DataKey::Approvals(id));
    Ok(proposal)
}

pub fn save_proposal(env: &Env, proposal: &Proposal) {
    let key = DataKey::Proposal(proposal.id);
    env.storage().persistent().set(&key, proposal);
    touch(env, &key);
}

pub fn load_approvals(env: &Env, id: u32) -> Result<Vec<Address>, Error> {
    load_proposal(env, id)?;
    env.storage()
        .persistent()
        .get(&DataKey::Approvals(id))
        .ok_or(Error::ProposalNotFound)
}

pub fn pending(env: &Env, id: u32) -> Result<Proposal, Error> {
    let proposal = load_proposal(env, id)?;
    if proposal.status != crate::ProposalStatus::Pending {
        return Err(Error::NotPending);
    }
    Ok(proposal)
}

pub fn expires_at(env: &Env, ttl: u32) -> Result<u32, Error> {
    if ttl == 0 || ttl > MAX_TEMP_TTL.min(env.storage().max_ttl()) {
        return Err(Error::InvalidTtl);
    }
    env.ledger()
        .sequence()
        .checked_add(ttl)
        .ok_or(Error::InvalidTtl)
}
