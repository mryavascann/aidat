use soroban_sdk::{contracterror, contractevent, contracttype, Address, BytesN, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidAmount = 3,
    InvalidQuorum = 4,
    NotMember = 5,
    AlreadyMember = 6,
    MemberLimit = 7,
    InvalidInvite = 8,
    InviteExists = 9,
    InvalidTtl = 10,
    InvalidText = 11,
    InvalidPayee = 12,
    QuorumUnreachable = 13,
    ProposalNotFound = 14,
    NotPending = 15,
    AlreadyApproved = 16,
    QuorumNotMet = 17,
    InsufficientBalance = 18,
    NotExecuted = 19,
    PayoutActive = 20,
    Arithmetic = 21,
    InvalidVault = 22,
    VaultNotConfigured = 23,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub admin: Address,
    pub token: Address,
    pub name: String,
    /// Monthly dues in TRY kurus. USDC amounts use seven decimal places.
    pub dues_try: i128,
    pub quorum: u32,
    pub vault: Option<Address>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Executed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Proposal {
    pub id: u32,
    pub proposer: Address,
    pub payee: Address,
    pub amount: i128,
    pub description: String,
    pub status: ProposalStatus,
    pub created_at: u32,
    pub executed_at: Option<u32>,
}

#[contracttype]
#[derive(Clone)]
pub struct Invite {
    pub uses: u32,
    pub expires_at: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PayoutIntent {
    pub anchor_memo: u64,
    /// TRY per USDC, scaled by 10^6. This is a payee declaration, not an oracle.
    pub rate: i128,
    pub expires_at: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Members,
    ProposalCount,
    Contribution(Address),
    Proposal(u32),
    Approvals(u32),
    Invite(BytesN<32>),
    Payout(u32),
}

#[contractevent]
pub struct ContributionRecorded {
    #[topic]
    pub member: Address,
    pub amount: i128,
}
#[contractevent]
pub struct ExpenseProposed {
    #[topic]
    pub id: u32,
    pub payee: Address,
    pub amount: i128,
}
#[contractevent]
pub struct ExpenseApproved {
    #[topic]
    pub id: u32,
    pub member: Address,
    pub count: u32,
}
#[contractevent]
pub struct ExpenseExecuted {
    #[topic]
    pub id: u32,
    pub payee: Address,
    pub amount: i128,
}
#[contractevent]
pub struct ExpenseCancelled {
    #[topic]
    pub id: u32,
}
#[contractevent]
pub struct MemberAdded {
    #[topic]
    pub member: Address,
}

#[contractevent]
pub struct VaultDeposited {
    pub amount: i128,
}

#[contractevent]
pub struct VaultRedeemed {
    pub shares: i128,
    pub amount: i128,
}
