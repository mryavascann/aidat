use crate::{Config, DataKey, Error, Expense, Motion, Seat, Spent, Vote};
use soroban_sdk::{Address, Env, Vec};

pub fn touch_instance(e: &Env) {
    let target = 535_680.min(e.storage().max_ttl());
    e.storage()
        .instance()
        .extend_ttl(17_280.min(target), target);
}
pub fn touch(e: &Env, key: &DataKey) {
    let target = 535_680.min(e.storage().max_ttl());
    e.storage()
        .persistent()
        .extend_ttl(key, 17_280.min(target), target);
}
pub fn config(e: &Env) -> Config {
    touch_instance(e);
    e.storage().instance().get(&DataKey::Config).unwrap()
}
pub fn save_config(e: &Env, value: &Config) {
    e.storage().instance().set(&DataKey::Config, value);
    touch_instance(e);
}
pub fn seat(e: &Env, id: u32) -> Result<Seat, Error> {
    if id == 0 || id > config(e).seat_count {
        return Err(Error::InvalidSeat);
    }
    let key = DataKey::Seat(id);
    let value = e
        .storage()
        .persistent()
        .get(&key)
        .ok_or(Error::InvalidSeat)?;
    touch(e, &key);
    Ok(value)
}
pub fn save_seat(e: &Env, value: &Seat) {
    let key = DataKey::Seat(value.id);
    e.storage().persistent().set(&key, value);
    touch(e, &key);
}
pub fn voter(e: &Env, id: u32, actor: &Address) -> Result<Seat, Error> {
    let s = seat(e, id)?;
    if s.owner != *actor && s.delegate.as_ref() != Some(actor) {
        return Err(Error::NotVoter);
    }
    actor.require_auth();
    Ok(s)
}
pub fn participant(e: &Env, actor: &Address) -> Result<(), Error> {
    let cfg = config(e);
    if cfg.manager == *actor {
        actor.require_auth();
        return Ok(());
    }
    for id in 1..=cfg.seat_count {
        let s = seat(e, id)?;
        if s.owner == *actor || s.delegate.as_ref() == Some(actor) {
            actor.require_auth();
            return Ok(());
        }
    }
    Err(Error::NotVoter)
}
pub fn cast(e: &Env, votes: &mut Vec<Vote>, s: &Seat, support: bool) {
    let value = Vote {
        seat: s.id,
        version: s.version,
        support,
    };
    for i in 0..votes.len() {
        if votes.get(i).unwrap().seat == s.id {
            votes.set(i, value);
            return;
        }
    }
    let _ = e;
    votes.push_back(value);
}
pub fn tally(e: &Env, votes: &Vec<Vote>, excluded: Option<u32>) -> Result<(u32, u32), Error> {
    let mut yes = 0;
    let mut no = 0;
    for vote in votes.iter() {
        if excluded == Some(vote.seat) {
            continue;
        }
        if seat(e, vote.seat)?.version != vote.version {
            continue;
        }
        if vote.support {
            yes += 1;
        } else {
            no += 1;
        }
    }
    Ok((yes, no))
}
pub fn motion(e: &Env, id: u32) -> Result<Motion, Error> {
    let key = DataKey::Motion(id);
    let value = e.storage().persistent().get(&key).ok_or(Error::NotFound)?;
    touch(e, &key);
    Ok(value)
}
pub fn save_motion(e: &Env, value: &Motion) {
    let key = DataKey::Motion(value.id);
    e.storage().persistent().set(&key, value);
    touch(e, &key);
}
pub fn expense(e: &Env, id: u32) -> Result<Expense, Error> {
    let key = DataKey::Expense(id);
    let value = e.storage().persistent().get(&key).ok_or(Error::NotFound)?;
    touch(e, &key);
    Ok(value)
}
pub fn save_expense(e: &Env, value: &Expense) {
    let key = DataKey::Expense(value.id);
    e.storage().persistent().set(&key, value);
    touch(e, &key);
}
pub fn count(e: &Env, key: &DataKey) -> u32 {
    touch_instance(e);
    e.storage().instance().get(key).unwrap_or(0)
}
pub fn next(e: &Env, key: &DataKey) -> Result<u32, Error> {
    let value = count(e, key).checked_add(1).ok_or(Error::Arithmetic)?;
    e.storage().instance().set(key, &value);
    Ok(value)
}
pub fn spent(e: &Env) -> Spent {
    let cfg = config(e);
    let ledger_period =
        u64::from(e.ledger().sequence().saturating_sub(cfg.start_ledger) / cfg.period_ledgers);
    let time_period = e.ledger().timestamp().saturating_sub(cfg.start_time) / cfg.period_seconds;
    let period = ledger_period.min(time_period);
    let key = DataKey::Period(period);
    let value = e.storage().persistent().get(&key).unwrap_or(Spent {
        period,
        amount_try: 0,
        amount_usdc: 0,
    });
    if e.storage().persistent().has(&key) {
        touch(e, &key);
    }
    value
}
pub fn add(a: i128, b: i128) -> Result<i128, Error> {
    a.checked_add(b).ok_or(Error::Arithmetic)
}
