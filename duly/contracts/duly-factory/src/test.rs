use super::*;
use soroban_sdk::{testutils::Address as _, vec};

#[test]
fn factory_pins_code_and_bank_and_requires_the_new_managers_signature() {
    let e = Env::default();
    let cfg = FactoryConfig {
        wasm: BytesN::from_array(&e, &[1; 32]),
        demo_wasm: BytesN::from_array(&e, &[2; 32]),
        token: Address::generate(&e),
        bank: Address::generate(&e),
        vault: Address::generate(&e),
    };
    let id = e.register(Factory, (cfg.clone(),));
    let c = FactoryClient::new(&e, &id);
    assert_eq!(c.config(), cfg);
    let manager = Address::generate(&e);
    assert!(c
        .try_create(
            &manager,
            &vec![&e, manager.clone(), Address::generate(&e)],
            &String::from_str(&e, "Building"),
            &20_000,
            &BytesN::from_array(&e, &[4; 32]),
            &false
        )
        .is_err());
}
