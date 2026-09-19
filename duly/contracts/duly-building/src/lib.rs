#![no_std]

mod storage;
mod types;
mod vault;
use soroban_sdk::{contract, contractimpl, token, Address, BytesN, Env, String, Vec};
use storage as db;
pub use types::*;

// Both boundaries must pass. Ledger speed can never shorten the elapsed minimum.
#[cfg(not(feature = "demo"))]
pub const RECOVERY_LEDGERS: u32 = 120_960;
#[cfg(not(feature = "demo"))]
pub const RECOVERY_SECONDS: u64 = 604_800;
#[cfg(not(feature = "demo"))]
pub const OBJECTION_LEDGERS: u32 = 51_840;
#[cfg(not(feature = "demo"))]
pub const OBJECTION_SECONDS: u64 = 259_200;
#[cfg(not(feature = "demo"))]
pub const PERIOD_LEDGERS: u32 = 518_400;
#[cfg(not(feature = "demo"))]
pub const PERIOD_SECONDS: u64 = 2_592_000;
#[cfg(feature = "demo")]
pub const RECOVERY_LEDGERS: u32 = 12;
#[cfg(feature = "demo")]
pub const RECOVERY_SECONDS: u64 = 60;
#[cfg(feature = "demo")]
pub const OBJECTION_LEDGERS: u32 = 4;
#[cfg(feature = "demo")]
pub const OBJECTION_SECONDS: u64 = 20;
#[cfg(feature = "demo")]
pub const PERIOD_LEDGERS: u32 = 120;
#[cfg(feature = "demo")]
pub const PERIOD_SECONDS: u64 = 600;

#[contract]
pub struct Building;

fn nonzero(e: &Env, hash: &BytesN<32>) -> bool {
    *hash != BytesN::from_array(e, &[0; 32])
}
fn pending_motion(e: &Env, id: u32) -> Result<Motion, Error> {
    let m = db::motion(e, id)?;
    if m.status != MotionStatus::Pending {
        return Err(Error::NotPending);
    }
    Ok(m)
}
fn pending_expense(e: &Env, id: u32) -> Result<Expense, Error> {
    let x = db::expense(e, id)?;
    if x.status != ExpenseStatus::Pending {
        return Err(Error::NotPending);
    }
    Ok(x)
}
fn excluded(m: &Motion) -> Option<u32> {
    match &m.kind {
        MotionKind::Recovery(r) => Some(r.seat),
        _ => None,
    }
}
fn threshold(e: &Env, m: &Motion) -> u32 {
    (db::config(e).seat_count - u32::from(excluded(m).is_some())) / 2 + 1
}
fn create_motion(e: &Env, actor: Address, kind: MotionKind) -> Result<u32, Error> {
    let id = db::next(e, &DataKey::MotionCount)?;
    db::save_motion(
        e,
        &Motion {
            id,
            kind,
            proposer: actor.clone(),
            status: MotionStatus::Pending,
            votes: Vec::new(e),
            ready_ledger: 0,
            ready_time: 0,
        },
    );
    MotionCreated {
        id,
        proposer: actor,
    }
    .publish(e);
    Ok(id)
}
fn update_owner(e: &Env, mut s: Seat, owner: Address) -> Result<(), Error> {
    if owner == s.owner || owner == e.current_contract_address() {
        return Err(Error::InvalidOwner);
    }
    s.owner = owner;
    s.delegate = None;
    s.version = s.version.checked_add(1).ok_or(Error::Arithmetic)?;
    db::save_seat(e, &s);
    SeatChanged {
        seat: s.id,
        owner: s.owner,
        version: s.version,
    }
    .publish(e);
    Ok(())
}
fn recipient_enabled(e: &Env, id: &BytesN<32>) -> bool {
    let key = DataKey::Recipient(id.clone());
    let value: Option<Recipient> = e.storage().persistent().get(&key);
    if value.is_some() {
        db::touch(e, &key);
    }
    value.map(|r| r.enabled).unwrap_or(false)
}
fn within_budget(e: &Env, amount_try: i128, amount_usdc: i128) -> Result<bool, Error> {
    let budget = db::config(e).budget;
    let spent = db::spent(e);
    Ok(db::add(spent.amount_try, amount_try)? <= budget.limit_try
        && db::add(spent.amount_usdc, amount_usdc)? <= budget.limit_usdc)
}

#[contractimpl]
impl Building {
    pub fn __constructor(e: Env, setup: Setup) -> Result<(), Error> {
        if e.storage().instance().has(&DataKey::Config) {
            return Err(Error::AlreadyInitialized);
        }
        setup.manager.require_auth();
        if setup.owners.len() < 2
            || setup.owners.len() > 128
            || setup.name.is_empty()
            || setup.name.len() > 80
            || setup.dues_try <= 0
        {
            return Err(Error::InvalidSetup);
        }
        if let Some(v) = &setup.vault {
            vault::validate(&e, v, &setup.token)?;
        }
        let config = Config {
            manager: setup.manager,
            token: setup.token,
            bank: setup.bank,
            name: setup.name,
            dues_try: setup.dues_try,
            seat_count: setup.owners.len(),
            vault: setup.vault,
            budget: Budget {
                limit_try: 0,
                limit_usdc: 0,
            },
            start_ledger: e.ledger().sequence(),
            start_time: e.ledger().timestamp(),
            demo: cfg!(feature = "demo"),
            recovery_ledgers: RECOVERY_LEDGERS,
            recovery_seconds: RECOVERY_SECONDS,
            objection_ledgers: OBJECTION_LEDGERS,
            objection_seconds: OBJECTION_SECONDS,
            period_ledgers: PERIOD_LEDGERS,
            period_seconds: PERIOD_SECONDS,
        };
        db::save_config(&e, &config);
        for (index, owner) in setup.owners.iter().enumerate() {
            if owner == e.current_contract_address() {
                return Err(Error::InvalidOwner);
            }
            let seat = Seat {
                id: index as u32 + 1,
                owner,
                delegate: None,
                version: 0,
            };
            db::save_seat(&e, &seat);
            SeatChanged {
                seat: seat.id,
                owner: seat.owner,
                version: 0,
            }
            .publish(&e);
        }
        Ok(())
    }
    pub fn config(e: Env) -> Config {
        db::config(&e)
    }
    pub fn seat(e: Env, id: u32) -> Result<Seat, Error> {
        db::seat(&e, id)
    }
    pub fn seats(e: Env) -> Result<Vec<Seat>, Error> {
        let mut values = Vec::new(&e);
        for id in 1..=db::config(&e).seat_count {
            values.push_back(db::seat(&e, id)?);
        }
        Ok(values)
    }
    pub fn transfer_seat(e: Env, id: u32, buyer: Address) -> Result<(), Error> {
        let seat = db::seat(&e, id)?;
        seat.owner.require_auth();
        update_owner(&e, seat, buyer)
    }
    pub fn delegate(e: Env, id: u32, delegate: Option<Address>) -> Result<(), Error> {
        let mut s = db::seat(&e, id)?;
        s.owner.require_auth();
        if delegate.as_ref() == Some(&e.current_contract_address()) {
            return Err(Error::InvalidOwner);
        }
        s.delegate = delegate.clone();
        s.version = s.version.checked_add(1).ok_or(Error::Arithmetic)?;
        db::save_seat(&e, &s);
        DelegationChanged { seat: id, delegate }.publish(&e);
        Ok(())
    }
    pub fn contribute(e: Env, payer: Address, seat: u32, amount: i128) -> Result<(), Error> {
        db::seat(&e, seat)?;
        payer.require_auth();
        if amount <= 0 {
            return Err(Error::InvalidAmount);
        }
        let cfg = db::config(&e);
        let key = DataKey::Contribution(seat);
        let previous: i128 = e.storage().persistent().get(&key).unwrap_or(0);
        let total = db::add(previous, amount)?;
        token::Client::new(&e, &cfg.token).transfer(&payer, e.current_contract_address(), &amount);
        if cfg.vault.is_some() {
            vault::deposit(&e, &cfg, amount)?;
        }
        e.storage().persistent().set(&key, &total);
        db::touch(&e, &key);
        ContributionRecorded {
            seat,
            payer,
            amount,
        }
        .publish(&e);
        Ok(())
    }
    pub fn contribution(e: Env, seat: u32) -> Result<i128, Error> {
        db::seat(&e, seat)?;
        let key = DataKey::Contribution(seat);
        let value = e.storage().persistent().get(&key).unwrap_or(0);
        if e.storage().persistent().has(&key) {
            db::touch(&e, &key);
        }
        Ok(value)
    }
    pub fn propose_motion(e: Env, actor: Address, kind: MotionKind) -> Result<u32, Error> {
        db::participant(&e, &actor)?;
        match &kind {
            MotionKind::Recovery(_) => return Err(Error::InvalidMotion),
            MotionKind::Budget(b)
                if b.limit_try < 0
                    || b.limit_usdc < 0
                    || (b.limit_try == 0) != (b.limit_usdc == 0) =>
            {
                return Err(Error::InvalidAmount)
            }
            MotionKind::Recipient(r)
                if !nonzero(&e, &r.id) || r.label.is_empty() || r.label.len() > 80 =>
            {
                return Err(Error::InvalidText)
            }
            MotionKind::Manager(a) if *a == e.current_contract_address() => {
                return Err(Error::InvalidOwner)
            }
            _ => (),
        }
        create_motion(&e, actor, kind)
    }
    pub fn propose_recovery(
        e: Env,
        seat: u32,
        buyer: Address,
        document: BytesN<32>,
    ) -> Result<u32, Error> {
        let cfg = db::config(&e);
        cfg.manager.require_auth();
        let s = db::seat(&e, seat)?;
        if buyer == s.owner || buyer == e.current_contract_address() || !nonzero(&e, &document) {
            return Err(Error::InvalidOwner);
        }
        create_motion(
            &e,
            cfg.manager,
            MotionKind::Recovery(Recovery {
                seat,
                owner: s.owner,
                version: s.version,
                buyer,
                document,
            }),
        )
    }
    pub fn vote_motion(
        e: Env,
        seat: u32,
        actor: Address,
        id: u32,
        support: bool,
    ) -> Result<(), Error> {
        let s = db::voter(&e, seat, &actor)?;
        let mut m = pending_motion(&e, id)?;
        if excluded(&m) == Some(seat) {
            return Err(Error::AffectedSeat);
        }
        let before = db::tally(&e, &m.votes, excluded(&m))?.0;
        db::cast(&e, &mut m.votes, &s, support);
        let (yes, no) = db::tally(&e, &m.votes, excluded(&m))?;
        let needed = threshold(&e, &m);
        if no >= needed {
            m.status = MotionStatus::Cancelled;
        }
        if excluded(&m).is_some() {
            if yes < needed {
                m.ready_ledger = 0;
                m.ready_time = 0;
            } else if before < needed {
                m.ready_ledger = e
                    .ledger()
                    .sequence()
                    .checked_add(RECOVERY_LEDGERS)
                    .ok_or(Error::Arithmetic)?;
                m.ready_time = e
                    .ledger()
                    .timestamp()
                    .checked_add(RECOVERY_SECONDS)
                    .ok_or(Error::Arithmetic)?;
            }
        }
        db::save_motion(&e, &m);
        VoteRecorded {
            id,
            seat,
            support,
            motion: true,
        }
        .publish(&e);
        Ok(())
    }
    pub fn veto_recovery(e: Env, id: u32) -> Result<(), Error> {
        let mut m = pending_motion(&e, id)?;
        let MotionKind::Recovery(r) = &m.kind else {
            return Err(Error::InvalidMotion);
        };
        let s = db::seat(&e, r.seat)?;
        if s.owner != r.owner || s.version != r.version {
            return Err(Error::StaleRecovery);
        }
        s.owner.require_auth();
        m.status = MotionStatus::Cancelled;
        db::save_motion(&e, &m);
        RecoveryVetoed { id, owner: s.owner }.publish(&e);
        Ok(())
    }
    pub fn apply_motion(e: Env, id: u32) -> Result<(), Error> {
        let mut m = pending_motion(&e, id)?;
        if db::tally(&e, &m.votes, excluded(&m))?.0 < threshold(&e, &m) {
            return Err(Error::MajorityRequired);
        }
        let mut cfg = db::config(&e);
        match &m.kind {
            MotionKind::Manager(a) => {
                cfg.manager = a.clone();
                db::save_config(&e, &cfg);
            }
            MotionKind::Budget(b) => {
                cfg.budget = b.clone();
                db::save_config(&e, &cfg);
            }
            MotionKind::Recipient(r) => {
                let key = DataKey::Recipient(r.id.clone());
                let mut ids: Vec<BytesN<32>> = e
                    .storage()
                    .persistent()
                    .get(&DataKey::Recipients)
                    .unwrap_or(Vec::new(&e));
                if !ids.contains(&r.id) {
                    if ids.len() >= 128 {
                        return Err(Error::InvalidSetup);
                    }
                    ids.push_back(r.id.clone());
                }
                e.storage().persistent().set(&DataKey::Recipients, &ids);
                db::touch(&e, &DataKey::Recipients);
                e.storage().persistent().set(&key, r);
                db::touch(&e, &key);
            }
            MotionKind::Recovery(r) => {
                let s = db::seat(&e, r.seat)?;
                if s.owner != r.owner || s.version != r.version {
                    return Err(Error::StaleRecovery);
                }
                if m.ready_ledger == 0
                    || e.ledger().sequence() < m.ready_ledger
                    || e.ledger().timestamp() < m.ready_time
                {
                    return Err(Error::Timelocked);
                }
                update_owner(&e, s, r.buyer.clone())?;
            }
        }
        m.status = MotionStatus::Applied;
        db::save_motion(&e, &m);
        MotionApplied { id }.publish(&e);
        Ok(())
    }
    pub fn motion(e: Env, id: u32) -> Result<Motion, Error> {
        db::motion(&e, id)
    }
    pub fn motion_tally(e: Env, id: u32) -> Result<(u32, u32), Error> {
        let m = db::motion(&e, id)?;
        db::tally(&e, &m.votes, excluded(&m))
    }
    pub fn motion_count(e: Env) -> u32 {
        db::count(&e, &DataKey::MotionCount)
    }
    pub fn recipients(e: Env) -> Vec<Recipient> {
        let ids: Vec<BytesN<32>> = e
            .storage()
            .persistent()
            .get(&DataKey::Recipients)
            .unwrap_or(Vec::new(&e));
        if e.storage().persistent().has(&DataKey::Recipients) {
            db::touch(&e, &DataKey::Recipients);
        }
        let mut result = Vec::new(&e);
        for id in ids.iter() {
            let key = DataKey::Recipient(id);
            let r = e.storage().persistent().get(&key).unwrap();
            db::touch(&e, &key);
            result.push_back(r);
        }
        result
    }
    pub fn propose_expense(
        e: Env,
        recipient: BytesN<32>,
        amount_try: i128,
        max_usdc: i128,
        description: String,
    ) -> Result<u32, Error> {
        let cfg = db::config(&e);
        cfg.manager.require_auth();
        if amount_try <= 0 || max_usdc <= 0 {
            return Err(Error::InvalidAmount);
        }
        if !nonzero(&e, &recipient) || description.is_empty() || description.len() > 512 {
            return Err(Error::InvalidText);
        }
        let id = db::next(&e, &DataKey::ExpenseCount)?;
        let recipient_exception = !recipient_enabled(&e, &recipient);
        let budget_exception = !within_budget(&e, amount_try, max_usdc)?;
        let routine = !recipient_exception && !budget_exception;
        db::save_expense(
            &e,
            &Expense {
                id,
                proposer: cfg.manager,
                recipient: recipient.clone(),
                amount_try,
                max_usdc,
                description,
                status: ExpenseStatus::Pending,
                routine,
                budget_exception,
                recipient_exception,
                vetoed: false,
                ready_ledger: e
                    .ledger()
                    .sequence()
                    .checked_add(if routine { 0 } else { OBJECTION_LEDGERS })
                    .ok_or(Error::Arithmetic)?,
                ready_time: e
                    .ledger()
                    .timestamp()
                    .checked_add(if routine { 0 } else { OBJECTION_SECONDS })
                    .ok_or(Error::Arithmetic)?,
                votes: Vec::new(&e),
                quote: QuoteState::Missing,
                bank_receipt: None,
            },
        );
        ExpenseCreated {
            id,
            amount_try,
            recipient,
            routine,
        }
        .publish(&e);
        Ok(id)
    }
    pub fn vote_expense(
        e: Env,
        seat: u32,
        actor: Address,
        id: u32,
        support: bool,
    ) -> Result<(), Error> {
        let s = db::voter(&e, seat, &actor)?;
        let mut x = pending_expense(&e, id)?;
        db::cast(&e, &mut x.votes, &s, support);
        if !support {
            x.vetoed = true;
        }
        if db::tally(&e, &x.votes, None)?.1 > db::config(&e).seat_count / 2 {
            x.status = ExpenseStatus::Cancelled;
        }
        db::save_expense(&e, &x);
        VoteRecorded {
            id,
            seat,
            support,
            motion: false,
        }
        .publish(&e);
        Ok(())
    }
    pub fn veto_expense(e: Env, seat: u32, actor: Address, id: u32) -> Result<(), Error> {
        db::voter(&e, seat, &actor)?;
        let mut x = pending_expense(&e, id)?;
        x.vetoed = true;
        db::save_expense(&e, &x);
        ExpenseVetoed { id, seat }.publish(&e);
        Ok(())
    }
    pub fn cancel_expense(e: Env, id: u32) -> Result<(), Error> {
        db::config(&e).manager.require_auth();
        let mut x = pending_expense(&e, id)?;
        x.status = ExpenseStatus::Cancelled;
        db::save_expense(&e, &x);
        ExpenseCancelled { id }.publish(&e);
        Ok(())
    }
    pub fn prepare_payment(e: Env, id: u32, quote: BankQuote) -> Result<(), Error> {
        let cfg = db::config(&e);
        cfg.bank.require_auth();
        let mut x = pending_expense(&e, id)?;
        if quote.recipient != x.recipient
            || quote.amount_try != x.amount_try
            || quote.amount_usdc <= 0
            || quote.amount_usdc > x.max_usdc
            || quote.account == e.current_contract_address()
            || quote.account == cfg.manager
            || !nonzero(&e, &quote.order)
        {
            return Err(Error::InvalidQuote);
        }
        if quote.expires_at <= e.ledger().sequence() || quote.expires_time <= e.ledger().timestamp()
        {
            return Err(Error::QuoteExpired);
        }
        if let Some(prior) = x.quote.as_ref() {
            if prior.order != quote.order
                && prior.expires_at > e.ledger().sequence()
                && prior.expires_time > e.ledger().timestamp()
            {
                return Err(Error::ActiveQuote);
            }
        }
        let key = DataKey::Order(quote.order.clone());
        let existing: Option<u32> = e.storage().persistent().get(&key);
        if existing.is_some() && existing != Some(id) {
            return Err(Error::OrderReused);
        }
        e.storage().persistent().set(&key, &id);
        db::touch(&e, &key);
        x.quote = QuoteState::Prepared(quote);
        db::save_expense(&e, &x);
        Ok(())
    }
    pub fn execute_expense(e: Env, id: u32) -> Result<(), Error> {
        let cfg = db::config(&e);
        // Anyone may relay execution; the manager's original proposal, fixed
        // bank quote, quorum/objection checks and amount ceilings are binding.
        let mut x = pending_expense(&e, id)?;
        let majority = db::tally(&e, &x.votes, None)?.0 > cfg.seat_count / 2;
        if !majority {
            if x.vetoed {
                return Err(Error::MajorityRequired);
            }
            if !x.recipient_exception && !recipient_enabled(&e, &x.recipient) {
                return Err(Error::RecipientNotApproved);
            }
            if e.ledger().sequence() < x.ready_ledger || e.ledger().timestamp() < x.ready_time {
                return Err(Error::Timelocked);
            }
        }
        let quote = x.quote.as_ref().cloned().ok_or(Error::InvalidQuote)?;
        if e.ledger().sequence() >= quote.expires_at || e.ledger().timestamp() >= quote.expires_time
        {
            return Err(Error::QuoteExpired);
        }
        // Exceptions must be announced when the proposal is created. Ordinary
        // invoices cannot silently bypass the aggregate budget by splitting.
        if !majority && !x.budget_exception && !within_budget(&e, x.amount_try, quote.amount_usdc)?
        {
            return Err(Error::BudgetExceeded);
        }
        let token = token::Client::new(&e, &cfg.token);
        let treasury = e.current_contract_address();
        let liquid = token.balance(&treasury);
        if liquid < quote.amount_usdc {
            vault::withdraw(
                &e,
                &cfg,
                quote
                    .amount_usdc
                    .checked_sub(liquid)
                    .ok_or(Error::Arithmetic)?,
            )?;
        }
        let mut spent = db::spent(&e);
        spent.amount_try = db::add(spent.amount_try, x.amount_try)?;
        spent.amount_usdc = db::add(spent.amount_usdc, quote.amount_usdc)?;
        let key = DataKey::Period(spent.period);
        e.storage().persistent().set(&key, &spent);
        db::touch(&e, &key);
        x.status = ExpenseStatus::Disbursed;
        db::save_expense(&e, &x);
        token.transfer(&treasury, &quote.account, &quote.amount_usdc);
        BankDisbursed {
            id,
            order: quote.order,
            amount_usdc: quote.amount_usdc,
        }
        .publish(&e);
        Ok(())
    }
    pub fn record_settlement(
        e: Env,
        id: u32,
        order: BytesN<32>,
        receipt: BytesN<32>,
    ) -> Result<(), Error> {
        db::config(&e).bank.require_auth();
        let mut x = db::expense(&e, id)?;
        if x.status != ExpenseStatus::Disbursed {
            return Err(Error::NotDisbursed);
        }
        if x.quote.as_ref().map(|q| q.order.clone()) != Some(order) || !nonzero(&e, &receipt) {
            return Err(Error::InvalidQuote);
        }
        x.status = ExpenseStatus::Settled;
        x.bank_receipt = Some(receipt.clone());
        db::save_expense(&e, &x);
        BankSettled { id, receipt }.publish(&e);
        Ok(())
    }
    pub fn expense(e: Env, id: u32) -> Result<Expense, Error> {
        db::expense(&e, id)
    }
    pub fn expense_tally(e: Env, id: u32) -> Result<(u32, u32), Error> {
        db::tally(&e, &db::expense(&e, id)?.votes, None)
    }
    pub fn expense_count(e: Env) -> u32 {
        db::count(&e, &DataKey::ExpenseCount)
    }
    pub fn period_spent(e: Env) -> Spent {
        db::spent(&e)
    }
    pub fn liquid_balance(e: Env) -> i128 {
        token::Client::new(&e, &db::config(&e).token).balance(&e.current_contract_address())
    }
    pub fn vault_balance(e: Env) -> Result<i128, Error> {
        vault::balance(&e, &db::config(&e))
    }
    pub fn balance(e: Env) -> Result<i128, Error> {
        db::add(Self::liquid_balance(e.clone()), Self::vault_balance(e)?)
    }
}

#[cfg(test)]
mod test;
