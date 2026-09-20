use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, BytesN, Env, String,
};

struct Fixture {
    env: Env,
    id: Address,
    owners: [Address; 3],
    bank: Address,
    token: Address,
}
impl Fixture {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| {
            l.sequence_number = 100;
            l.timestamp = 1_800_000_000;
        });
        let owners = [
            Address::generate(&env),
            Address::generate(&env),
            Address::generate(&env),
        ];
        let bank = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let id = env.register(
            Building,
            (Setup {
                manager: owners[0].clone(),
                token: token.clone(),
                bank: bank.clone(),
                name: String::from_str(&env, "Duly Building"),
                dues_try: 20_000,
                owners: vec![
                    &env,
                    owners[0].clone(),
                    owners[1].clone(),
                    owners[2].clone(),
                ],
                vault: None,
            },),
        );
        Self {
            env,
            id,
            owners,
            bank,
            token,
        }
    }
    fn c(&self) -> BuildingClient<'_> {
        BuildingClient::new(&self.env, &self.id)
    }
    fn hash(&self, n: u8) -> BytesN<32> {
        BytesN::from_array(&self.env, &[n; 32])
    }
    fn advance(&self, ledgers: u32, seconds: u64) {
        self.env.ledger().with_mut(|l| {
            l.sequence_number += ledgers;
            l.timestamp += seconds;
        });
    }
    fn vote_motion(&self, id: u32) {
        self.c().vote_motion(&1, &self.owners[0], &id, &true);
        self.c().vote_motion(&2, &self.owners[1], &id, &true);
    }
    fn fund(&self) {
        token::StellarAssetClient::new(&self.env, &self.token)
            .mint(&self.owners[0], &1_000_000_000);
        self.c().contribute(&self.owners[0], &1, &1_000_000_000);
    }
    fn budget_and_recipient(&self) {
        let budget = self.c().propose_motion(
            &self.owners[0],
            &MotionKind::Budget(Budget {
                limit_try: 2_000_000,
                limit_usdc: 500_000_000,
            }),
        );
        self.vote_motion(budget);
        self.c().apply_motion(&budget);
        let recipient = self.c().propose_motion(
            &self.owners[0],
            &MotionKind::Recipient(Recipient {
                id: self.hash(3),
                label: String::from_str(&self.env, "Cleaning"),
                enabled: true,
            }),
        );
        self.vote_motion(recipient);
        self.c().apply_motion(&recipient);
    }
    fn expense(&self, amount: i128) -> u32 {
        self.c().propose_expense(
            &self.hash(3),
            &amount,
            &100_000_000,
            &String::from_str(&self.env, "Cleaning invoice"),
        )
    }
    fn quote(&self, id: u32, amount: i128) {
        self.c().prepare_payment(
            &id,
            &BankQuote {
                recipient: self.hash(3),
                order: self.hash(id as u8 + 20),
                account: self.bank.clone(),
                amount_try: self.c().expense(&id).amount_try,
                amount_usdc: amount,
                expires_at: self.env.ledger().sequence() + 100,
                expires_time: self.env.ledger().timestamp() + 500,
            },
        );
    }
}

#[test]
fn fixed_seats_have_no_administrator_add_or_remove_path() {
    let f = Fixture::new();
    assert_eq!(f.c().config().seat_count, 3);
    assert_eq!(f.c().seat(&2).owner, f.owners[1]);
    assert_eq!(f.c().try_seat(&4), Err(Ok(Error::InvalidSeat)));
}

#[test]
fn seat_owner_transfers_without_manager_and_clears_delegation() {
    let f = Fixture::new();
    let buyer = Address::generate(&f.env);
    f.c().delegate(&2, &Some(f.owners[2].clone()));
    f.c().transfer_seat(&2, &buyer);
    assert_eq!(f.c().seat(&2).owner, buyer);
    assert_eq!(f.c().seat(&2).delegate, None);
    assert_eq!(f.c().config().seat_count, 3);
    f.env.mock_auths(&[]);
    assert!(f.c().try_transfer_seat(&2, &f.owners[0]).is_err());
}

#[test]
fn tenant_can_pay_for_a_seat_but_cannot_vote_without_delegation() {
    let f = Fixture::new();
    let tenant = Address::generate(&f.env);
    token::StellarAssetClient::new(&f.env, &f.token).mint(&tenant, &10_000_000);
    f.c().contribute(&tenant, &2, &10_000_000);
    assert_eq!(f.c().contribution(&2), 10_000_000);
    let id = f
        .c()
        .propose_motion(&f.owners[0], &MotionKind::Manager(f.owners[2].clone()));
    assert_eq!(
        f.c().try_vote_motion(&2, &tenant, &id, &true),
        Err(Ok(Error::NotVoter))
    );
    f.c().delegate(&2, &Some(tenant.clone()));
    f.c().vote_motion(&2, &tenant, &id, &true);
    f.c().vote_motion(&2, &f.owners[1], &id, &false);
    assert_eq!(f.c().motion_tally(&id), (0, 1));
}

#[test]
fn manager_changes_only_after_a_majority_of_fixed_seats() {
    let f = Fixture::new();
    let id = f
        .c()
        .propose_motion(&f.owners[1], &MotionKind::Manager(f.owners[2].clone()));
    f.c().vote_motion(&2, &f.owners[1], &id, &true);
    assert_eq!(
        f.c().try_apply_motion(&id),
        Err(Ok(Error::MajorityRequired))
    );
    f.c().vote_motion(&3, &f.owners[2], &id, &true);
    f.c().apply_motion(&id);
    assert_eq!(f.c().config().manager, f.owners[2]);
    assert_eq!(f.c().try_apply_motion(&id), Err(Ok(Error::NotPending)));
}

#[test]
fn old_votes_do_not_survive_seat_transfer_or_count_twice() {
    let f = Fixture::new();
    let id = f
        .c()
        .propose_motion(&f.owners[0], &MotionKind::Manager(f.owners[2].clone()));
    f.vote_motion(id);
    let buyer = Address::generate(&f.env);
    f.c().transfer_seat(&2, &buyer);
    assert_eq!(f.c().motion_tally(&id), (1, 0));
    assert_eq!(
        f.c().try_apply_motion(&id),
        Err(Ok(Error::MajorityRequired))
    );
    f.c().vote_motion(&2, &buyer, &id, &true);
    assert_eq!(f.c().motion_tally(&id), (2, 0));
}

#[test]
fn recovery_needs_other_seats_majority_and_both_seven_day_clocks() {
    let f = Fixture::new();
    let buyer = Address::generate(&f.env);
    let id = f.c().propose_recovery(&3, &buyer, &f.hash(7));
    assert_eq!(
        f.c().try_vote_motion(&3, &f.owners[2], &id, &true),
        Err(Ok(Error::AffectedSeat))
    );
    f.vote_motion(id);
    assert_eq!(f.c().try_apply_motion(&id), Err(Ok(Error::Timelocked)));
    f.advance(RECOVERY_LEDGERS, 0);
    assert_eq!(f.c().try_apply_motion(&id), Err(Ok(Error::Timelocked)));
    f.advance(0, RECOVERY_SECONDS);
    f.c().apply_motion(&id);
    assert_eq!(f.c().seat(&3).owner, buyer);
}

#[test]
fn existing_owner_can_veto_recovery_and_manager_cannot_skip_wait() {
    let f = Fixture::new();
    let id = f.c().propose_recovery(&3, &f.owners[1], &f.hash(8));
    f.vote_motion(id);
    f.c().veto_recovery(&id);
    f.advance(RECOVERY_LEDGERS, RECOVERY_SECONDS);
    assert_eq!(f.c().try_apply_motion(&id), Err(Ok(Error::NotPending)));
    assert_eq!(f.c().seat(&3).owner, f.owners[2]);
}

#[test]
fn new_recipient_and_unbudgeted_expense_wait_for_three_days_without_objection() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    assert!(f.c().expense(&id).recipient_exception);
    assert!(f.c().expense(&id).budget_exception);
    assert_eq!(f.c().try_execute_expense(&id), Err(Ok(Error::Timelocked)));
    f.advance(OBJECTION_LEDGERS, 0);
    assert_eq!(f.c().try_execute_expense(&id), Err(Ok(Error::Timelocked)));
    f.advance(0, OBJECTION_SECONDS);
    f.quote(id, 10_000_000);
    // Execution needs no new owner signature: a keeper can settle an already
    // authorized, immutable bank route after the objection window.
    f.env.mock_auths(&[]);
    f.c().execute_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
    assert_eq!(
        token::Client::new(&f.env, &f.token).balance(&f.bank),
        10_000_000
    );
    assert_eq!(f.c().try_execute_expense(&id), Err(Ok(Error::NotPending)));
}

#[test]
fn objection_to_new_recipient_stops_automatic_payment_until_majority() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.c().veto_expense(&3, &f.owners[2], &id);
    f.advance(OBJECTION_LEDGERS, OBJECTION_SECONDS);
    f.quote(id, 10_000_000);
    assert_eq!(
        f.c().try_execute_expense(&id),
        Err(Ok(Error::MajorityRequired))
    );
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    f.c().execute_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
}

#[test]
fn two_yes_votes_execute_immediately_even_when_the_third_seat_votes_no() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    f.c().vote_expense(&3, &f.owners[2], &id, &false);
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    assert_eq!(
        f.c().try_execute_expense(&id),
        Err(Ok(Error::MajorityRequired))
    );
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    assert_eq!(f.c().expense_tally(&id), (2, 1));
    f.c().execute_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
}

#[test]
fn cancellation_prevents_a_prepared_expense_from_moving_treasury_funds() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    let balance = f.c().balance();
    f.c().cancel_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Cancelled);
    assert_eq!(f.c().try_execute_expense(&id), Err(Ok(Error::NotPending)));
    assert_eq!(f.c().balance(), balance);
    assert_eq!(token::Client::new(&f.env, &f.token).balance(&f.bank), 0);
}

#[test]
fn a_disbursed_expense_cannot_be_described_as_cancelled() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    f.c().execute_expense(&id);
    assert_eq!(f.c().try_cancel_expense(&id), Err(Ok(Error::NotPending)));
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
}

#[test]
fn budget_period_advances_only_after_thirty_days_and_ledgers() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    f.quote(id, 10_000_000);
    f.c().execute_expense(&id);
    f.advance(PERIOD_LEDGERS, 0);
    assert_eq!(f.c().period_spent().amount_try, 20_000);
    f.advance(0, PERIOD_SECONDS);
    assert_eq!(f.c().period_spent().amount_try, 0);
    assert_eq!(f.c().period_spent().period, 1);
}

#[test]
fn approved_routine_payment_needs_no_extra_wait_but_an_existing_objection_forces_a_vote() {
    let f = Fixture::new();
    f.fund();
    f.budget_and_recipient();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    f.c().veto_expense(&2, &f.owners[1], &id);
    f.advance(OBJECTION_LEDGERS, OBJECTION_SECONDS);
    f.quote(id, 10_000_000);
    assert_eq!(
        f.c().try_execute_expense(&id),
        Err(Ok(Error::MajorityRequired))
    );
}

#[test]
fn manager_can_pay_an_approved_recipient_within_budget_immediately() {
    let f = Fixture::new();
    f.fund();
    f.budget_and_recipient();
    let id = f.expense(20_000);
    assert!(f.c().expense(&id).routine);
    f.quote(id, 10_000_000);
    f.c().execute_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
    assert_eq!(f.c().period_spent().amount_try, 20_000);
}

#[test]
fn budget_changes_do_not_reset_spending_and_unsigned_votes_are_rejected() {
    let f = Fixture::new();
    f.fund();
    f.budget_and_recipient();
    let id = f.expense(20_000);
    f.quote(id, 10_000_000);
    f.c().execute_expense(&id);
    let motion = f.c().propose_motion(
        &f.owners[0],
        &MotionKind::Budget(Budget {
            limit_try: 2_000_000,
            limit_usdc: 500_000_000,
        }),
    );
    f.vote_motion(motion);
    f.c().apply_motion(&motion);
    assert_eq!(f.c().period_spent().amount_try, 20_000);
    let motion = f
        .c()
        .propose_motion(&f.owners[0], &MotionKind::Manager(f.owners[2].clone()));
    f.env.mock_auths(&[]);
    assert!(f
        .c()
        .try_vote_motion(&1, &f.owners[0], &motion, &true)
        .is_err());
}

#[test]
fn manager_cannot_exceed_aggregate_budget_by_splitting_invoices() {
    let f = Fixture::new();
    f.fund();
    f.budget_and_recipient();
    let a = f.expense(1_100_000);
    let b = f.expense(1_100_000);
    f.advance(OBJECTION_LEDGERS, OBJECTION_SECONDS);
    f.quote(a, 100_000_000);
    f.c().execute_expense(&a);
    f.quote(b, 100_000_000);
    assert_eq!(
        f.c().try_execute_expense(&b),
        Err(Ok(Error::BudgetExceeded))
    );
    assert_eq!(f.c().period_spent().amount_try, 1_100_000);
}

#[test]
fn payment_cannot_change_iban_amount_or_reuse_bank_order() {
    let f = Fixture::new();
    let a = f.expense(20_000);
    let b = f.expense(20_000);
    let quote = BankQuote {
        recipient: f.hash(4),
        order: f.hash(22),
        account: f.bank.clone(),
        amount_try: 20_000,
        amount_usdc: 10_000_000,
        expires_at: 200,
        expires_time: f.env.ledger().timestamp() + 500,
    };
    assert_eq!(
        f.c().try_prepare_payment(&a, &quote),
        Err(Ok(Error::InvalidQuote))
    );
    let quote = BankQuote {
        recipient: f.hash(3),
        ..quote
    };
    f.c().prepare_payment(&a, &quote);
    assert_eq!(
        f.c().try_prepare_payment(&b, &quote),
        Err(Ok(Error::OrderReused))
    );
    f.env.mock_auths(&[]);
    assert!(f.c().try_prepare_payment(&a, &quote).is_err());
}

#[test]
fn bank_submission_is_not_misreported_as_settled_fiat() {
    let f = Fixture::new();
    f.fund();
    let id = f.expense(20_000);
    f.c().vote_expense(&1, &f.owners[0], &id, &true);
    f.c().vote_expense(&2, &f.owners[1], &id, &true);
    f.quote(id, 10_000_000);
    f.c().execute_expense(&id);
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Disbursed);
    f.c()
        .record_settlement(&id, &f.hash(id as u8 + 20), &f.hash(99));
    assert_eq!(f.c().expense(&id).status, ExpenseStatus::Settled);
}
