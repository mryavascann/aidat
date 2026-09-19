//! DeFindex's single-asset vault interface. Only the configured treasury owns
//! the shares; redemptions always return to this contract before quorum payout.
use crate::{Config, Error, VaultDeposited, VaultRedeemed};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contractclient, contracttype, symbol_short, token, vec, Address, Env, IntoVal, String, Val,
    Vec,
};

#[contracttype]
#[derive(Clone)]
pub struct Strategy {
    pub address: Address,
    pub name: String,
    pub paused: bool,
}

#[contracttype]
#[derive(Clone)]
pub struct AssetStrategySet {
    pub address: Address,
    pub strategies: Vec<Strategy>,
}

#[contractclient(name = "VaultClient")]
#[allow(dead_code)]
pub trait Vault {
    fn get_assets(env: Env) -> Vec<AssetStrategySet>;
    fn balance(env: Env, from: Address) -> i128;
    fn get_asset_amounts_per_shares(env: Env, vault_shares: i128) -> Vec<i128>;
    fn deposit(
        env: Env,
        amounts_desired: Vec<i128>,
        amounts_min: Vec<i128>,
        from: Address,
        invest: bool,
    ) -> Val;
    fn withdraw(env: Env, df_amount: i128, min_amounts_out: Vec<i128>, from: Address) -> Vec<i128>;
}

pub fn validate(env: &Env, vault: &Address, token: &Address) -> Result<(), Error> {
    let assets = VaultClient::new(env, vault).get_assets();
    if assets.len() != 1 || assets.get(0).unwrap().address != *token {
        return Err(Error::InvalidVault);
    }
    Ok(())
}

pub fn balance(env: &Env, config: &Config) -> Result<i128, Error> {
    let Some(address) = &config.vault else {
        return Ok(0);
    };
    let client = VaultClient::new(env, address);
    let shares = client.balance(&env.current_contract_address());
    if shares == 0 {
        return Ok(0);
    }
    let amounts = client.get_asset_amounts_per_shares(&shares);
    amounts
        .get(0)
        .filter(|v| *v >= 0)
        .ok_or(Error::InvalidVault)
}

pub fn deposit(env: &Env, config: &Config, amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    let vault = config.vault.as_ref().ok_or(Error::VaultNotConfigured)?;
    let treasury = env.current_contract_address();
    if token::Client::new(env, &config.token).balance(&treasury) < amount {
        return Err(Error::InsufficientBalance);
    }
    let client = VaultClient::new(env, vault);
    let before = client.balance(&treasury);
    // Direct invocations are authorized automatically. The vault's deeper
    // token transfer receives a narrowly scoped authorization, never a blanket one.
    env.authorize_as_current_contract(vec![
        env,
        InvokerContractAuthEntry::Contract(SubContractInvocation {
            context: ContractContext {
                contract: config.token.clone(),
                fn_name: symbol_short!("transfer"),
                args: (&treasury, vault, amount).into_val(env),
            },
            sub_invocations: vec![env],
        }),
    ]);
    // No external yield strategy is active. The DeFindex vault holds liquid USDC.
    client.deposit(&vec![env, amount], &vec![env, amount], &treasury, &false);
    if client.balance(&treasury) <= before {
        return Err(Error::InvalidVault);
    }
    VaultDeposited { amount }.publish(env);
    Ok(())
}

pub fn withdraw(env: &Env, config: &Config, amount: i128) -> Result<(), Error> {
    if amount <= 0 {
        return Err(Error::InvalidAmount);
    }
    let vault = config.vault.as_ref().ok_or(Error::VaultNotConfigured)?;
    let treasury = env.current_contract_address();
    let client = VaultClient::new(env, vault);
    let underlying = balance(env, config)?;
    if underlying < amount {
        return Err(Error::InsufficientBalance);
    }
    let owned = client.balance(&treasury);
    // Round upward: truncating could redeem one stroop less than an approved bill.
    let numerator = amount.checked_mul(owned).ok_or(Error::Arithmetic)?;
    let shares = numerator
        .checked_div(underlying)
        .ok_or(Error::Arithmetic)?
        .checked_add(if numerator % underlying == 0 { 0 } else { 1 })
        .ok_or(Error::Arithmetic)?;
    let token = token::Client::new(env, &config.token);
    let before = token.balance(&treasury);
    client.withdraw(&shares, &vec![env, amount], &treasury);
    let received = token
        .balance(&treasury)
        .checked_sub(before)
        .ok_or(Error::Arithmetic)?;
    if received < amount {
        return Err(Error::InsufficientBalance);
    }
    VaultRedeemed {
        shares,
        amount: received,
    }
    .publish(env);
    Ok(())
}
