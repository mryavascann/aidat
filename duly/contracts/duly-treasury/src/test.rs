use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger, MockAuth, MockAuthInvoke},
    token, vec, Address, Bytes, Env, IntoVal, String,
};

struct Fixture {
    env: Env,
    id: Address,
    admin: Address,
    member: Address,
    payee: Address,
    token: Address,
}

impl Fixture {
    fn new() -> Self {
        Self::create(false)
    }

    fn create(with_vault: bool) -> Self {
        let env = Env::default();
        env.mock_all_auths();
        env.ledger().with_mut(|l| l.sequence_number = 100);
        let admin = Address::generate(&env);
        let member = Address::generate(&env);
        let payee = Address::generate(&env);
        let token = env
            .register_stellar_asset_contract_v2(Address::generate(&env))
            .address();
        let vault = if with_vault {
            Some(env.register(test_vault::TestVault, (&token,)))
        } else {
            None::<Address>
        };
        let id = env.register(
            Treasury,
            (
                &admin,
                &token,
                String::from_str(&env, "Pera Building"),
                20_000_i128,
                2_u32,
                vault,
            ),
        );
        Self {
            env,
            id,
            admin,
            member,
            payee,
            token,
        }
    }

    fn client(&self) -> TreasuryClient<'_> {
        TreasuryClient::new(&self.env, &self.id)
    }

    fn fund(&self) {
        self.client().add_member(&self.member);
        token::StellarAssetClient::new(&self.env, &self.token).mint(&self.member, &100_000_000);
        self.client().contribute(&self.member, &100_000_000);
    }

    fn propose(&self, amount: i128) -> u32 {
        self.client().propose(
            &self.member,
            &self.payee,
            &amount,
            &String::from_str(&self.env, "Elevator maintenance"),
        )
    }

    fn code(&self) -> Bytes {
        Bytes::from_slice(&self.env, b"a-random-invite-with-32-characters")
    }
}

#[test]
fn constructor_initializes_views_and_rejects_reinitialization() {
    let f = Fixture::new();
    let c = f.client();
    assert_eq!(c.config().admin, f.admin);
    assert_eq!(c.config().token, f.token);
    assert_eq!(c.config().dues_try, 20_000);
    assert_eq!(c.config().quorum, 2);
    assert_eq!(c.members(), vec![&f.env, f.admin.clone()]);
    assert_eq!(c.balance(), 0);
    assert_eq!(c.contribution(&f.member), 0);
    assert_eq!(c.proposal_count(), 0);
    assert_eq!(
        c.try_init(
            &f.admin,
            &f.token,
            &String::from_str(&f.env, "Other"),
            &1,
            &2,
            &None
        ),
        Err(Ok(Error::AlreadyInitialized))
    );
}

#[test]
fn contributions_enter_the_configured_vault_and_keep_total_balance() {
    let f = Fixture::create(true);
    f.fund();
    assert_eq!(f.client().liquid_balance(), 0);
    assert_eq!(f.client().vault_balance(), 100_000_000);
    assert_eq!(f.client().balance(), 100_000_000);
    assert_eq!(f.client().contribution(&f.member), 100_000_000);
}

#[test]
fn expense_automatically_redeems_vault_shares_after_quorum() {
    let f = Fixture::create(true);
    f.fund();
    let id = f.propose(20_000_000);
    assert_eq!(f.client().try_execute(&id), Err(Ok(Error::QuorumNotMet)));
    assert_eq!(f.client().vault_balance(), 100_000_000);
    f.client().approve(&f.admin, &id);
    f.env.mock_auths(&[]);
    f.client().execute(&id);
    assert_eq!(f.client().vault_balance(), 80_000_000);
    assert_eq!(f.client().liquid_balance(), 0);
    assert_eq!(
        token::Client::new(&f.env, &f.token).balance(&f.payee),
        20_000_000
    );
}

#[test]
fn vault_management_requires_admin_and_returns_funds_only_to_treasury() {
    let f = Fixture::create(true);
    f.fund();
    f.env.mock_auths(&[]);
    assert!(f.client().try_divest(&10_000_000).is_err());
    f.client()
        .mock_auths(&[MockAuth {
            address: &f.admin,
            invoke: &MockAuthInvoke {
                contract: &f.id,
                fn_name: "divest",
                args: (10_000_000_i128,).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .divest(&10_000_000);
    assert_eq!(f.client().liquid_balance(), 10_000_000);
    assert_eq!(f.client().vault_balance(), 90_000_000);
    assert!(f.client().try_invest(&10_000_000).is_err());
    f.client()
        .mock_auths(&[MockAuth {
            address: &f.admin,
            invoke: &MockAuthInvoke {
                contract: &f.id,
                fn_name: "invest",
                args: (10_000_000_i128,).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .invest(&10_000_000);
    assert_eq!(f.client().liquid_balance(), 0);
    assert_eq!(f.client().balance(), 100_000_000);
}

#[test]
fn insufficient_vault_balance_preserves_votes_and_expense() {
    let f = Fixture::create(true);
    f.fund();
    let id = f.propose(100_000_001);
    f.client().approve(&f.admin, &id);
    assert_eq!(
        f.client().try_execute(&id),
        Err(Ok(Error::InsufficientBalance))
    );
    assert_eq!(f.client().proposal(&id).status, ProposalStatus::Pending);
    assert_eq!(f.client().vault_balance(), 100_000_000);
}

#[test]
fn vault_redemption_rounds_shares_up_to_cover_a_small_payment() {
    let f = Fixture::create(true);
    f.fund();
    let vault = f.client().config().vault.unwrap();
    token::StellarAssetClient::new(&f.env, &f.token).mint(&vault, &50_000_000);
    let id = f.propose(2);
    f.client().approve(&f.admin, &id);
    f.client().execute(&id);
    assert_eq!(token::Client::new(&f.env, &f.token).balance(&f.payee), 2);
    assert_eq!(f.client().balance(), 149_999_998);
}

#[test]
fn vault_deposit_authorizes_only_the_exact_nested_token_transfer() {
    let f = Fixture::create(true);
    token::StellarAssetClient::new(&f.env, &f.token).mint(&f.id, &10_000_000);
    f.env.mock_auths(&[]);
    f.client()
        .mock_auths(&[MockAuth {
            address: &f.admin,
            invoke: &MockAuthInvoke {
                contract: &f.id,
                fn_name: "invest",
                args: (10_000_000_i128,).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .invest(&10_000_000);
    assert_eq!(f.client().vault_balance(), 10_000_000);
}

// A deterministic ABI test double. Deployment and end-to-end proofs use the
// official DeFindex factory/vault, never this contract.
mod test_vault {
    use super::*;
    use soroban_sdk::{contract, contractimpl, symbol_short, Val, Vec};
    #[contract]
    pub struct TestVault;
    #[contractimpl]
    impl TestVault {
        pub fn __constructor(env: Env, token: Address) {
            env.storage()
                .instance()
                .set(&symbol_short!("token"), &token);
        }
        pub fn get_assets(env: Env) -> Vec<crate::vault::AssetStrategySet> {
            vec![
                &env,
                crate::vault::AssetStrategySet {
                    address: env
                        .storage()
                        .instance()
                        .get(&symbol_short!("token"))
                        .unwrap(),
                    strategies: Vec::new(&env),
                },
            ]
        }
        pub fn total_supply(env: Env) -> i128 {
            env.storage()
                .instance()
                .get(&symbol_short!("supply"))
                .unwrap_or(0)
        }
        pub fn balance(env: Env, from: Address) -> i128 {
            env.storage().persistent().get(&from).unwrap_or(0)
        }
        pub fn get_asset_amounts_per_shares(env: Env, shares: i128) -> Vec<i128> {
            let token: Address = env
                .storage()
                .instance()
                .get(&symbol_short!("token"))
                .unwrap();
            let supply = Self::total_supply(env.clone());
            vec![
                &env,
                if supply == 0 {
                    0
                } else {
                    token::Client::new(&env, &token).balance(&env.current_contract_address())
                        * shares
                        / supply
                },
            ]
        }
        pub fn deposit(
            env: Env,
            amounts: Vec<i128>,
            minimum: Vec<i128>,
            from: Address,
            _invest: bool,
        ) -> Val {
            from.require_auth();
            let amount = amounts.get(0).unwrap();
            assert!(amount >= minimum.get(0).unwrap());
            let token: Address = env
                .storage()
                .instance()
                .get(&symbol_short!("token"))
                .unwrap();
            let supply = Self::total_supply(env.clone());
            let held = token::Client::new(&env, &token).balance(&env.current_contract_address());
            let minted = if supply == 0 {
                amount
            } else {
                amount * supply / held
            };
            token::Client::new(&env, &token).transfer(
                &from,
                env.current_contract_address(),
                &amount,
            );
            env.storage()
                .persistent()
                .set(&from, &(Self::balance(env.clone(), from.clone()) + minted));
            env.storage()
                .instance()
                .set(&symbol_short!("supply"), &(supply + minted));
            (amounts, minted, Option::<Val>::None).into_val(&env)
        }
        pub fn withdraw(env: Env, shares: i128, minimum: Vec<i128>, from: Address) -> Vec<i128> {
            from.require_auth();
            let owned = Self::balance(env.clone(), from.clone());
            assert!(shares > 0 && owned >= shares);
            let amounts = Self::get_asset_amounts_per_shares(env.clone(), shares);
            assert!(amounts.get(0).unwrap() >= minimum.get(0).unwrap());
            let token: Address = env
                .storage()
                .instance()
                .get(&symbol_short!("token"))
                .unwrap();
            env.storage().persistent().set(&from, &(owned - shares));
            env.storage().instance().set(
                &symbol_short!("supply"),
                &(Self::total_supply(env.clone()) - shares),
            );
            token::Client::new(&env, &token).transfer(
                &env.current_contract_address(),
                &from,
                &amounts.get(0).unwrap(),
            );
            amounts
        }
    }
}

#[test]
fn member_addition_is_unique() {
    let f = Fixture::new();
    f.client().add_member(&f.member);
    assert_eq!(f.client().members().len(), 2);
    assert_eq!(
        f.client().try_add_member(&f.member),
        Err(Ok(Error::AlreadyMember))
    );
}

#[test]
fn adding_members_requires_the_admin_signature() {
    let f = Fixture::new();
    f.env.mock_auths(&[]);
    assert!(f.client().try_add_member(&f.member).is_err());
    assert_eq!(f.client().members().len(), 1);
    f.client()
        .mock_auths(&[MockAuth {
            address: &f.admin,
            invoke: &MockAuthInvoke {
                contract: &f.id,
                fn_name: "add_member",
                args: (&f.member,).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .add_member(&f.member);
    assert_eq!(f.client().members().len(), 2);
}

#[test]
fn dues_require_admin_auth_and_positive_amounts() {
    let f = Fixture::new();
    assert_eq!(f.client().try_set_dues(&0), Err(Ok(Error::InvalidAmount)));
    assert_eq!(f.client().try_set_dues(&-1), Err(Ok(Error::InvalidAmount)));
    f.client().set_dues(&30_000);
    assert_eq!(f.client().config().dues_try, 30_000);
    f.env.mock_auths(&[]);
    assert!(f.client().try_set_dues(&40_000).is_err());
    assert_eq!(f.client().config().dues_try, 30_000);
}

#[test]
fn invite_can_be_used_once_and_cannot_be_replayed() {
    let f = Fixture::new();
    let code = f.code();
    let hash = f.env.crypto().sha256(&code).to_bytes();
    f.client().create_invite(&hash, &1, &100);
    assert_eq!(f.client().invite_uses(&hash), 1);
    f.client().join(&f.member, &code);
    assert_eq!(f.client().invite_uses(&hash), 0);
    assert_eq!(f.client().members().len(), 2);
    assert_eq!(
        f.client().try_join(&f.payee, &code),
        Err(Ok(Error::InvalidInvite))
    );
    assert_eq!(
        f.client().try_create_invite(&hash, &1, &100),
        Err(Ok(Error::InviteExists))
    );
}

#[test]
fn multi_use_invite_does_not_lose_a_use_for_existing_members() {
    let f = Fixture::new();
    let code = f.code();
    let hash = f.env.crypto().sha256(&code).to_bytes();
    f.client().create_invite(&hash, &2, &100);
    assert_eq!(
        f.client().try_join(&f.admin, &code),
        Err(Ok(Error::AlreadyMember))
    );
    assert_eq!(f.client().invite_uses(&hash), 2);
    f.client().join(&f.member, &code);
    f.client().join(&f.payee, &code);
    assert_eq!(f.client().invite_uses(&hash), 0);
}

#[test]
fn invite_expires_even_before_network_minimum_temporary_ttl() {
    let f = Fixture::new();
    let code = f.code();
    let hash = f.env.crypto().sha256(&code).to_bytes();
    f.client().create_invite(&hash, &2, &5);
    f.env.ledger().with_mut(|l| l.sequence_number += 5);
    assert_eq!(f.client().invite_uses(&hash), 0);
    assert_eq!(
        f.client().try_join(&f.member, &code),
        Err(Ok(Error::InvalidInvite))
    );
}

#[test]
fn invites_reject_invalid_limits_and_require_auth() {
    let f = Fixture::new();
    let hash = f.env.crypto().sha256(&f.code()).to_bytes();
    assert_eq!(
        f.client().try_create_invite(&hash, &0, &100),
        Err(Ok(Error::InvalidInvite))
    );
    assert_eq!(
        f.client().try_create_invite(&hash, &1, &0),
        Err(Ok(Error::InvalidTtl))
    );
    assert_eq!(
        f.client().try_create_invite(&hash, &1, &u32::MAX),
        Err(Ok(Error::InvalidTtl))
    );
    f.env.mock_auths(&[]);
    assert!(f.client().try_create_invite(&hash, &1, &100).is_err());
}

#[test]
fn joining_requires_the_new_members_signature() {
    let f = Fixture::new();
    let code = f.code();
    let hash = f.env.crypto().sha256(&code).to_bytes();
    f.client().create_invite(&hash, &1, &100);
    f.env.mock_auths(&[]);
    assert!(f.client().try_join(&f.member, &code).is_err());
    assert_eq!(f.client().invite_uses(&hash), 1);
}

#[test]
fn contribution_moves_exact_tokens_and_accumulates() {
    let f = Fixture::new();
    f.fund();
    token::StellarAssetClient::new(&f.env, &f.token).mint(&f.member, &7);
    f.client().contribute(&f.member, &7);
    assert_eq!(f.client().balance(), 100_000_007);
    assert_eq!(f.client().contribution(&f.member), 100_000_007);
    assert_eq!(token::Client::new(&f.env, &f.token).balance(&f.member), 0);
}

#[test]
fn nonmembers_and_nonpositive_contributions_are_rejected() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_contribute(&f.member, &1),
        Err(Ok(Error::NotMember))
    );
    f.client().add_member(&f.member);
    assert_eq!(
        f.client().try_contribute(&f.member, &0),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        f.client().try_contribute(&f.member, &-10),
        Err(Ok(Error::InvalidAmount))
    );
}

#[test]
fn contribution_cannot_pull_funds_without_member_auth() {
    let f = Fixture::new();
    f.fund();
    token::StellarAssetClient::new(&f.env, &f.token).mint(&f.member, &10);
    f.env.mock_auths(&[]);
    assert!(f.client().try_contribute(&f.member, &10).is_err());
    assert_eq!(f.client().balance(), 100_000_000);
}

#[test]
fn failed_token_transfer_does_not_record_a_contribution() {
    let f = Fixture::new();
    f.client().add_member(&f.member);
    assert!(f.client().try_contribute(&f.member, &1).is_err());
    assert_eq!(f.client().contribution(&f.member), 0);
}

#[test]
fn expense_requires_quorum_and_can_execute_only_once() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(20_000_000);
    assert_eq!(id, 1);
    assert_eq!(f.client().proposal_count(), 1);
    assert_eq!(f.client().approvals(&id), vec![&f.env, f.member.clone()]);
    assert_eq!(f.client().try_execute(&id), Err(Ok(Error::QuorumNotMet)));
    assert_eq!(f.client().approve(&f.admin, &id), 2);
    // Anyone can relay an approved payout. The payee and amount are immutable.
    f.env.mock_auths(&[]);
    f.client().execute(&id);
    assert_eq!(f.client().proposal(&id).status, ProposalStatus::Executed);
    assert_eq!(f.client().balance(), 80_000_000);
    assert_eq!(
        token::Client::new(&f.env, &f.token).balance(&f.payee),
        20_000_000
    );
    assert_eq!(f.client().try_execute(&id), Err(Ok(Error::NotPending)));
}

#[test]
fn duplicate_approval_and_nonmember_votes_are_rejected() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    assert_eq!(
        f.client().try_approve(&f.member, &id),
        Err(Ok(Error::AlreadyApproved))
    );
    assert_eq!(
        f.client().try_approve(&f.payee, &id),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(f.client().approvals(&id).len(), 1);
}

#[test]
fn proposal_and_approval_require_the_named_members_signature() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    f.env.mock_auths(&[]);
    assert!(f
        .client()
        .try_propose(&f.member, &f.payee, &1, &String::from_str(&f.env, "Repair"))
        .is_err());
    assert!(f.client().try_approve(&f.admin, &id).is_err());
    assert_eq!(f.client().approvals(&id).len(), 1);
}

#[test]
fn invalid_expenses_and_unreachable_quorum_are_rejected() {
    let f = Fixture::new();
    let text = String::from_str(&f.env, "Repair");
    assert_eq!(
        f.client().try_propose(&f.admin, &f.payee, &1, &text),
        Err(Ok(Error::QuorumUnreachable))
    );
    f.fund();
    assert_eq!(
        f.client().try_propose(&f.payee, &f.admin, &1, &text),
        Err(Ok(Error::NotMember))
    );
    assert_eq!(
        f.client().try_propose(&f.member, &f.payee, &0, &text),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        f.client().try_propose(&f.member, &f.id, &1, &text),
        Err(Ok(Error::InvalidPayee))
    );
    assert_eq!(
        f.client()
            .try_propose(&f.member, &f.payee, &1, &String::from_str(&f.env, "")),
        Err(Ok(Error::InvalidText))
    );
}

#[test]
fn insufficient_balance_leaves_approved_expense_pending() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(100_000_001);
    f.client().approve(&f.admin, &id);
    assert_eq!(
        f.client().try_execute(&id),
        Err(Ok(Error::InsufficientBalance))
    );
    assert_eq!(f.client().proposal(&id).status, ProposalStatus::Pending);
    assert_eq!(f.client().balance(), 100_000_000);
}

#[test]
fn cancelled_expenses_cannot_be_approved_or_executed() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    f.client().cancel(&id);
    assert_eq!(f.client().proposal(&id).status, ProposalStatus::Cancelled);
    assert_eq!(
        f.client().try_approve(&f.admin, &id),
        Err(Ok(Error::NotPending))
    );
    assert_eq!(f.client().try_execute(&id), Err(Ok(Error::NotPending)));
    assert_eq!(f.client().try_cancel(&id), Err(Ok(Error::NotPending)));
}

#[test]
fn cancellation_requires_admin_auth() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    f.env.mock_auths(&[]);
    assert!(f.client().try_cancel(&id).is_err());
    assert_eq!(f.client().proposal(&id).status, ProposalStatus::Pending);
}

#[test]
fn missing_proposals_return_typed_errors() {
    let f = Fixture::new();
    assert_eq!(
        f.client().try_proposal(&99),
        Err(Ok(Error::ProposalNotFound))
    );
    assert_eq!(
        f.client().try_approvals(&99),
        Err(Ok(Error::ProposalNotFound))
    );
    assert_eq!(
        f.client().try_execute(&99),
        Err(Ok(Error::ProposalNotFound))
    );
}

#[test]
fn payout_intent_requires_executed_expense_and_payee_auth() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(20_000_000);
    assert_eq!(
        f.client().try_record_payout(&id, &123, &48_500_000, &5),
        Err(Ok(Error::NotExecuted))
    );
    f.client().approve(&f.admin, &id);
    f.client().execute(&id);
    f.env.mock_auths(&[]);
    assert!(f
        .client()
        .try_record_payout(&id, &123, &48_500_000, &5)
        .is_err());
    f.client()
        .mock_auths(&[MockAuth {
            address: &f.payee,
            invoke: &MockAuthInvoke {
                contract: &f.id,
                fn_name: "record_payout",
                args: (id, 123_u64, 48_500_000_i128, 5_u32).into_val(&f.env),
                sub_invokes: &[],
            },
        }])
        .record_payout(&id, &123, &48_500_000, &5);
    assert_eq!(f.client().payout_intent(&id).unwrap().anchor_memo, 123);
}

#[test]
fn payout_intent_expires_and_cannot_extend_itself_on_read() {
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    f.client().approve(&f.admin, &id);
    f.client().execute(&id);
    assert_eq!(
        f.client().try_record_payout(&id, &1, &0, &5),
        Err(Ok(Error::InvalidAmount))
    );
    assert_eq!(
        f.client().try_record_payout(&id, &1, &1, &0),
        Err(Ok(Error::InvalidTtl))
    );
    f.client().record_payout(&id, &1, &48_500_000, &5);
    assert_eq!(
        f.client().try_record_payout(&id, &2, &48_500_000, &5),
        Err(Ok(Error::PayoutActive))
    );
    f.env.ledger().with_mut(|l| l.sequence_number += 4);
    assert!(f.client().payout_intent(&id).is_some());
    f.env.ledger().with_mut(|l| l.sequence_number += 1);
    assert!(f.client().payout_intent(&id).is_none());
}

#[test]
fn historical_views_renew_persistent_storage() {
    use soroban_sdk::testutils::storage::Persistent;
    let f = Fixture::new();
    f.fund();
    let id = f.propose(1);
    let key = DataKey::Proposal(id);
    let before = f
        .env
        .as_contract(&f.id, || f.env.storage().persistent().get_ttl(&key));
    f.env
        .ledger()
        .with_mut(|l| l.sequence_number += before - 100);
    f.client().proposal(&id);
    let after = f
        .env
        .as_contract(&f.id, || f.env.storage().persistent().get_ttl(&key));
    assert!(after > 100);
    f.client().approvals(&id);
    f.client().contribution(&f.member);
    f.env.as_contract(&f.id, || {
        assert!(
            f.env
                .storage()
                .persistent()
                .get_ttl(&DataKey::Approvals(id))
                > 100
        );
        assert!(
            f.env
                .storage()
                .persistent()
                .get_ttl(&DataKey::Contribution(f.member.clone()))
                > 100
        );
    });
}
