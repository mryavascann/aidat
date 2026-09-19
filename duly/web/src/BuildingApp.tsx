import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  Copy,
  Fingerprint,
  Landmark,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { StrKey } from "@duly/stellar-sdk";
import { Dialog } from "./components/Dialog";
import { ThemeToggle } from "./components/ThemeToggle";
import { BalanceScene } from "./features/overview/BalanceScene";
import { DuesOverview } from "./features/dues/DuesOverview";
import { duesRequest, loadDues, type DuesLedger } from "./lib/dues";
import { tr } from "./i18n/tr";
import { en } from "./i18n/en";
import { buildingCopy, type BuildingKey } from "./i18n/building";
import { rates, short, hex, txUrl, contractUrl } from "./lib/chain";
import { exclusive, load, save } from "./lib/storage";
import { connectWallet } from "./lib/wallet";
import { normalizeIban, recipientId, formatIban } from "./lib/iban";
import {
  accountBalance,
  addr,
  bankRecords,
  bool,
  buildingSnapshot,
  completeIntent,
  createBuilding,
  demoIdentity,
  deployment,
  enumValue,
  finishDeposit,
  finishDirectDues,
  startDirectDues,
  fundDemoUsdc,
  fromUnits,
  getBuildingDemo,
  hashBytes,
  intentFor,
  invoke,
  num,
  optionalAddress,
  payExpense,
  registerPayment,
  resumeBank,
  simulateVotes,
  startBuildingDemo,
  startDeposit,
  str,
  struct,
  toUnits,
  u32,
  type BankRecord,
  type BuildingData,
  type Demo,
  type Expense,
  type Identity,
  type Motion,
  type Seat,
} from "./lib/building";
import "./building.css";

type Page = "overview" | "expenses" | "dues" | "building";
type Modal =
  | "account"
  | "demo"
  | "setup"
  | "open"
  | "expense"
  | "decision"
  | "transfer"
  | "delegate"
  | "pay"
  | null;
const navigation = [
  { page: "overview", icon: LayoutDashboard },
  { page: "expenses", icon: ReceiptText },
  { page: "dues", icon: Landmark },
  { page: "building", icon: Users },
] as const;
const query = new URLSearchParams(location.search).get("building");
const candidateBuilding = query ?? load<string | null>("v3:building", null);
const defaultBuilding =
  typeof candidateBuilding === "string" &&
  StrKey.isValidContract(candidateBuilding)
    ? candidateBuilding
    : deployment.treasury;
const metadataKey = (building: string, recipient: string) =>
  `v3:iban:${building}:${recipient}`;

export default function BuildingApp() {
  const [lang, setLang] = useState<"tr" | "en">(() => load("language", "tr"));
  const t = buildingCopy(lang),
    oldT = lang === "tr" ? tr : en;
  const [page, setPage] = useState<Page>("overview");
  const [modal, setModal] = useState<Modal>(null);
  const [demo, setDemo] = useState<Demo | null>(getBuildingDemo);
  const [demoActive, setDemoActive] = useState(
    () => !query && load<boolean>("v3:demo-active", false),
  );
  const [normalBuilding, setNormalBuilding] = useState(defaultBuilding);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const actor = demoActive && demo?.ready ? demoIdentity(demo) : identity;
  const treasury =
    demoActive && demo?.treasury ? demo.treasury : normalBuilding;
  const account = actor?.address ?? "";
  const contextRef = useRef("");
  contextRef.current = `${treasury}:${account}`;
  const [data, setData] = useState<BuildingData | null>(null);
  const [rate, setRate] = useState<Awaited<ReturnType<typeof rates>> | null>(
    null,
  );
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [duesLedger, setDuesLedger] = useState<DuesLedger | null>(null);
  const [duesError, setDuesError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [dues, setDues] = useState({
    seat: "1",
    amount: "5",
    currency: "USDC",
  });
  const [voter, setVoter] = useState("");
  const [now, setNow] = useState(Date.now());
  const working = useRef(false),
    generation = useRef(0);
  const advancing = useRef(false);
  const selectedExpense = useRef<Expense | null>(null),
    selectedSeat = useRef<Seat | null>(null);
  const isManager = !!actor && actor.address === data?.config.manager;
  const eligibleSeats =
    data?.seats.filter((s) => s.owner === account || s.delegate === account) ??
    [];
  const chosenSeat =
    eligibleSeats.find((s) => String(s.id) === voter) ?? eligibleSeats[0];
  const majority = Math.floor((data?.config.seat_count ?? 3) / 2) + 1;
  const money = (value: bigint) =>
    new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB", {
      style: "currency",
      currency: "TRY",
    }).format(Number(value) / 100);
  const usd = (value: bigint) =>
    Number(fromUnits(value)).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", {
      maximumFractionDigits: 7,
    }) + " USDC";
  const textField = (key: string) => ({
    value: form[key] ?? "",
    onChange: (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    const results = await Promise.allSettled([
      buildingSnapshot(treasury),
      rates(),
      account ? accountBalance(account) : Promise.resolve(null),
      loadDues(treasury),
    ]);
    if (
      current !== generation.current ||
      contextRef.current !== `${treasury}:${account}`
    )
      return;
    if (results[0].status === "fulfilled") setData(results[0].value);
    else setError(String(results[0].reason?.message ?? results[0].reason));
    if (results[1].status === "fulfilled") setRate(results[1].value);
    if (results[2].status === "fulfilled") setBalance(results[2].value);
    if (results[3].status === "fulfilled") {
      setDuesLedger(results[3].value);
      setDuesError("");
    } else {
      setDuesLedger(null);
      setDuesError(String(results[3].reason));
    }
    setRecords(bankRecords(treasury, account));
  }, [treasury, account]);
  useEffect(() => {
    document.documentElement.lang = lang;
    save("language", lang);
  }, [lang]);
  useEffect(() => {
    setData(null);
    setBalance(null);
    setDuesLedger(null);
    setDuesError("");
    void refresh();
    return () => {
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now());
      if (!working.current && !document.hidden) void refresh();
    }, 15000);
    return () => clearInterval(id);
  }, [refresh]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (working.current || advancing.current || document.hidden) return;
      const record = records.find(
        (r) =>
          r.queued &&
          !["complete", "cancelled"].includes(r.phase) &&
          data?.expenses.some(
            (e) =>
              e.id === r.id &&
              (e.status === "Disbursed" ||
                (e.status === "Pending" &&
                  (e.tally[0] >= majority ||
                    (!e.vetoed &&
                      data.ledger >= e.ready_ledger &&
                      Date.now() >= Number(e.ready_time) * 1000)))),
          ),
      );
      if (!record) return;
      advancing.current = true;
      try {
        await exclusive(() => resumeBank(record));
        if (contextRef.current !== `${treasury}:${account}`) return;
        setRecords(bankRecords(treasury, account));
        await refresh();
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        advancing.current = false;
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [records, data, majority, treasury, account, refresh]);
  useEffect(() => {
    if (!load("v3:passkey-active", false)) return;
    let cancelled = false;
    import("@duly/accounts")
      .then((m) => m.connectAccount(false))
      .then((result) => {
        if (result && !cancelled)
          setIdentity({ kind: "passkey", address: result.address });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<unknown>, close = true) {
    if (working.current) return;
    working.current = true;
    setBusy(t("processing"));
    setError("");
    setSuccess("");
    try {
      await exclusive(action);
      if (close) setModal(null);
      setSuccess(t("success"));
      await refresh();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      working.current = false;
      setBusy("");
      setRecords(bankRecords(treasury, account));
    }
  }
  const progress = (phase: string) => {
    const labels: Record<string, BuildingKey> = {
      quote: "quoting",
      quoted: "bankAuthorizing",
      attesting: "bankAuthorizing",
      attested: "bankSending",
      disbursed: "bankSending",
      "bank-ready": "bankSending",
      processing: "bankConfirming",
      recording: "bankConfirming",
      "transfer-ready": "depositSending",
      contribute: "contributionSigning",
      "recording-dues": "indexingDues",
      "demo-usdc": "fundingDemoUsdc",
      scheduled: "scheduled",
    };
    setBusy(t(labels[phase] ?? "processing"));
    setRecords(bankRecords(treasury, account));
  };
  function open(modal: Modal, values: Record<string, string> = {}) {
    setForm(values);
    setError("");
    setModal(modal);
  }
  async function makeAccount(create: boolean) {
    const kit = await import("@duly/accounts");
    const result = create
      ? await kit.createAccount(form.label || "Duly")
      : await kit.connectAccount();
    if (!result) throw new Error("Passkey account is unavailable.");
    setIdentity({ kind: "passkey", address: result.address });
    setDemoActive(false);
    save("v3:demo-active", false);
    save("v3:passkey-active", true);
  }
  async function logout() {
    if (actor?.kind === "passkey")
      await (await import("@duly/accounts")).disconnectAccount();
    setIdentity(null);
    setDemoActive(false);
    save("v3:demo-active", false);
    save("v3:passkey-active", false);
  }
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setSuccess(t("copied"));
  }
  async function createExpense() {
    const iban = normalizeIban(form.iban),
      recipient = await recipientId(iban);
    const amount = toUnits(form.amount, 2),
      cap = toUnits(form.cap);
    if (amount <= 0n || cap <= 0n) throw new Error("Enter positive amounts.");
    const fields = [recipient, form.description, form.amount, form.cap],
      key = `expense:${treasury}:${account}`;
    save(metadataKey(treasury, recipient), iban);
    const id = intentFor(key, fields);
    const receipt = await invoke(
      actor!,
      treasury,
      "propose_expense",
      [hashBytes(recipient), num(amount), num(cap), str(form.description)],
      id,
    );
    await registerPayment(treasury, Number(receipt.value), iban);
    completeIntent(key);
    setPage("expenses");
  }
  async function voteExpense(expense: Expense, support: boolean) {
    if (!chosenSeat) throw new Error(t("noSeat"));
    const key = `vote-expense:${treasury}:${expense.id}:${chosenSeat.id}:${chosenSeat.version}`;
    const intent = intentFor(key, support);
    await invoke(
      actor!,
      treasury,
      "vote_expense",
      [u32(chosenSeat.id), addr(account), u32(expense.id), bool(support)],
      intent,
    );
    completeIntent(key);
  }
  async function voteMotion(motion: Motion, support: boolean) {
    if (!chosenSeat) throw new Error(t("noSeat"));
    const key = `vote-motion:${treasury}:${motion.id}:${chosenSeat.id}:${chosenSeat.version}`;
    const intent = intentFor(key, support);
    await invoke(
      actor!,
      treasury,
      "vote_motion",
      [u32(chosenSeat.id), addr(account), u32(motion.id), bool(support)],
      intent,
    );
    completeIntent(key);
  }
  async function makeDecision() {
    let args,
      method = "propose_motion";
    const kind = form.kind || "Budget";
    if (kind === "Recovery") {
      if (!/^[0-9a-f]{64}$/.test(form.document ?? ""))
        throw new Error("Select the title document.");
      method = "propose_recovery";
      args = [
        u32(Number(form.seat)),
        addr(form.address),
        hashBytes(form.document),
      ];
    } else {
      let value;
      if (kind === "Manager") value = addr(form.address);
      else if (kind === "Budget")
        value = struct({
          limit_try: num(toUnits(form.amount, 2)),
          limit_usdc: num(toUnits(form.cap)),
        });
      else {
        const iban = normalizeIban(form.iban),
          recipient = await recipientId(iban);
        save(metadataKey(treasury, recipient), iban);
        value = struct({
          id: hashBytes(recipient),
          label: str(form.label),
          enabled: bool(form.enabled !== "false"),
        });
      }
      args = [addr(account), enumValue(kind, value)];
    }
    const key = `motion:${treasury}:${account}`,
      intent = intentFor(key, form);
    const receipt = await invoke(actor!, treasury, method, args, intent);
    completeIntent(key);
    const id = Number(receipt.value);
    if (demoActive && demo) {
      if (
        chosenSeat &&
        (kind !== "Recovery" || Number(form.seat) !== chosenSeat.id)
      )
        await invoke(
          actor!,
          treasury,
          "vote_motion",
          [u32(chosenSeat.id), addr(account), u32(id), bool(true)],
          `demo-self:${treasury}:${id}`,
        );
      await simulateVotes(demo, id);
      if (kind !== "Recovery")
        await invoke(
          actor!,
          treasury,
          "apply_motion",
          [u32(id)],
          `apply:${treasury}:${id}`,
        );
    }
  }
  async function seatAction() {
    const seat = selectedSeat.current!;
    const key = `seat:${treasury}:${seat.id}:${seat.version}`,
      intent = intentFor(key, [modal, form.address]);
    await invoke(
      actor!,
      treasury,
      modal === "transfer" ? "transfer_seat" : "delegate",
      [
        u32(seat.id),
        modal === "transfer"
          ? addr(form.address)
          : optionalAddress(form.address ?? ""),
      ],
      intent,
    );
    completeIntent(key);
  }
  const pendingContribution = records.find(
    (r) => ["deposit", "usdc"].includes(r.kind) && r.phase !== "complete",
  );
  useEffect(() => {
    if (pendingContribution)
      setDues({
        seat: String(pendingContribution.seat),
        currency: pendingContribution.kind === "usdc" ? "USDC" : "TRY",
        amount:
          pendingContribution.kind === "usdc"
            ? pendingContribution.amountUsdc!
            : pendingContribution.amountTry!,
      });
  }, [pendingContribution?.key]);
  async function payDues() {
    if (!actor) {
      open("account");
      return;
    }
    const currency =
      pendingContribution?.kind === "usdc"
        ? "USDC"
        : pendingContribution
          ? "TRY"
          : dues.currency;
    let record = pendingContribution;
    if (!record) {
      if (currency === "USDC") {
        const available = balance ?? (await accountBalance(account));
        if (toUnits(dues.amount) > available)
          throw new Error(t("insufficientUsdc"));
        record = await startDirectDues(
          treasury,
          actor,
          Number(dues.seat),
          dues.amount,
        );
      } else
        record = await startDeposit(
          treasury,
          actor,
          Number(dues.seat),
          dues.amount,
        );
      setRecords(bankRecords(treasury, account));
    }
    if (record.kind === "usdc") await finishDirectDues(record, actor, progress);
    else await finishDeposit(record, actor, progress);
  }

  const remaining = (time: bigint, ledger: number) => {
    const seconds = Math.max(0, Number(time) - Math.floor(now / 1000));
    if (!seconds)
      return (data?.ledger ?? 0) < ledger ? t("awaitLedger") : t("ready");
    if (seconds < 60) return `${seconds} sn`;
    if (seconds < 3600)
      return `${Math.ceil(seconds / 60)} ${lang === "tr" ? "dk" : "min"}`;
    if (seconds < 86400)
      return `${Math.ceil(seconds / 3600)} ${lang === "tr" ? "saat" : "hours"}`;
    return `${Math.ceil(seconds / 86400)} ${lang === "tr" ? "gün" : "days"}`;
  };
  const expenseReady = (e: Expense) =>
    e.tally[0] >= majority ||
    (!e.vetoed &&
      Number(e.ready_time) * 1000 <= now &&
      (data?.ledger ?? 0) >= e.ready_ledger);
  const activeVote = (votes: Expense["votes"]) =>
    chosenSeat
      ? votes.find(
          (v) => v.seat === chosenSeat.id && v.version === chosenSeat.version,
        )
      : undefined;
  function renderExpense(e: Expense) {
    const record = records.find((r) => r.kind === "withdraw" && r.id === e.id);
    const storedIban = load<string>(
      metadataKey(treasury, hex(e.recipient)),
      "",
    );
    return (
      <article className="v3-expense card" key={e.id}>
        <header>
          <span className="v3-card-icon">
            <ReceiptText size={19} />
          </span>
          <div>
            <h3>{e.description}</h3>
            <p>
              #{e.id} ·{" "}
              <span className="mono">
                {storedIban ? formatIban(storedIban) : short(hex(e.recipient))}
              </span>
            </p>
          </div>
          <strong className="v3-expense-amount">{money(e.amount_try)}</strong>
        </header>
        <div className="v3-tags">
          <span className={`v3-tag ${e.status === "Settled" ? "green" : ""}`}>
            {t(e.status as BuildingKey)}
          </span>
          {e.recipient_exception && (
            <span className="v3-tag amber">{t("newRecipient")}</span>
          )}
          {e.budget_exception && (
            <span className="v3-tag amber">{t("overBudget")}</span>
          )}
          {e.routine && <span className="v3-tag">{t("routine")}</span>}
          {e.vetoed && e.status === "Pending" && (
            <span className="v3-tag amber">{t("vetoed")}</span>
          )}
        </div>
        <div className="v3-expense-info">
          <span>
            {e.tally[0]}/{data?.config.seat_count} {t("yes").toLowerCase()}
          </span>
          <span>
            {t("usdcCap")}: {usd(e.max_usdc)}
          </span>
          {e.status === "Pending" && (
            <span>
              <Clock3 size={14} />{" "}
              {e.vetoed
                ? `${majority} ${t("yes").toLowerCase()}`
                : remaining(e.ready_time, e.ready_ledger)}
            </span>
          )}
        </div>
        <div className="v3-actions">
          {e.status === "Pending" && chosenSeat && (
            <>
              <button
                className="button small secondary"
                disabled={!!busy || activeVote(e.votes)?.support === true}
                onClick={() => void run(() => voteExpense(e, true), false)}
              >
                {t("yes")}
              </button>
              <button
                className="button small secondary"
                disabled={!!busy || e.vetoed}
                onClick={() =>
                  void run(
                    () =>
                      invoke(
                        actor!,
                        treasury,
                        "veto_expense",
                        [u32(chosenSeat.id), addr(account), u32(e.id)],
                        `veto:${treasury}:${e.id}:${chosenSeat.id}`,
                      ),
                    false,
                  )
                }
              >
                {t("veto")}
              </button>
            </>
          )}
          {(e.status === "Disbursed" ||
            (e.status === "Pending" && expenseReady(e))) && (
            <button
              className="button small"
              disabled={!!busy}
              onClick={() => {
                selectedExpense.current = e;
                open("pay", { iban: storedIban });
              }}
            >
              {record ? t("resume") : t("pay")}
              <ArrowRight size={14} />
            </button>
          )}
          {isManager && e.status === "Pending" && (
            <button
              className="text-button muted"
              disabled={!!busy}
              onClick={() =>
                void run(
                  () =>
                    invoke(
                      actor!,
                      treasury,
                      "cancel_expense",
                      [u32(e.id)],
                      `cancel:${treasury}:${e.id}`,
                    ),
                  false,
                )
              }
            >
              {t("cancel")}
            </button>
          )}
        </div>
        {demoActive && demo && e.status === "Pending" && (
          <div className="v3-demo-actions">
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() =>
                void run(() => simulateVotes(demo, e.id, false), false)
              }
            >
              <Sparkles size={14} />
              {t("simulateVotes")}
            </button>
            <button
              className="text-button muted"
              disabled={!!busy || e.vetoed}
              onClick={() =>
                void run(() => {
                  const a = demoIdentity(demo, 1);
                  return invoke(
                    a,
                    treasury,
                    "veto_expense",
                    [u32(2), addr(a.address), u32(e.id)],
                    `demo-veto:${treasury}:${e.id}`,
                  );
                }, false)
              }
            >
              {t("simulateVeto")}
            </button>
          </div>
        )}
        {record?.bankReference && (
          <p className="v3-bank-receipt">
            <Check size={15} />
            {t("bankRef")}: {record.bankReference} · {t("sandbox")}
          </p>
        )}
        {record?.receipt && (
          <a
            className="text-button"
            href={txUrl(record.receipt)}
            target="_blank"
            rel="noreferrer"
          >
            {t("receipt")} ↗
          </a>
        )}
      </article>
    );
  }
  function renderMotion(m: Motion) {
    const [kind, value] = m.kind,
      needed =
        kind === "Recovery"
          ? Math.floor(((data?.config.seat_count ?? 3) - 1) / 2) + 1
          : majority;
    return (
      <article className="card v3-motion" key={m.id}>
        <header>
          <h3>
            {t(kind as BuildingKey)} <span className="muted">#{m.id}</span>
          </h3>
          <span className="v3-tag">{t(m.status as BuildingKey)}</span>
        </header>
        <p>
          {kind === "Budget"
            ? `${money(value.limit_try)} · ${usd(value.limit_usdc)}`
            : kind === "Manager"
              ? short(value)
              : kind === "Recipient"
                ? `${value.label} · ${value.enabled ? t("yes") : t("no")}`
                : `${t("apartment")} ${value.seat} → ${short(value.buyer)}`}
        </p>
        <p className="muted">
          {m.tally[0]}/{needed} {t("yes").toLowerCase()}
          {kind === "Recovery" &&
            m.ready_time > 0n &&
            ` · ${remaining(m.ready_time, m.ready_ledger)}`}
        </p>
        {m.status === "Pending" && (
          <div className="v3-actions">
            {chosenSeat &&
              (kind !== "Recovery" || chosenSeat.id !== value.seat) && (
                <>
                  <button
                    className="button small secondary"
                    disabled={!!busy || activeVote(m.votes)?.support === true}
                    onClick={() => void run(() => voteMotion(m, true), false)}
                  >
                    {t("yes")}
                  </button>
                  <button
                    className="button small secondary"
                    disabled={!!busy || activeVote(m.votes)?.support === false}
                    onClick={() => void run(() => voteMotion(m, false), false)}
                  >
                    {t("no")}
                  </button>
                </>
              )}
            {actor &&
              m.tally[0] >= needed &&
              (kind !== "Recovery" ||
                (Number(m.ready_time) * 1000 <= now &&
                  (data?.ledger ?? 0) >= m.ready_ledger)) && (
                <button
                  className="button small"
                  disabled={!!busy}
                  onClick={() =>
                    void run(
                      () =>
                        invoke(
                          actor,
                          treasury,
                          "apply_motion",
                          [u32(m.id)],
                          `apply:${treasury}:${m.id}`,
                        ),
                      false,
                    )
                  }
                >
                  {t("apply")}
                </button>
              )}
            {kind === "Recovery" && value.owner === account && (
              <button
                className="button small secondary"
                disabled={!!busy}
                onClick={() =>
                  void run(
                    () =>
                      invoke(
                        actor!,
                        treasury,
                        "veto_recovery",
                        [u32(m.id)],
                        `veto-recovery:${treasury}:${m.id}`,
                      ),
                    false,
                  )
                }
              >
                {t("vetoRecovery")}
              </button>
            )}
            {demoActive && demo && (
              <button
                className="text-button"
                disabled={!!busy}
                onClick={() => void run(() => simulateVotes(demo, m.id), false)}
              >
                <Sparkles size={14} />
                {t("simulateVotes")}
              </button>
            )}
          </div>
        )}
        {kind === "Recovery" && (
          <details>
            <summary>{t("details")}</summary>
            <p className="mono">SHA-256: {hex(value.document)}</p>
          </details>
        )}
      </article>
    );
  }
  const submit = (event: FormEvent, action: () => Promise<unknown>) => {
    event.preventDefault();
    void run(action);
  };
  const pageTitle: Record<Page, BuildingKey> = {
    overview: "overviewTitle",
    expenses: "expenseTitle",
    dues: "duesTitle",
    building: "buildingTitle",
  };
  const pageSub: Record<Page, BuildingKey> = {
    overview: "overviewSub",
    expenses: "expenseSub",
    dues: "duesSub",
    building: "buildingSub",
  };
  return (
    <div className="app-shell v3-app">
      <a className="skip-link" href="#main-content">
        {lang === "tr" ? "İçeriğe geç" : "Skip to content"}
      </a>
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="Duly">
          <img src="/duly.svg" alt="" />
          <span>
            duly<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="brand-tagline">{t("tagline")}</p>
        <div className="nav-label">{t("community")}</div>
        <nav aria-label={t("community")}>
          {navigation.map(({ page: p, icon: Icon }) => (
            <button
              key={p}
              className={`nav-item ${p === page ? "active" : ""}`}
              aria-current={p === page ? "page" : undefined}
              onClick={() => setPage(p)}
            >
              <Icon size={19} />
              <span>{t(p)}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="network-card">
            <span className="network-dot" />
            <div>
              <strong>Stellar Testnet</strong>
              <p>{t("model")}</p>
            </div>
          </div>
          <a
            className="sidebar-proof"
            href={contractUrl(treasury)}
            target="_blank"
            rel="noreferrer"
          >
            <ShieldCheck size={17} />
            {t("proofs")} ↗
          </a>
          <span className="sidebar-copyright">Duly © 2026</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="community-name">
            <div className="community-avatar">
              <Building2 size={20} />
            </div>
            <div>
              <strong>{data?.config.name ?? "Duly"}</strong>
              <p>
                {data
                  ? `${data.config.seat_count} ${t("fixedSeats").toLowerCase()}`
                  : "Stellar"}
              </p>
            </div>
          </div>
          <div className="topbar-actions">
            <ThemeToggle t={oldT} />
            <div className="language-switch" aria-label={oldT.language}>
              {(["tr", "en"] as const).map((l) => (
                <button
                  key={l}
                  aria-pressed={l === lang}
                  onClick={() => setLang(l)}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              className={`button wallet-button ${actor ? "secondary" : ""}`}
              aria-label={actor ? t("account") : t("connect")}
              onClick={() => open("account")}
            >
              <Fingerprint size={17} />
              <span>{actor ? t("account") : t("connect")}</span>
            </button>
          </div>
        </header>
        <div className="sandbox-bar">
          <ShieldCheck size={14} />
          {t("sandbox")}
        </div>
        {demoActive && (
          <div className="v3-demo-bar">
            <Sparkles size={17} />
            <span>{t("demoBanner")}</span>
            <button
              className="text-button"
              disabled={!!busy}
              onClick={() => {
                setDemoActive(false);
                save("v3:demo-active", false);
              }}
            >
              {t("demoExit")}
            </button>
          </div>
        )}
        <main id="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">DULY / {t(page)}</div>
              <h1>{t(pageTitle[page])}</h1>
              <p>{t(pageSub[page])}</p>
            </div>
            <div className="heading-actions">
              <button
                className="icon-button"
                aria-label={t("refresh")}
                disabled={!!busy}
                onClick={() => void refresh()}
              >
                <RefreshCw size={18} />
              </button>
              {page === "expenses" && isManager && (
                <button
                  className="button"
                  disabled={!!busy}
                  onClick={() =>
                    open("expense", {
                      amount: "100",
                      cap: rate
                        ? String(Math.ceil((100 / rate.sell) * 1.1 * 100) / 100)
                        : "3",
                      description: "",
                      iban: demoActive ? "TR330006100519786457841326" : "",
                    })
                  }
                >
                  <Plus size={17} />
                  {t("createExpense")}
                </button>
              )}
              {page === "building" && actor && (
                <button
                  className="button"
                  disabled={!!busy || (!chosenSeat && !isManager)}
                  onClick={() =>
                    open("decision", {
                      kind: "Budget",
                      amount: "20000",
                      cap: "500",
                      seat: "3",
                      enabled: "true",
                    })
                  }
                >
                  <Plus size={17} />
                  {t("newDecision")}
                </button>
              )}
            </div>
          </div>
          {!!error && (
            <div className="error-box" role="alert">
              <div>
                <strong>{t("error")}</strong>
                <p>{t("errorHint")}</p>
                <details open={false}>
                  <summary>{t("details")}</summary>
                  <p className="technical">{error}</p>
                </details>
              </div>
              <button
                className="icon-button"
                aria-label={t("close")}
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!!busy && (
            <div className="progress-bar" role="status">
              <LoaderCircle className="spin" size={17} />
              {busy}
            </div>
          )}
          {!!success && !busy && (
            <div className="success-bar" role="status">
              <Check size={16} />
              {success}
              <button
                className="icon-button"
                aria-label={t("close")}
                onClick={() => setSuccess("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-card" role="status">
              <LoaderCircle className="spin" />
              {t("loading")}
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
                          <span className="tiny-logo">d.</span> {t("balance")}
                        </span>
                        <span className="live-pill">● TESTNET</span>
                      </div>
                      <div className="balance-value">
                        {rate
                          ? money(
                              BigInt(
                                Math.round(
                                  Number(fromUnits(data.total)) *
                                    rate.sell *
                                    100,
                                ),
                              ),
                            )
                          : "—"}
                      </div>
                      <div className="balance-sub">
                        {usd(data.total)} · {t("estimated")}
                      </div>
                      <div className="balance-footer">
                        <p>{t("reserve")}</p>
                        <button
                          className="button"
                          onClick={() => setPage("dues")}
                        >
                          <ArrowDownLeft size={17} />
                          {t("dues")}
                        </button>
                      </div>
                    </section>
                    <section className="card v3-next">
                      <div className="eyebrow">{t("next")}</div>
                      <span className="v3-card-icon">
                        <Sparkles size={22} />
                      </span>
                      <h2>{actor ? t("overviewSub") : t("welcome")}</h2>
                      <p>{actor ? t("noticeText") : t("welcomeText")}</p>
                      <button
                        className="button full"
                        disabled={!!busy}
                        onClick={() => (actor ? setPage("dues") : open("demo"))}
                      >
                        {actor ? t("dues") : t("startDemo")}
                        <ArrowRight size={16} />
                      </button>
                      {!actor && (
                        <button
                          className="text-button"
                          onClick={() => open("account")}
                        >
                          {t("createAccount")}
                        </button>
                      )}
                    </section>
                  </div>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <p>{t("fixedSeats")}</p>
                      <strong>{data.config.seat_count}</strong>
                      <span>{t("buildingSub")}</span>
                    </div>
                    <div className="stat-card">
                      <p>{t("budget")}</p>
                      <strong>
                        {data.config.budget.limit_try
                          ? money(data.config.budget.limit_try)
                          : "—"}
                      </strong>
                      <span>
                        {t("period")}:{" "}
                        {data.config.demo ? "10 min" : t("periodDays")}
                      </span>
                    </div>
                    <div className="stat-card">
                      <p>{t("spent")}</p>
                      <strong>{money(data.spent.amount_try)}</strong>
                      <span>{usd(data.spent.amount_usdc)}</span>
                    </div>
                  </div>
                  <section className="v3-rules card">
                    <ShieldCheck size={21} />
                    <div>
                      <h2>{t("notice")}</h2>
                      <p>{t("noticeText")}</p>
                      <p>{t("autoExplain")}</p>
                    </div>
                  </section>
                  <div className="v3-section-title">
                    <h2>{t("expenses")}</h2>
                    <button
                      className="text-button"
                      onClick={() => setPage("expenses")}
                    >
                      {t("expenses")}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {data.expenses.slice(0, 2).map((e) => renderExpense(e))}
                  {!data.expenses.length && (
                    <div className="card empty">
                      <ReceiptText size={24} />
                      <h3>{t("emptyExpenses")}</h3>
                      <p>{t("emptyExpensesText")}</p>
                    </div>
                  )}
                </>
              )}
              {page === "expenses" && (
                <>
                  <section className="v3-rules card">
                    <Clock3 size={21} />
                    <div>
                      <h2>{data.config.demo ? t("demo") : t("notice")}</h2>
                      <p>{t("noticeText")}</p>
                      <p>{t("autoExplain")}</p>
                    </div>
                  </section>
                  {eligibleSeats.length > 1 && (
                    <label className="v3-inline-label">
                      {t("voteSeat")}
                      <select
                        value={chosenSeat?.id ?? ""}
                        onChange={(e) => setVoter(e.target.value)}
                      >
                        {eligibleSeats.map((s) => (
                          <option key={s.id} value={s.id}>
                            {t("apartment")} {s.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {data.expenses.map((e) => renderExpense(e))}
                  {!data.expenses.length && (
                    <div className="card empty">
                      <ReceiptText size={26} />
                      <h3>{t("emptyExpenses")}</h3>
                      <p>{t("emptyExpensesText")}</p>
                    </div>
                  )}
                </>
              )}
              {page === "dues" && (
                <>
                  <div className="v3-dues-grid">
                    <section className="card v3-form-card">
                      <h2>{t("dues")}</h2>
                      <p>{t("duesSub")}</p>
                      <form onSubmit={(e) => submit(e, payDues)}>
                        <label>
                          {t("apartment")}
                          <select
                            aria-label={t("apartment")}
                            value={dues.seat}
                            disabled={!!pendingContribution}
                            onChange={(e) =>
                              setDues({ ...dues, seat: e.target.value })
                            }
                          >
                            {data.seats.map((s) => (
                              <option value={s.id} key={s.id}>
                                {t("apartment")} {s.id}
                              </option>
                            ))}
                          </select>
                        </label>
                        <fieldset className="v3-currency">
                          <legend>{t("paymentMethod")}</legend>
                          <button
                            type="button"
                            aria-pressed={dues.currency === "TRY"}
                            disabled={!!pendingContribution}
                            onClick={() =>
                              setDues({
                                ...dues,
                                currency: "TRY",
                                amount: fromUnits(data.config.dues_try, 2),
                              })
                            }
                          >
                            <Landmark size={18} />
                            {t("bankTry")}
                          </button>
                          <button
                            type="button"
                            aria-pressed={dues.currency === "USDC"}
                            disabled={!!pendingContribution}
                            onClick={() =>
                              setDues({
                                ...dues,
                                currency: "USDC",
                                amount: "5",
                              })
                            }
                          >
                            <Wallet size={18} />
                            {t("directUsdc")}
                          </button>
                        </fieldset>
                        <label>
                          {t("amount")} (
                          {dues.currency === "TRY" ? "TL" : "USDC"}
                          )
                          <input
                            inputMode="decimal"
                            required
                            type="number"
                            min={dues.currency === "TRY" ? "50" : "0.0000001"}
                            max={dues.currency === "TRY" ? "3000" : "10000"}
                            step={dues.currency === "TRY" ? ".01" : ".0000001"}
                            value={dues.amount}
                            disabled={!!pendingContribution}
                            onChange={(e) =>
                              setDues({ ...dues, amount: e.target.value })
                            }
                          />
                        </label>
                        <p className="v3-help">
                          {dues.currency === "TRY"
                            ? t("bankHelp")
                            : t("directUsdcHelp")}
                        </p>
                        {balance !== null && (
                          <p className="v3-help">
                            {t("walletBalance")}: {usd(balance)}
                          </p>
                        )}
                        {actor?.kind === "demo" && dues.currency === "USDC" && (
                          <div className="v3-demo-funding">
                            <button
                              type="button"
                              className="button small secondary"
                              disabled={!!busy}
                              onClick={() =>
                                void run(
                                  () =>
                                    fundDemoUsdc(treasury, account, progress),
                                  false,
                                )
                              }
                            >
                              <Sparkles size={16} />
                              {t("demoUsdc")}
                            </button>
                            <p className="v3-help">{t("demoUsdcHelp")}</p>
                          </div>
                        )}
                        <button
                          type="submit"
                          className="button full"
                          disabled={!!busy}
                        >
                          {pendingContribution
                            ? t("resume")
                            : !actor
                              ? t("connect")
                              : dues.currency === "TRY"
                                ? t("payTry")
                                : t("directUsdc")}
                          <ArrowRight size={16} />
                        </button>
                      </form>
                    </section>
                    <section>
                      <h2>{t("history")}</h2>
                      {records
                        .filter(
                          (r) => r.kind === "deposit" || r.kind === "usdc",
                        )
                        .map((r) => (
                          <article className="card v3-history" key={r.key}>
                            <header>
                              <strong>
                                {r.kind === "usdc"
                                  ? `${r.amountUsdc} USDC`
                                  : `${r.amountTry} TL`}
                              </strong>
                              <span className="v3-tag">
                                {r.phase === "complete"
                                  ? t("complete")
                                  : t("Pending")}
                              </span>
                            </header>
                            <p>
                              {t("apartment")} {r.seat} · {r.amountUsdc ?? "—"}{" "}
                              USDC
                            </p>
                            {r.kind === "usdc" && (
                              <p>
                                {t("usdcCredit")}: {r.amountTry} TL
                              </p>
                            )}
                            {r.phase === "complete" &&
                              r.receipt &&
                              duesLedger &&
                              !duesLedger.payments.some(
                                (p) => p.hash === r.receipt,
                              ) &&
                              r.saved && (
                                <button
                                  className="button small secondary"
                                  disabled={!!busy}
                                  onClick={() =>
                                    void run(
                                      () =>
                                        duesRequest({
                                          action: "record",
                                          treasury,
                                          receipt: r.receipt,
                                          saved: r.saved,
                                        }),
                                      false,
                                    )
                                  }
                                >
                                  {t("reconcileDues")}
                                </button>
                              )}
                            {r.phase !== "complete" && actor && (
                              <button
                                className="button small secondary"
                                disabled={!!busy}
                                onClick={() =>
                                  void run(
                                    () =>
                                      r.kind === "usdc"
                                        ? finishDirectDues(r, actor, progress)
                                        : finishDeposit(r, actor, progress),
                                    false,
                                  )
                                }
                              >
                                {t("resume")}
                              </button>
                            )}
                            <details>
                              <summary>{t("details")}</summary>
                              <p className="mono">{r.anchorId}</p>
                              {r.receipt && (
                                <a
                                  href={txUrl(r.receipt)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {t("receipt")} ↗
                                </a>
                              )}
                            </details>
                          </article>
                        ))}
                      {!records.some(
                        (r) => r.kind === "deposit" || r.kind === "usdc",
                      ) && <p className="v3-help">{t("bankHelp")}</p>}
                    </section>
                  </div>
                  <DuesOverview
                    key={treasury}
                    data={data}
                    ledger={duesLedger}
                    error={duesError}
                    lang={lang}
                    isManager={isManager}
                  />
                </>
              )}
              {page === "building" && (
                <>
                  <div className="v3-actions v3-building-tools">
                    <button
                      className="button secondary"
                      onClick={() =>
                        void copy(`${location.origin}/?building=${treasury}`)
                      }
                    >
                      <Copy size={16} />
                      {t("sharedLink")}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => open("open", { address: "" })}
                    >
                      {t("switchBuilding")}
                    </button>
                    {actor && (
                      <button
                        className="text-button"
                        onClick={() =>
                          open("setup", {
                            name: "",
                            owners: account,
                            amount: "200",
                          })
                        }
                      >
                        {t("createBuilding")}
                      </button>
                    )}
                  </div>
                  {actor && !eligibleSeats.length && (
                    <p className="payment-notice">{t("noSeat")}</p>
                  )}
                  <section className="v3-seat-grid">
                    {data.seats.map((s) => (
                      <article className="card v3-seat" key={s.id}>
                        <header>
                          <div className="v3-card-icon">
                            <Building2 size={20} />
                          </div>
                          <h3>
                            {t("apartment")} {s.id}
                          </h3>
                          {s.owner === data.config.manager && (
                            <span className="v3-tag">{t("manager")}</span>
                          )}
                        </header>
                        <p>
                          {t("owner")}:{" "}
                          <span className="mono">{short(s.owner)}</span>
                          {s.owner === account && " · " + t("account")}
                        </p>
                        {s.delegate && (
                          <p>
                            {t("delegate")}:{" "}
                            <span className="mono">{short(s.delegate)}</span>
                          </p>
                        )}
                        <p className="v3-help">
                          {t("cumulative")}: {usd(s.paid)}
                        </p>
                        {s.owner === account && (
                          <div className="v3-actions">
                            <button
                              className="text-button"
                              disabled={!!busy}
                              onClick={() => {
                                selectedSeat.current = s;
                                open("transfer", { address: "" });
                              }}
                            >
                              {t("transfer")}
                            </button>
                            <button
                              className="text-button"
                              disabled={!!busy}
                              onClick={() => {
                                selectedSeat.current = s;
                                open("delegate", { address: s.delegate ?? "" });
                              }}
                            >
                              {t("delegateAction")}
                            </button>
                          </div>
                        )}
                      </article>
                    ))}
                  </section>
                  <div className="v3-section-title">
                    <h2>{t("governance")}</h2>
                    <span>
                      {t("manager")}:{" "}
                      <span className="mono">{short(data.config.manager)}</span>
                    </span>
                  </div>
                  {eligibleSeats.length > 1 && (
                    <label className="v3-inline-label">
                      {t("voteSeat")}
                      <select
                        value={chosenSeat?.id ?? ""}
                        onChange={(e) => setVoter(e.target.value)}
                      >
                        {eligibleSeats.map((s) => (
                          <option key={s.id} value={s.id}>
                            {t("apartment")} {s.id}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {data.motions.map((m) => renderMotion(m))}
                  {!data.motions.length && (
                    <p className="v3-help">{t("emptyMotions")}</p>
                  )}
                  {data.recipients.length > 0 && (
                    <section className="card v3-recipients">
                      <h3>{t("Recipient")}</h3>
                      {data.recipients.map((r) => (
                        <p key={hex(r.id)}>
                          {r.label} · {r.enabled ? t("yes") : t("no")} ·{" "}
                          <span className="mono">{short(hex(r.id))}</span>
                        </p>
                      ))}
                    </section>
                  )}
                </>
              )}
            </>
          )}
          <footer className="main-footer">
            <span>
              <span className="network-dot" />
              {t("model")}
            </span>
            {!demoActive && (
              <button className="text-button" onClick={() => open("demo")}>
                <Sparkles size={14} />
                {t("demo")}
              </button>
            )}
          </footer>
        </main>
      </div>
      {modal && (
        <Dialog
          title={t(
            (
              {
                account: actor ? "account" : "connect",
                demo: "demo",
                setup: "createBuilding",
                open: "switchBuilding",
                expense: "createExpense",
                decision: "newDecision",
                transfer: "transfer",
                delegate: "delegateAction",
                pay: "pay",
              } as const
            )[modal],
          )}
          closeLabel={t("close")}
          busy={!!busy}
          onClose={() => setModal(null)}
        >
          {!!busy && (
            <p className="v3-modal-status" role="status">
              <LoaderCircle className="spin" size={16} />
              {busy}
            </p>
          )}
          {!!error && (
            <div className="v3-modal-error" role="alert">
              <strong>{t("error")}</strong>
              <p>{error}</p>
            </div>
          )}
          {modal === "account" &&
            (actor ? (
              <div className="v3-account">
                <p>{t("signedBy")}</p>
                <p className="mono">{actor.address}</p>
                <div className="v3-actions">
                  <button
                    className="button secondary"
                    onClick={() => void copy(actor.address)}
                  >
                    <Copy size={16} />
                    {t("copy")}
                  </button>
                  <button
                    className="button secondary"
                    disabled={!!busy}
                    onClick={() => void run(logout)}
                  >
                    <LogOut size={16} />
                    {t("exit")}
                  </button>
                </div>
                <button
                  className="button full"
                  disabled={!!busy}
                  onClick={() =>
                    open("setup", { owners: account, name: "", amount: "200" })
                  }
                >
                  {t("createBuilding")}
                </button>
                <button
                  className="text-button"
                  onClick={() => open("open", { address: "" })}
                >
                  {t("switchBuilding")}
                </button>
                {actor.kind === "passkey" && (
                  <p className="v3-help">{t("passkeyLimit")}</p>
                )}
              </div>
            ) : (
              <div className="v3-account">
                <span className="v3-passkey-icon">
                  <Fingerprint size={36} />
                </span>
                <p>{t("passkeyText")}</p>
                <label>
                  {t("accountLabel")}
                  <input
                    autoComplete="nickname"
                    {...textField("label")}
                    placeholder="Duly"
                  />
                </label>
                <button
                  className="button full"
                  disabled={!!busy}
                  onClick={() => void run(() => makeAccount(true))}
                >
                  {t("createAccount")}
                </button>
                <button
                  className="button secondary full"
                  disabled={!!busy}
                  onClick={() => void run(() => makeAccount(false))}
                >
                  {t("signIn")}
                </button>
                <button
                  className="text-button"
                  disabled={!!busy}
                  onClick={() => {
                    setModal(null);
                    void run(async () => {
                      const signer = await connectWallet();
                      setIdentity({
                        kind: "wallet",
                        address: signer.publicKey(),
                        signer,
                      });
                      setDemoActive(false);
                      save("v3:demo-active", false);
                    });
                  }}
                >
                  <Wallet size={16} />
                  {t("existingWallet")}
                </button>
                <p className="v3-help">{t("passkeyLimit")}</p>
              </div>
            ))}
          {modal === "demo" && (
            <div className="v3-account">
              <p>{t("demoText")}</p>
              <p className="payment-notice">{t("demoBanner")}</p>
              <button
                className="button full"
                disabled={!!busy}
                onClick={() =>
                  void run(async () => {
                    const created = await startBuildingDemo((stage) =>
                      setBusy(
                        stage.startsWith("demo-fund")
                          ? `${t("fundDemo")} (${stage.split(":")[1]}/3)`
                          : t("deployDemo"),
                      ),
                    );
                    setDemo(created);
                    setDemoActive(true);
                    save("v3:demo-active", true);
                    setPage("overview");
                  })
                }
              >
                <Sparkles size={17} />
                {t("startDemo")}
              </button>
            </div>
          )}
          {modal === "open" && (
            <form
              onSubmit={(e) =>
                submit(e, async () => {
                  const id = form.address.trim();
                  await buildingSnapshot(id);
                  setNormalBuilding(id);
                  save("v3:building", id);
                  setDemoActive(false);
                  save("v3:demo-active", false);
                })
              }
            >
              <label>
                {t("buildingAddress")}
                <input required {...textField("address")} placeholder="C…" />
              </label>
              <button className="button full" disabled={!!busy}>
                {t("switchBuilding")}
              </button>
            </form>
          )}
          {modal === "setup" && (
            <form
              onSubmit={(e) =>
                submit(e, async () => {
                  const result = await createBuilding(
                    actor!,
                    form.name,
                    form.owners.split(/\s+/).filter(Boolean),
                    toUnits(form.amount, 2),
                  );
                  setNormalBuilding(result.value);
                  save("v3:building", result.value);
                  setDemoActive(false);
                  save("v3:demo-active", false);
                  setPage("building");
                })
              }
            >
              <label>
                {t("buildingName")}
                <input required maxLength={80} {...textField("name")} />
              </label>
              <label>
                {t("duesAmount")}
                <input
                  required
                  type="number"
                  min="0.01"
                  step=".01"
                  {...textField("amount")}
                />
              </label>
              <label>
                {t("owners")}
                <textarea
                  rows={5}
                  required
                  aria-label={t("owners")}
                  {...textField("owners")}
                />
              </label>
              <p className="v3-help">{t("ownersHelp")}</p>
              <p className="payment-notice">{t("setupTrust")}</p>
              <button className="button full" disabled={!!busy}>
                {t("submit")}
              </button>
            </form>
          )}
          {modal === "expense" && (
            <form onSubmit={(e) => submit(e, createExpense)}>
              <label>
                {t("description")}
                <input required maxLength={120} {...textField("description")} />
              </label>
              <label>
                {t("iban")}
                <input
                  required
                  autoComplete="off"
                  maxLength={34}
                  {...textField("iban")}
                  placeholder="TR…"
                />
              </label>
              <div className="v3-form-row">
                <label>
                  {t("amountTry")}
                  <input
                    required
                    type="number"
                    min="1"
                    step=".01"
                    {...textField("amount")}
                  />
                </label>
                <label>
                  {t("usdcCap")}
                  <input
                    required
                    type="number"
                    min="0.0000001"
                    step=".0000001"
                    {...textField("cap")}
                  />
                </label>
              </div>
              <p className="v3-help">{t("quoteHelp")}</p>
              <p className="v3-help">{t("ibanPrivacy")}</p>
              <p className="payment-notice">{t("noticeText")}</p>
              <button className="button full" disabled={!!busy}>
                {t("submit")}
              </button>
            </form>
          )}
          {modal === "pay" && (
            <form
              onSubmit={(e) =>
                submit(e, () =>
                  payExpense(
                    treasury,
                    selectedExpense.current!.id,
                    form.iban,
                    progress,
                  ),
                )
              }
            >
              <p>
                <strong>
                  {selectedExpense.current?.description} ·{" "}
                  {selectedExpense.current &&
                    money(selectedExpense.current.amount_try)}
                </strong>
              </p>
              <label>
                {t("iban")}
                <input required {...textField("iban")} autoComplete="off" />
              </label>
              <p className="v3-help">{t("sandbox")}</p>
              <button className="button full" disabled={!!busy}>
                {t("pay")}
              </button>
            </form>
          )}
          {(modal === "transfer" || modal === "delegate") && (
            <form onSubmit={(e) => submit(e, seatAction)}>
              <p>
                {t("apartment")} {selectedSeat.current?.id}
              </p>
              <p className="payment-notice">
                {t(modal === "transfer" ? "transferHelp" : "delegateHelp")}
              </p>
              <label>
                {t(modal === "transfer" ? "newOwner" : "delegate")}
                <input
                  required={modal === "transfer"}
                  {...textField("address")}
                  placeholder="G… / C…"
                />
              </label>
              <button className="button full" disabled={!!busy}>
                {t("submit")}
              </button>
            </form>
          )}
          {modal === "decision" && (
            <form onSubmit={(e) => submit(e, makeDecision)}>
              <label>
                {t("decisionType")}
                <select {...textField("kind")}>
                  {(
                    [
                      "Budget",
                      "Recipient",
                      "Manager",
                      ...(isManager ? ["Recovery"] : []),
                    ] as BuildingKey[]
                  ).map((k) => (
                    <option value={k} key={k}>
                      {t(k)}
                    </option>
                  ))}
                </select>
              </label>
              {form.kind === "Budget" && (
                <>
                  <label>
                    {t("budget")} (TL)
                    <input
                      required
                      type="number"
                      min="0"
                      step=".01"
                      {...textField("amount")}
                    />
                  </label>
                  <label>
                    {t("usdcCap")}
                    <input
                      required
                      type="number"
                      min="0"
                      step=".0000001"
                      {...textField("cap")}
                    />
                  </label>
                  <p className="v3-help">
                    {t("period")}:{" "}
                    {data?.config.demo ? "10 min" : t("periodDays")}
                  </p>
                </>
              )}
              {form.kind === "Recipient" && (
                <>
                  <label>
                    {t("approvedRecipient")}
                    <input required maxLength={80} {...textField("label")} />
                  </label>
                  <label>
                    {t("iban")}
                    <input required {...textField("iban")} />
                  </label>
                  <label>
                    {t("recipientEnabled")}
                    <select {...textField("enabled")}>
                      <option value="true">{t("yes")}</option>
                      <option value="false">{t("no")}</option>
                    </select>
                  </label>
                </>
              )}
              {(form.kind === "Manager" || form.kind === "Recovery") && (
                <label>
                  {t(form.kind === "Manager" ? "manager" : "newOwner")}
                  <input
                    required
                    {...textField("address")}
                    placeholder="G… / C…"
                  />
                </label>
              )}
              {form.kind === "Recovery" && (
                <>
                  <label>
                    {t("apartment")}
                    <select {...textField("seat")}>
                      {data?.seats.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("document")}
                    <input
                      type="file"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file)
                          void file
                            .arrayBuffer()
                            .then((b) => crypto.subtle.digest("SHA-256", b))
                            .then((h) =>
                              setForm((f) => ({
                                ...f,
                                document: hex(new Uint8Array(h)),
                              })),
                            );
                      }}
                    />
                  </label>
                  <p className="v3-help">{t("recoveryHelp")}</p>
                </>
              )}
              {demoActive && (
                <p className="payment-notice">
                  <Sparkles size={17} />
                  {t("simulateVotes")}
                </p>
              )}
              <button className="button full" disabled={!!busy}>
                {t("submit")}
              </button>
            </form>
          )}
        </Dialog>
      )}
    </div>
  );
}
