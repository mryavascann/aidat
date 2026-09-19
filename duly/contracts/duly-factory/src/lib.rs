#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, Address, BytesN, Env, String, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct FactoryConfig {
    pub wasm: BytesN<32>,
    pub demo_wasm: BytesN<32>,
    pub token: Address,
    pub bank: Address,
    pub vault: Address,
}
// Field names and types match the building constructor. No caller-selected
// bank, token or bytecode is accepted by this immutable factory.
#[contracttype]
#[derive(Clone)]
pub struct Setup {
    pub manager: Address,
    pub token: Address,
    pub bank: Address,
    pub name: String,
    pub dues_try: i128,
    pub owners: Vec<Address>,
    pub vault: Option<Address>,
}
#[contractevent]
pub struct BuildingCreated {
    #[topic]
    pub building: Address,
    pub manager: Address,
    pub demo: bool,
}

#[contract]
pub struct Factory;
#[contractimpl]
impl Factory {
    pub fn __constructor(e: Env, config: FactoryConfig) {
        e.storage().instance().set(&0u32, &config);
    }
    pub fn config(e: Env) -> FactoryConfig {
        let ttl = 535_680.min(e.storage().max_ttl());
        e.storage().instance().extend_ttl(17_280.min(ttl), ttl);
        e.storage().instance().get(&0u32).unwrap()
    }
    pub fn create(
        e: Env,
        manager: Address,
        owners: Vec<Address>,
        name: String,
        dues_try: i128,
        salt: BytesN<32>,
        demo: bool,
    ) -> Address {
        manager.require_auth();
        let cfg = Self::config(e.clone());
        let setup = Setup {
            manager: manager.clone(),
            owners,
            name,
            dues_try,
            token: cfg.token,
            bank: cfg.bank,
            vault: Some(cfg.vault),
        };
        // Include the authenticated manager so another caller cannot squat a salt.
        use soroban_sdk::xdr::ToXdr;
        let unique: BytesN<32> = e
            .crypto()
            .sha256(&(manager.clone(), salt).to_xdr(&e))
            .into();
        let building = e
            .deployer()
            .with_current_contract(unique)
            .deploy_v2(if demo { cfg.demo_wasm } else { cfg.wasm }, (setup,));
        BuildingCreated {
            building: building.clone(),
            manager,
            demo,
        }
        .publish(&e);
        building
    }
}
#[cfg(test)]
mod test;
