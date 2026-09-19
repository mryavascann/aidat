import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Copy,
  ExternalLink,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  X,
  ReceiptText,
  Globe2,
} from "lucide-react";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import QRCode from "qrcode";
import deployment from "./deployment.json";
import { en, type Messages } from "./i18n/en";
import { tr } from "./i18n/tr";
import { Dialog } from "./components/Dialog";
import { ThemeToggle } from "./components/ThemeToggle";
import { BankForm } from "./features/banking/BankForm";
import { PaymentHistory } from "./features/banking/PaymentHistory";
import { bankHistory } from "./features/banking/model";
import { NextActionCard } from "./features/overview/NextActionCard";
import { CommunityJourney } from "./features/overview/CommunityJourney";
import { BalanceScene } from "./features/overview/BalanceScene";
import {
  activity,
  addr,
  call,
  contractUrl,
  num,
  rates,
  short,
  snapshot,
  str,
  txUrl,
  u32,
  walletBalance,
  type Activity,
  type Proposal,
  type Snapshot,
} from "./lib/chain";
import {
  bankFlow,
  checkBank,
  createDemo,
  createInvite,
  finishBank,
  fromUnits,
  getDemo,
  join,
  startBank,
  toUnits,
  type BankFlow,
  type Role,
} from "./lib/flows";
import { exclusive, load, save } from "./lib/storage";
import { connectWallet, localSigner, type Signer } from "./lib/wallet";

type Page = "overview" | "expenses" | "banking" | "members";
type Modal =
  | "demo"
  | "deposit"
  | "withdraw"
  | "expense"
  | "invite"
  | "proofs"
  | "wallet"
  | null;
const nav = [
  { page: "overview", icon: LayoutDashboard },
  { page: "expenses", icon: ReceiptText },
  { page: "banking", icon: Landmark },
  { page: "members", icon: Users },
] as const;
const params = new URLSearchParams(location.search);
const requestedTreasury = params.get("treasury");
const publicTreasury =
  requestedTreasury && StrKey.isValidContract(requestedTreasury)
    ? requestedTreasury
    : deployment.treasury;
const inviteCode = params.get("invite");
const initialExpense = { description: "", amount: "2", recipient: "" };

function ErrorBox({
  error,
  t,
  onClose,
}: {
  error: string;
  t: Messages;
  onClose: () => void;
}) {
  if (!error) return null;
  const code = error.match(/Error\(Contract, #(\d+)\)/)?.[1];
  const mapped: Record<string, string> = {
    "3": t.invalidAmount,
    "5": t.nonmemberError,
    "8": t.invalidInvite,
    "16": t.duplicateError,
    "17": t.quorumError,
    "18": t.insufficient,
  };
  return (
    <div className="error-box" role="alert">
      <div>
        <strong>{mapped[code ?? ""] ?? t.errorTitle}</strong>
        <p>{t.errorHint}</p>
        <details>
          <summary>{t.details}</summary>
          <p className="technical">{error}</p>
        </details>
      </div>
      <button className="icon-button" onClick={onClose} aria-label={t.close}>
        <X size={16} />
      </button>
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<"tr" | "en">(() => load("language", "tr"));
  const t = lang === "tr" ? tr : en;
  const locale = lang === "tr" ? "tr-TR" : "en-GB";
  const [page, setPage] = useState<Page>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [demo, setDemo] = useState(getDemo);
  const [demoActive, setDemoActive] = useState(
    () => !requestedTreasury && load<boolean>("demo-active", false),
  );
  const [role, setRole] = useState<Role>("resident");
  const [external, setExternal] = useState<Signer | null>(null);
  const treasury =
    demoActive && demo?.treasury ? demo.treasury : publicTreasury;
  const signer =
    external ??
    (demoActive && demo?.ready ? localSigner(demo.secrets[role]) : null);
  const account = signer?.publicKey() ?? "";
  const [data, setData] = useState<Snapshot | null>(null);
  const [events, setEvents] = useState<Activity[]>([]);
  const [eventsError, setEventsError] = useState(false);
  const [rate, setRate] = useState<Awaited<ReturnType<typeof rates>> | null>(
    null,
  );
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [updated, setUpdated] = useState<Date | null>(null);
  const [flow, setFlow] = useState<BankFlow | null>(null);
  const [amount, setAmount] = useState("200");
  const [expense, setExpense] = useState(initialExpense);
  const [invite, setInvite] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const refreshNumber = useRef(0);
  const performing = useRef(false);
  const isMember = !!account && !!data?.members.includes(account);
  const isAdmin = !!account && account === data?.config.admin;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(n);
  const usdc = (n: bigint) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 7 }).format(
      Number(n) / 1e7,
    );
  const tryValue = (n: bigint) =>
    rate ? money((Number(n) / 1e7) * rate.sell) : `${usdc(n)} USDC`;
  const who = (address: string) => {
    if (demoActive && demo) {
      for (const r of ["admin", "resident", "payee"] as const)
        if (Keypair.fromSecret(demo.secrets[r]).publicKey() === address)
          return t[r];
    }
    const known = Object.entries(deployment.accounts).find(
      ([, value]) => value === address,
    )?.[0];
    if (known) return t[known === "member" ? "resident" : (known as Role)];
    return short(address);
  };
  const pending = data?.proposals.filter((p) => p.status === "Pending") ?? [];
  const paid = data?.proposals.filter((p) => p.status === "Executed") ?? [];
  const contributionTotal = Object.values(data?.contributions ?? {}).reduce(
    (a, b) => a + b,
    0n,
  );
  const paidTotal = paid.reduce((a, b) => a + b.amount, 0n);
  const history = bankHistory(account, treasury);

  useEffect(() => {
    document.documentElement.lang = lang;
    save("language", lang);
  }, [lang]);
  useEffect(() => {
    save("demo-active", demoActive);
  }, [demoActive]);
  const refresh = useCallback(async () => {
    const request = ++refreshNumber.current;
    try {
      const next = await snapshot(treasury);
      if (request !== refreshNumber.current) return;
      setData(next);
      setUpdated(new Date());
      setLoading(false);
      const [history, fx, wallet] = await Promise.allSettled([
        activity(treasury, next.ledger),
        rates(),
        account ? walletBalance(account) : Promise.resolve("0"),
      ]);
      if (request !== refreshNumber.current) return;
      setEvents(history.status === "fulfilled" ? history.value : []);
      setEventsError(history.status === "rejected");
      setRate(fx.status === "fulfilled" ? fx.value : null);
      setBalance(wallet.status === "fulfilled" ? wallet.value : null);
    } catch (e) {
      if (request === refreshNumber.current) {
        setError(String(e));
        setLoading(false);
      }
    }
  }, [treasury, account]);
  useEffect(() => {
    setData(null);
    setEvents([]);
    setBalance(null);
    setRate(null);
    setLoading(true);
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => {
      clearInterval(timer);
      refreshNumber.current++;
    };
  }, [refresh]);
  const progress = (step: string) =>
    setBusy(
      step.startsWith("fund:")
        ? t.setupFund
        : ({
            create: t.setupCreate,
            members: t.setupMembers,
            bank: t.waitingBank,
            vault: t.waitingVault,
            payment: t.waitingPayment,
          }[step] ?? t.working),
    );
  async function run(task: () => Promise<void>) {
    if (performing.current) return;
    performing.current = true;
    setBusy(t.working);
    setError("");
    setSuccess("");
    try {
      await exclusive(task);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      performing.current = false;
      setBusy("");
    }
  }
  function openBank(kind: "deposit" | "withdraw") {
    if (!signer) {
      setModal("wallet");
      return;
    }
    const saved = bankFlow(account, treasury, kind);
    setFlow(saved);
    setAmount(
      saved && !saved.complete
        ? saved.amount
        : kind === "deposit"
          ? fromUnits(data?.config.dues_try ?? 20000n, 2)
          : "2",
    );
    setError("");
    setModal(kind);
  }
  function openPayment(payment: BankFlow) {
    setFlow(payment);
    setAmount(payment.amount);
    setError("");
    setModal(payment.kind);
  }
  function openExpense() {
    if (!signer) {
      setModal("wallet");
      return;
    }
    const saved = load<any>(`expense:${treasury}:${account}`, null);
    setExpense(
      saved?.fields ?? {
        ...initialExpense,
        recipient:
          demoActive && demo
            ? Keypair.fromSecret(demo.secrets.payee).publicKey()
            : "",
      },
    );
    setError("");
    setModal("expense");
  }
  const onQuote = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!signer || (modal !== "deposit" && modal !== "withdraw")) return;
      setFlow(await startBank(signer, treasury, modal, amount));
    });
  };
  const onFinishBank = () =>
    void run(async () => {
      if (!signer || !flow) return;
      setFlow(await finishBank(signer, { ...flow }, progress, setFlow));
      setSuccess(t.complete);
    });
  const onCheckBank = () =>
    void run(async () => {
      if (!signer || !flow) return;
      setFlow(await checkBank(signer, flow));
    });
  const onExpense = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (!signer || !isMember) throw new Error(t.nonmemberError);
      if (!StrKey.isValidEd25519PublicKey(expense.recipient))
        throw new Error(t.recipientHint);
      if (toUnits(expense.amount) <= 0n || !expense.description.trim())
        throw new Error(t.invalidAmount);
      const key = `expense:${treasury}:${account}`;
      let draft = load<any>(key, null);
      if (draft && JSON.stringify(draft.fields) !== JSON.stringify(expense)) {
        if (load(`tx:${account}:propose:${draft.id}`, null))
          throw new Error(
            "Resume the signed expense with its original details.",
          );
        draft = null; // A cancelled signature or failed simulation has not sent a transaction.
      }
      if (!draft) {
        draft = { id: crypto.randomUUID(), fields: expense };
        save(key, draft);
      }
      await call(
        signer,
        treasury,
        "propose",
        [
          addr(account),
          addr(expense.recipient),
          num(toUnits(expense.amount)),
          str(expense.description.trim()),
        ],
        `propose:${draft.id}`,
      );
      save(key, null);
      setModal(null);
      setPage("expenses");
      setSuccess(t.saved);
    });
  };
  const onProposal = (p: Proposal, action: "approve" | "execute" | "cancel") =>
    void run(async () => {
      if (!signer) return;
      await call(
        signer,
        treasury,
        action,
        action === "approve" ? [addr(account), u32(p.id)] : [u32(p.id)],
        `${treasury}:${action}:${p.id}`,
      );
      setSuccess(t.saved);
    });
  const onInvite = () =>
    void run(async () => {
      if (!signer || !isAdmin) return;
      const link = await createInvite(signer, treasury);
      setInvite(link);
      setQr(
        await QRCode.toDataURL(link, {
          width: 224,
          margin: 1,
          color: { dark: "#192e2b", light: "#ffffff" },
        }),
      );
      setModal("invite");
    });
  function ExpenseRows({ proposals }: { proposals: Proposal[] }) {
    return proposals.length ? (
      <div className="expense-list">
        {proposals.map((p) => (
          <article className="expense-row" key={p.id}>
            <div
              className={`expense-icon ${p.status === "Executed" ? "paid" : ""}`}
            >
              {p.status === "Executed" ? (
                <CheckCheck size={21} />
              ) : (
                <Wrench size={21} />
              )}
            </div>
            <div className="expense-main">
              <div className="row-title">
                <h3>{p.description}</h3>
                <span className={`status ${p.status.toLowerCase()}`}>
                  {p.status === "Executed"
                    ? t.executed
                    : p.status === "Cancelled"
                      ? t.cancelled
                      : t.pending}
                </span>
              </div>
              <p>
                {who(p.payee)} <span>· #{p.id}</span>
              </p>
              <div className="votes">
                <div className="vote-dots">
                  {Array.from({ length: data?.config.quorum ?? 2 }, (_, i) => (
                    <span
                      className={i < p.approvals.length ? "filled" : ""}
                      key={i}
                    >
                      {i < p.approvals.length ? <Check size={10} /> : ""}
                    </span>
                  ))}
                </div>
                <span>
                  {p.approvals.length}/{data?.config.quorum} {t.approval}
                </span>
              </div>
              {p.status === "Pending" && signer && (
                <div className="expense-actions">
                  {isMember && (
                    <button
                      className="button small secondary"
                      disabled={!!busy || p.approvals.includes(account)}
                      onClick={() => onProposal(p, "approve")}
                    >
                      {p.approvals.includes(account) ? t.approved : t.approve}
                    </button>
                  )}
                  {p.approvals.length >= (data?.config.quorum ?? 2) && (
                    <button
                      className="button small"
                      disabled={!!busy}
                      onClick={() => onProposal(p, "execute")}
                    >
                      {t.execute}
                      <ArrowUpRight size={14} />
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      className="text-button muted"
                      disabled={!!busy}
                      onClick={() => onProposal(p, "cancel")}
                    >
                      {t.cancelExpense}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="expense-amount">
              <strong>{tryValue(p.amount)}</strong>
              <small>{usdc(p.amount)} USDC</small>
            </div>
          </article>
        ))}
      </div>
    ) : (
      <div className="empty">
        <div className="empty-icon">
          <ReceiptText size={26} />
        </div>
        <h3>{t.noExpenses}</h3>
        <p>{t.noExpensesBody}</p>
        <button
          className="button secondary"
          onClick={openExpense}
          disabled={!!busy || (!!signer && !isMember)}
        >
          <Plus size={16} />
          {t.newExpense}
        </button>
      </div>
    );
  }
  const modalTitle = modal
    ? {
        demo: t.demoTitle,
        deposit: t.depositTitle,
        withdraw: t.withdrawTitle,
        expense: t.newExpense,
        invite: t.inviteTitle,
        proofs: t.proofs,
        wallet: t.connect,
      }[modal]
    : "";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t.skipToContent}
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Duly">
          <img src="/duly.svg" alt="" />
          <span>
            duly<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="brand-tagline">{t.tagline}</p>
        <div className="nav-label">{t.community}</div>
        <nav aria-label={t.community}>
          {nav.map(({ page: p, icon: Icon }) => (
            <button
              key={p}
              className={`nav-item ${page === p ? "active" : ""}`}
              aria-current={page === p ? "page" : undefined}
              onClick={() => setPage(p)}
            >
              <Icon size={20} />
              <span>{t[p]}</span>
              {p === "expenses" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-card">
            <span className="network-dot" />
            <div>
              <strong>Stellar testnet</strong>
              <small>{t.sandbox}</small>
            </div>
            <ShieldCheck size={18} />
          </div>
          <button className="sidebar-proof" onClick={() => setModal("proofs")}>
            <CircleHelp size={17} />
            {t.proofs}
            <ArrowUpRight size={15} />
          </button>
          <span className="sidebar-copyright">Duly © 2026</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="community-name">
            <div className="community-avatar">
              <Users size={19} />
            </div>
            <div>
              <strong>{data?.config.name ?? "Duly"}</strong>
              <small>{demoActive ? t.personalDemo : t.publicDemo}</small>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle t={t} />
            <div className="language-switch" aria-label={t.language}>
              {(["tr", "en"] as const).map((l) => (
                <button
                  key={l}
                  aria-pressed={lang === l}
                  disabled={!!busy}
                  onClick={() => setLang(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className={`button wallet-button ${signer ? "secondary" : ""}`}
              aria-label={
                signer ? `${t.connected}: ${who(account)}` : t.connect
              }
              disabled={!!busy}
              onClick={() => setModal("wallet")}
            >
              <Wallet size={17} />
              <span>{signer ? who(account) : t.connect}</span>
              {signer && <span className="connected-dot" />}
            </button>
          </div>
        </header>
        <div className="sandbox-bar">
          <FlaskIcon />
          <strong>{t.sandbox}</strong>
          <span>{t.sandboxDetail}</span>
        </div>
        {demoActive && demo?.ready && (
          <div className="demo-toolbar">
            <span>
              <Sparkles size={15} />
              {t.demoSession}
            </span>
            <div className="role-switch" aria-label={t.signedBy}>
              {(["resident", "admin", "payee"] as const).map((r) => (
                <button
                  key={r}
                  aria-pressed={role === r && !external}
                  disabled={!!busy}
                  onClick={() => {
                    setRole(r);
                    setExternal(null);
                    setModal(null);
                    setError("");
                  }}
                >
                  {t[r]}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => {
                setDemoActive(false);
                setExternal(null);
              }}
            >
              {t.exitDemo}
              <ArrowUpRight size={13} />
            </button>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">DULY / {t[page]}</div>
              <h1>
                {page === "overview"
                  ? t.hello
                  : page === "expenses"
                    ? t.expenseTitle
                    : page === "banking"
                      ? t.bankingTitle
                      : t.membersTitle}
              </h1>
              <p>
                {page === "overview"
                  ? t.intro
                  : page === "expenses"
                    ? t.expenseSub
                    : page === "banking"
                      ? t.bankingIntro
                      : t.membersIntro}
              </p>
            </div>
            <div className="heading-actions">
              {page === "members" ? (
                isAdmin && (
                  <button
                    className="button"
                    disabled={!!busy}
                    onClick={onInvite}
                  >
                    <Plus size={18} />
                    {t.invite}
                  </button>
                )
              ) : (
                <>
                  <button
                    className="button secondary"
                    disabled={!!busy || (!!signer && !isMember)}
                    onClick={openExpense}
                  >
                    <Plus size={17} />
                    {t.newExpense}
                  </button>
                  <button
                    className="button"
                    disabled={!!busy || (!!signer && !isMember)}
                    onClick={() => openBank("deposit")}
                  >
                    <ArrowDownLeft size={18} />
                    {t.contribute}
                  </button>
                </>
              )}
            </div>
          </div>
          {!modal && (
            <ErrorBox error={error} t={t} onClose={() => setError("")} />
          )}
          {busy && (
            <div className="progress-bar" role="status">
              <LoaderCircle size={17} className="spin" />
              {busy}
            </div>
          )}
          {success && !modal && (
            <div className="success-bar" role="status">
              <CheckCheck size={17} />
              {success}
              <button
                className="icon-button"
                onClick={() => setSuccess("")}
                aria-label={t.close}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {inviteCode && (
            <div className="invite-banner">
              <Users size={23} />
              <div>
                <strong>{t.inviteConnect}</strong>
                <p>{t.joinBody}</p>
              </div>
              <button
                className="button"
                disabled={!!busy || isMember}
                onClick={() =>
                  signer
                    ? void run(async () => {
                        await join(signer, treasury, inviteCode);
                        setSuccess(t.saved);
                      })
                    : setModal("wallet")
                }
              >
                {isMember ? t.connected : t.join}
              </button>
            </div>
          )}
          {loading && !data ? (
            <div className="loading-card" role="status">
              <LoaderCircle className="spin" size={26} />
              <p>{t.loading}</p>
              <div className="skeleton-grid">
                <div />
                <div />
                <div />
              </div>
            </div>
          ) : !data ? (
            <div className="empty card">
              <p>{t.errorTitle}</p>
              <button className="button" onClick={() => void refresh()}>
                {t.retry}
              </button>
            </div>
          ) : (
            <>
              {page === "overview" && (
                <>
                  <div className="hero-grid">
                    <section className="balance-card">
                      <BalanceScene />
                      <div className="balance-top">
                        <span>
                          <span className="tiny-logo">d.</span>
                          {t.treasury}
                        </span>
                        <span className="live-pill">
                          <i />
                          {t.live}
                        </span>
                      </div>
                      <div className="balance-value">
                        {tryValue(data.total)}
                      </div>
                      <div className="balance-sub">
                        <strong>{usdc(data.total)} USDC</strong>
                        <span>{rate ? t.estimate : t.unavailableRate}</span>
                      </div>
                      <div className="balance-footer">
                        <div>
                          <span>{t.inReserve}</span>
                          <strong>
                            {usdc(data.vaulted)} <small>USDC</small>
                          </strong>
                        </div>
                        <div>
                          <span>{t.available}</span>
                          <strong>
                            {usdc(data.liquid)} <small>USDC</small>
                          </strong>
                        </div>
                        <div>
                          <span>{t.people}</span>
                          <strong>
                            {data.members.length.toString().padStart(2, "0")}
                            <Users size={16} />
                          </strong>
                        </div>
                      </div>
                    </section>
                    <NextActionCard
                      t={t}
                      connected={!!signer}
                      isMember={isMember}
                      hasDemo={!!demo?.ready}
                      pendingPayment={history.find(
                        (payment) => !payment.complete,
                      )}
                      needsApproval={
                        isMember &&
                        pending.some((p) => !p.approvals.includes(account))
                      }
                      readyExpense={
                        !!signer &&
                        pending.some(
                          (p) => p.approvals.length >= data.config.quorum,
                        )
                      }
                      walletBalance={balance}
                      dues={money(Number(data.config.dues_try) / 100)}
                      busy={!!busy}
                      onBank={openBank}
                      onDemo={() => setModal("demo")}
                      onExpenses={() => setPage("expenses")}
                      onWallet={() => setModal("wallet")}
                    />
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <div>
                        <span>{t.pending}</span>
                        <strong>
                          {pending.length.toString().padStart(2, "0")}
                        </strong>
                        <small>{t.expenseSub}</small>
                      </div>
                      <span className="stat-icon amber">
                        <ReceiptText size={20} />
                      </span>
                    </div>
                    <div className="stat-card">
                      <div>
                        <span>{t.contributions}</span>
                        <strong>{tryValue(contributionTotal)}</strong>
                        <small>{t.totalHistory}</small>
                      </div>
                      <span className="stat-icon">
                        <ArrowDownLeft size={21} />
                      </span>
                    </div>
                    <div className="stat-card">
                      <div>
                        <span>{t.spent}</span>
                        <strong>{tryValue(paidTotal)}</strong>
                        <small>{t.last50}</small>
                      </div>
                      <span className="stat-icon blue">
                        <CheckCheck size={21} />
                      </span>
                    </div>
                  </div>
                  <CommunityJourney
                    t={t}
                    onBank={() => setPage("banking")}
                    onExpenses={() => setPage("expenses")}
                    onProofs={() => setModal("proofs")}
                  />
                  <div className="details-grid">
                    <section className="card expenses-card">
                      <div className="section-heading">
                        <div>
                          <h2>{t.expenseTitle}</h2>
                          <p>{t.expenseSub}</p>
                        </div>
                        <button
                          className="icon-button"
                          onClick={() => setPage("expenses")}
                          aria-label={t.viewAll}
                        >
                          <ArrowUpRight size={20} />
                        </button>
                      </div>
                      <ExpenseRows
                        proposals={(pending.length
                          ? pending
                          : data.proposals
                        ).slice(0, 3)}
                      />
                      <button
                        className="card-footer-link"
                        onClick={() => setPage("expenses")}
                      >
                        {t.viewAll}
                        <ArrowRight size={16} />
                      </button>
                    </section>
                    <section className="card reserve-card">
                      <div className="reserve-symbol">
                        <ShieldCheck size={27} />
                        <span>DeFindex</span>
                      </div>
                      <h2>{t.reserveTitle}</h2>
                      <p>{t.reserveBody}</p>
                      <div className="reserve-number">
                        {usdc(data.vaulted)} <span>USDC</span>
                      </div>
                      <div
                        className="allocation-track"
                        role="img"
                        aria-label={`${t.inReserve}: ${usdc(data.vaulted)} USDC`}
                      >
                        <span
                          style={{
                            width: `${data.total > 0n ? Number((data.vaulted * 100n) / data.total) : 0}%`,
                          }}
                        />
                      </div>
                      <ul className="check-list">
                        <li>
                          <Check size={14} />
                          {t.reserveHeld}
                        </li>
                        <li>
                          <Check size={14} />
                          {t.reserveRedeem}
                        </li>
                      </ul>
                      <div className="reserve-foot">
                        <span className="neutral-dot" />
                        {t.noYield}
                      </div>
                    </section>
                  </div>
                </>
              )}
              {page === "expenses" && (
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>{t.expenses}</h2>
                      <p>{t.quorumHint}</p>
                    </div>
                    <span className="count-pill">{data.proposals.length}</span>
                  </div>
                  <ExpenseRows proposals={data.proposals} />
                  <p className="card-note">
                    <ShieldCheck size={17} />
                    {t.balanceNotice}
                  </p>
                </section>
              )}
              {page === "banking" && (
                <div className="banking-grid">
                  <section className="card bank-card">
                    <div className="bank-card-icon">
                      <ArrowDownLeft size={25} />
                    </div>
                    <h2>{t.depositTitle}</h2>
                    <p>{t.depositBody}</p>
                    <div className="bank-path">
                      <span>TRY</span>
                      <ArrowRight size={18} />
                      <span>USDC</span>
                      <ArrowRight size={18} />
                      <ShieldCheck size={22} />
                    </div>
                    <p className="note">{t.depositLimits}</p>
                    {signer && !isMember && (
                      <p className="note">{t.joinToContribute}</p>
                    )}
                    <button
                      className="button full"
                      disabled={!!busy || (!!signer && !isMember)}
                      onClick={() => openBank("deposit")}
                    >
                      {account &&
                      bankFlow(account, treasury, "deposit") &&
                      !bankFlow(account, treasury, "deposit")?.complete
                        ? t.resume
                        : t.contribute}
                      <ArrowRight size={17} />
                    </button>
                  </section>
                  <section className="card bank-card">
                    <div className="bank-card-icon neutral">
                      <Landmark size={25} />
                    </div>
                    <h2>{t.withdrawTitle}</h2>
                    <p>{t.withdrawBody}</p>
                    <div className="wallet-balance">
                      <span>{t.walletBalance}</span>
                      <strong>
                        {signer
                          ? balance === null
                            ? t.balanceUnavailable
                            : `${balance} USDC`
                          : "—"}
                      </strong>
                    </div>
                    <p className="note">{t.minimumWithdraw}</p>
                    <button
                      className="button secondary full"
                      disabled={!!busy}
                      onClick={() => openBank("withdraw")}
                    >
                      {t.withdraw}
                      <ArrowUpRight size={17} />
                    </button>
                  </section>
                </div>
              )}
              {page === "banking" && (
                <PaymentHistory
                  flows={history}
                  t={t}
                  locale={locale}
                  busy={!!busy}
                  connected={!!signer}
                  onOpen={openPayment}
                />
              )}
              {page === "members" && (
                <section className="card">
                  <div className="section-heading">
                    <div>
                      <h2>{t.members}</h2>
                      <p>{t.membersIntro}</p>
                    </div>
                    <span className="count-pill">{data.members.length}</span>
                  </div>
                  <div className="member-list">
                    {data.members.map((m, i) => (
                      <article key={m} className="member-row">
                        <div
                          className={`member-avatar ${m === data.config.admin ? "admin" : ""}`}
                        >
                          {m === data.config.admin ? (
                            <ShieldCheck size={22} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </div>
                        <div>
                          <h3>{who(m)}</h3>
                          <p>
                            {m === data.config.admin
                              ? t.administrator
                              : t.memberRole}
                          </p>
                          <details>
                            <summary>{t.details}</summary>
                            <code>{m}</code>
                          </details>
                        </div>
                        <div className="member-contribution">
                          <span>{t.contributionTotal}</span>
                          <strong>{tryValue(data.contributions[m])}</strong>
                          <small>{usdc(data.contributions[m])} USDC</small>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
              {(page === "overview" || page === "banking") && (
                <section className="card activity-card">
                  <div className="section-heading">
                    <div>
                      <h2>{t.activity}</h2>
                      <p>{t.activitySub}</p>
                    </div>
                    <button
                      className="icon-button"
                      disabled={!!busy}
                      onClick={() => void refresh()}
                      aria-label={t.refresh}
                    >
                      <RefreshCw size={17} />
                    </button>
                  </div>
                  {eventsError || events.length === 0 ? (
                    <p className="activity-empty">
                      {eventsError ? t.activityUnavailable : t.noActivity}
                    </p>
                  ) : (
                    <div className="activity-table">
                      <div className="activity-table-head">
                        <span>{t.event}</span>
                        <span>{t.date}</span>
                        <span>{t.amount}</span>
                        <span />
                      </div>
                      {events.slice(0, 8).map((e) => (
                        <div className="activity-table-row" key={e.id}>
                          <div>
                            <span
                              className={`event-icon ${e.type.includes("executed") || e.type.includes("redeemed") ? "out" : ""}`}
                            >
                              {e.type.includes("member") ? (
                                <Users size={16} />
                              ) : e.type.includes("approved") ? (
                                <Check size={16} />
                              ) : (
                                <ArrowDownLeft size={16} />
                              )}
                            </span>
                            <span>
                              <strong>
                                {t[e.type as keyof Messages] ?? e.type}
                              </strong>
                              <small>
                                {e.member
                                  ? who(e.member)
                                  : e.proposalId
                                    ? `#${e.proposalId}`
                                    : "DeFindex"}
                              </small>
                            </span>
                          </div>
                          <time dateTime={e.date}>
                            {new Date(e.date).toLocaleDateString(locale, {
                              day: "2-digit",
                              month: "short",
                            })}
                            <small>
                              {new Date(e.date).toLocaleTimeString(locale, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </small>
                          </time>
                          <div className="event-amount">
                            {e.amount != null ? (
                              <>
                                <strong>{tryValue(e.amount)}</strong>
                                <small>{usdc(e.amount)} USDC</small>
                              </>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                          <a
                            href={txUrl(e.hash)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={t.receipt}
                            className="icon-button"
                          >
                            <ArrowUpRight size={17} />
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
              <footer className="main-footer">
                <span>
                  <span className="network-dot" />
                  {updated
                    ? `${t.syncTime} ${updated.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`
                    : t.live}
                </span>
                <button
                  className="text-button muted"
                  onClick={() => setModal("proofs")}
                >
                  {t.proofs}
                  <ArrowUpRight size={14} />
                </button>
              </footer>
            </>
          )}
        </main>
      </div>
      {modal && (
        <Dialog
          title={modalTitle}
          closeLabel={t.close}
          onClose={() => {
            setModal(null);
            setError("");
          }}
          busy={!!busy}
        >
          <ErrorBox error={error} t={t} onClose={() => setError("")} />
          {busy && (
            <div className="dialog-progress" role="status">
              <LoaderCircle size={17} className="spin" />
              {busy}
            </div>
          )}
          {modal === "demo" && (
            <div className="demo-dialog">
              <div className="demo-illustration">
                <div>
                  <Users size={28} />
                </div>
                <span />
                <div>
                  <ShieldCheck size={29} />
                </div>
                <span />
                <div>
                  <Landmark size={27} />
                </div>
              </div>
              <p>{t.demoBody}</p>
              <div className="note">{t.demoStorage}</div>
              <button
                className="button full"
                disabled={!!busy}
                onClick={() =>
                  void run(async () => {
                    const created = await createDemo(progress);
                    setDemo(created);
                    setExternal(null);
                    setDemoActive(true);
                    setRole("resident");
                    setPage("overview");
                    setModal(null);
                  })
                }
              >
                {demo?.ready ? t.resumeDemo : t.createDemo}
                <ArrowRight size={17} />
              </button>
            </div>
          )}
          {(modal === "deposit" || modal === "withdraw") && (
            <BankForm
              kind={modal}
              flow={flow}
              t={t}
              locale={locale}
              money={money}
              busy={!!busy}
              isMember={isMember}
              balance={balance ?? t.balanceUnavailable}
              amount={amount}
              onAmount={setAmount}
              onQuote={onQuote}
              onFinish={onFinishBank}
              onCheck={onCheckBank}
              onNew={() => setFlow(null)}
            />
          )}
          {modal === "expense" && (
            <form onSubmit={onExpense}>
              <p>{t.quorumHint}</p>
              <label>
                {t.expenseDescription}
                <input
                  required
                  maxLength={200}
                  autoFocus
                  placeholder={t.expensePlaceholder}
                  value={expense.description}
                  onChange={(e) =>
                    setExpense({ ...expense, description: e.target.value })
                  }
                />
              </label>
              <label>
                {t.amountUSDC}
                <input
                  required
                  inputMode="decimal"
                  type="number"
                  min="0.0000001"
                  step="0.0000001"
                  value={expense.amount}
                  onChange={(e) =>
                    setExpense({ ...expense, amount: e.target.value })
                  }
                />
              </label>
              <p className="field-hint">
                {rate && Number(expense.amount) > 0
                  ? `≈ ${money(Number(expense.amount) * rate.sell)} · `
                  : ""}
                {t.exactAmount}
              </p>
              <label>
                {t.recipient}
                <input
                  required
                  spellCheck={false}
                  value={expense.recipient}
                  onChange={(e) =>
                    setExpense({ ...expense, recipient: e.target.value })
                  }
                  placeholder="G…"
                />
              </label>
              <p className="field-hint">{t.recipientHint}</p>
              <button className="button full" disabled={!!busy || !isMember}>
                {t.submitExpense}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {modal === "invite" && (
            <div className="invite-dialog">
              <p>{t.inviteBody}</p>
              {qr && <img src={qr} alt={t.invite} />}
              <input aria-label={t.invite} readOnly value={invite} />
              <button
                className="button full"
                onClick={() =>
                  void navigator.clipboard
                    .writeText(invite)
                    .then(() => setCopied(true))
                    .catch((e) => setError(String(e)))
                }
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}{" "}
                {copied ? t.copied : t.copy}
              </button>
            </div>
          )}
          {modal === "wallet" && (
            <div className="wallet-dialog">
              {signer ? (
                <>
                  <div className="wallet-account">
                    <Wallet size={24} />
                    <strong>{who(account)}</strong>
                    <code>{account}</code>
                    <span>
                      {balance === null
                        ? t.balanceUnavailable
                        : `${balance} USDC`}
                    </span>
                  </div>
                  <button
                    className="button secondary full"
                    disabled={!!busy}
                    onClick={() => {
                      setExternal(null);
                      setDemoActive(false);
                      setModal(null);
                    }}
                  >
                    <LogOut size={16} />
                    {t.disconnect}
                  </button>
                </>
              ) : (
                <p>{t.noWallet}</p>
              )}
              <button
                className="button full"
                disabled={!!busy}
                onClick={() =>
                  void run(async () => {
                    setModal(null);
                    const connected = await connectWallet();
                    setExternal(connected);
                  })
                }
              >
                <Wallet size={17} />
                {t.openWallet}
              </button>
              <div className="or-line">
                <span>Stellar testnet</span>
              </div>
              <button
                className="button secondary full"
                disabled={!!busy}
                onClick={() => setModal("demo")}
              >
                <Sparkles size={17} />
                {demo?.ready ? t.resumeDemo : t.startDemo}
              </button>
              <p className="field-hint">{t.createHint}</p>
            </div>
          )}
          {modal === "proofs" && (
            <div className="proof-dialog">
              <p>{t.proofBody}</p>
              <dl className="quote-details">
                <div>
                  <dt>{t.network}</dt>
                  <dd>Stellar testnet</dd>
                </div>
              </dl>
              <a href={contractUrl(treasury)} target="_blank" rel="noreferrer">
                {t.treasuryContract}
                <ExternalLink size={16} />
                <code>{treasury}</code>
              </a>
              <a
                href={contractUrl(data?.config.vault ?? deployment.vault)}
                target="_blank"
                rel="noreferrer"
              >
                {t.vaultContract}
                <ExternalLink size={16} />
                <code>{data?.config.vault ?? deployment.vault}</code>
              </a>
              {treasury === deployment.treasury && (
                <a
                  href={txUrl(deployment.deploymentHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t.deployment}
                  <ExternalLink size={16} />
                </a>
              )}
              <p className="note">{t.noYield}</p>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
function FlaskIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M9 3h6M10 3v7L4 20h16l-6-10V3M7 15h10" strokeLinejoin="round" />
    </svg>
  );
}
