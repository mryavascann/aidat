use soroban_sdk::{contracterror, contractevent, contracttype, Address, BytesN, String, Vec};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    InvalidSetup = 2,
    InvalidAmount = 3,
    InvalidSeat = 4,
    NotVoter = 5,
    InvalidText = 6,
    InvalidOwner = 7,
    NotFound = 8,
    NotPending = 9,
    MajorityRequired = 10,
    Timelocked = 11,
    AffectedSeat = 12,
    StaleRecovery = 13,
    InvalidMotion = 14,
    BudgetExceeded = 15,
    RecipientNotApproved = 16,
    InvalidQuote = 17,
    OrderReused = 18,
    QuoteExpired = 19,
    NotDisbursed = 20,
    InsufficientBalance = 21,
    Arithmetic = 22,
    InvalidVault = 23,
    VaultNotConfigured = 24,
    ActiveQuote = 25,
}

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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Budget {
    pub limit_try: i128,
    pub limit_usdc: i128,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Config {
    pub manager: Address,
    pub token: Address,
    pub bank: Address,
    pub name: String,
    pub dues_try: i128,
    pub seat_count: u32,
    pub vault: Option<Address>,
    pub budget: Budget,
    pub start_ledger: u32,
    pub start_time: u64,
    pub demo: bool,
    pub recovery_ledgers: u32,
    pub recovery_seconds: u64,
    pub objection_ledgers: u32,
    pub objection_seconds: u64,
    pub period_ledgers: u32,
    pub period_seconds: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Seat {
    pub id: u32,
    pub owner: Address,
    pub delegate: Option<Address>,
    pub version: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vote {
    pub seat: u32,
    pub version: u32,
    pub support: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recipient {
    pub id: BytesN<32>,
    pub label: String,
    pub enabled: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recovery {
    pub seat: u32,
    pub owner: Address,
    pub version: u32,
    pub buyer: Address,
    pub document: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MotionKind {
    Manager(Address),
    Budget(Budget),
    Recipient(Recipient),
    Recovery(Recovery),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum MotionStatus {
    Pending,
    Applied,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Motion {
    pub id: u32,
    pub kind: MotionKind,
    pub proposer: Address,
    pub status: MotionStatus,
    pub votes: Vec<Vote>,
    pub ready_ledger: u32,
    pub ready_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ExpenseStatus {
    Pending,
    Disbursed,
    Settled,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BankQuote {
    pub recipient: BytesN<32>,
    pub order: BytesN<32>,
    pub account: Address,
    pub amount_try: i128,
    pub amount_usdc: i128,
    pub expires_at: u32,
    pub expires_time: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
// Box is not a Soroban ABI type; keep the quote directly serializable.
#[allow(clippy::large_enum_variant)]
pub enum QuoteState {
    Missing,
    Prepared(BankQuote),
}
impl QuoteState {
    pub fn as_ref(&self) -> Option<&BankQuote> {
        match self {
            Self::Missing => None,
            Self::Prepared(value) => Some(value),
        }
    }
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Expense {
    pub id: u32,
    pub proposer: Address,
    pub recipient: BytesN<32>,
    pub amount_try: i128,
    pub max_usdc: i128,
    pub description: String,
    pub status: ExpenseStatus,
    pub routine: bool,
    pub budget_exception: bool,
    pub recipient_exception: bool,
    pub vetoed: bool,
    pub ready_ledger: u32,
    pub ready_time: u64,
    pub votes: Vec<Vote>,
    pub quote: QuoteState,
    pub bank_receipt: Option<BytesN<32>>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Spent {
    pub period: u64,
    pub amount_try: i128,
    pub amount_usdc: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Config,
    Seat(u32),
    Contribution(u32),
    MotionCount,
    Motion(u32),
    ExpenseCount,
    Expense(u32),
    Recipient(BytesN<32>),
    Recipients,
    Period(u64),
    Order(BytesN<32>),
}

#[contractevent]
pub struct SeatChanged {
    #[topic]
    pub seat: u32,
    pub owner: Address,
    pub version: u32,
}
#[contractevent]
pub struct DelegationChanged {
    #[topic]
    pub seat: u32,
    pub delegate: Option<Address>,
}
#[contractevent]
pub struct MotionCreated {
    #[topic]
    pub id: u32,
    pub proposer: Address,
}
#[contractevent]
pub struct VoteRecorded {
    #[topic]
    pub id: u32,
    pub seat: u32,
    pub support: bool,
    pub motion: bool,
}
#[contractevent]
pub struct MotionApplied {
    #[topic]
    pub id: u32,
}
#[contractevent]
pub struct RecoveryVetoed {
    #[topic]
    pub id: u32,
    pub owner: Address,
}
#[contractevent]
pub struct ContributionRecorded {
    #[topic]
    pub seat: u32,
    pub payer: Address,
    pub amount: i128,
}
#[contractevent]
pub struct ExpenseCreated {
    #[topic]
    pub id: u32,
    pub amount_try: i128,
    pub recipient: BytesN<32>,
    pub routine: bool,
}
#[contractevent]
pub struct ExpenseVetoed {
    #[topic]
    pub id: u32,
    pub seat: u32,
}
#[contractevent]
pub struct BankDisbursed {
    #[topic]
    pub id: u32,
    pub order: BytesN<32>,
    pub amount_usdc: i128,
}
#[contractevent]
pub struct BankSettled {
    #[topic]
    pub id: u32,
    pub receipt: BytesN<32>,
}
#[contractevent]
pub struct ExpenseCancelled {
    #[topic]
    pub id: u32,
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
