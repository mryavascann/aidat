import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  CircleAlert,
  ExternalLink,
  Landmark,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { Messages } from "../../i18n/en";
import { txUrl } from "../../lib/chain";
import { bankPhase, bankStep, type BankFlow, type BankKind } from "./model";

interface Props {
  kind: BankKind;
  flow: BankFlow | null;
  t: Messages;
  locale: string;
  money: (amount: number) => string;
  busy: boolean;
  isMember: boolean;
  balance: string;
  amount: string;
  onAmount: (value: string) => void;
  onQuote: (event: FormEvent) => void;
  onFinish: () => void;
  onCheck: () => void;
  onNew: () => void;
}

export function BankForm({
  kind,
  flow,
  t,
  locale,
  money,
  busy,
  isMember,
  balance,
  amount,
  onAmount,
  onQuote,
  onFinish,
  onCheck,
  onNew,
}: Props) {
  const deposit = kind === "deposit";
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const phase = flow ? bankPhase(flow, now) : "ready";
  const blocked = phase === "expired" || phase === "attention";
  const labels = [
    t.stageQuote,
    deposit ? t.stageBank : t.stageTransfer,
    deposit ? t.stageReserve : t.stagePayout,
  ];
  const step = flow ? bankStep(flow) : 0;
  return (
    <div className="bank-flow">
      <ol className="payment-steps" aria-label={t.paymentProgress}>
        {labels.map((label, index) => (
          <li
            key={label}
            className={step > index ? "done" : step === index ? "current" : ""}
            aria-current={step === index ? "step" : undefined}
          >
            <span>{step > index ? <Check size={14} /> : index + 1}</span>
            <strong>{label}</strong>
          </li>
        ))}
      </ol>
      {flow?.complete ? (
        <div className="bank-complete">
          <div className="success-icon">
            <CheckCheck size={32} />
          </div>
          <h3>{t.complete}</h3>
          <p>{deposit ? t.contributionComplete : t.withdrawComplete}</p>
          <div className="confirmed-amount">
            {deposit
              ? `${flow.settlement.amount_out} USDC`
              : money(Number(flow.settlement.amount_out))}
          </div>
          {!deposit && (
            <p>
              {t.bankReference}:{" "}
              <strong>{flow.settlement.external_transaction_id}</strong>
            </p>
          )}
          <a
            className="button secondary"
            href={txUrl(flow.receipt!)}
            target="_blank"
            rel="noreferrer"
          >
            {t.receipt}
            <ExternalLink size={15} />
          </a>
          <button className="text-button" onClick={onNew}>
            {t.newPayment}
          </button>
        </div>
      ) : flow ? (
        <div className="bank-details">
          <div
            className={`payment-notice ${blocked ? "attention" : ""}`}
            role="status"
          >
            {blocked ? <CircleAlert size={20} /> : <Landmark size={20} />}
            <div>
              <strong>{t[`payment_${phase}`]}</strong>
              <p>
                {phase === "expired"
                  ? t.expiredHelp
                  : phase === "attention"
                    ? t.attentionHelp
                    : phase === "contribute"
                      ? t.contributeHelp
                      : t.resumeHelp}
              </p>
            </div>
          </div>
          <dl className="quote-details">
            <div>
              <dt>{t.sendAmount}</dt>
              <dd>
                {deposit
                  ? money(Number(flow.order.quote.sell_amount))
                  : `${flow.order.quote.sell_amount} USDC`}
              </dd>
            </div>
            <div>
              <dt>{deposit ? t.receives : t.bankGets}</dt>
              <dd>
                {deposit
                  ? `${flow.order.quote.buy_amount} USDC`
                  : money(Number(flow.order.quote.buy_amount))}
              </dd>
            </div>
            <div>
              <dt>{t.quoteExpires}</dt>
              <dd>
                {new Date(flow.order.quote.expires_at).toLocaleString(locale, {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
          </dl>
          {deposit && !flow.settlement && (
            <div className="transfer-instructions">
              {(flow.order.instructions?.bank_account_number?.value ??
                flow.order.iban) && (
                <>
                  <small>{t.iban}</small>
                  <strong>
                    {flow.order.instructions?.bank_account_number?.value ??
                      flow.order.iban}
                  </strong>
                </>
              )}
              <small>{t.reference}</small>
              <code>
                {flow.order.instructions?.external_transfer_memo?.value ??
                  flow.order.id}
              </code>
            </div>
          )}
          <p className="note">{deposit ? t.bankWarning : t.bankFee}</p>
          {!blocked && (
            <button className="button full" disabled={busy} onClick={onFinish}>
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <ArrowUpRight size={17} />
              )}
              {phase === "contribute" || phase === "processing"
                ? t.resume
                : deposit
                  ? t.simulate
                  : t.confirmWithdraw}
            </button>
          )}
          <button
            className={`button full ${blocked ? "" : "secondary"}`}
            disabled={busy}
            onClick={onCheck}
          >
            <RefreshCw size={16} />
            {t.checkPayment}
          </button>
          {flow.receipt && (
            <a
              className="text-button"
              href={txUrl(flow.receipt)}
              target="_blank"
              rel="noreferrer"
            >
              {t.receipt}
              <ExternalLink size={14} />
            </a>
          )}
          <details className="payment-reference">
            <summary>{t.savedReference}</summary>
            <code>{flow.order.id}</code>
            {flow.anchorStatus && <p>{flow.anchorStatus}</p>}
            {flow.checkedAt && (
              <p>
                {t.syncTime} {new Date(flow.checkedAt).toLocaleString(locale)}
              </p>
            )}
          </details>
        </div>
      ) : (
        <form onSubmit={onQuote}>
          <p>{deposit ? t.depositBody : t.withdrawBody}</p>
          <label>
            {deposit ? t.amountTRY : t.amountUSDC}
            <div className="amount-input">
              <span>{deposit ? "₺" : "$"}</span>
              <input
                autoFocus
                required
                inputMode="decimal"
                type="number"
                min={deposit ? "50" : "1"}
                max={deposit ? "3000" : undefined}
                step={deposit ? "0.01" : "0.0000001"}
                value={amount}
                onChange={(e) => onAmount(e.target.value)}
                disabled={busy}
              />
              <span>{deposit ? "TRY" : "USDC"}</span>
            </div>
          </label>
          <p className="field-hint">
            {deposit
              ? t.depositLimits
              : `${t.minimumWithdraw} ${t.walletBalance}: ${balance} USDC`}
          </p>
          <button
            className="button full"
            disabled={busy || (deposit && !isMember)}
          >
            {t[deposit ? "quote" : "withdrawalQuote"]}
            <ArrowRight size={17} />
          </button>
        </form>
      )}
    </div>
  );
}
