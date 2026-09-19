import { ArrowDownLeft, ArrowUpRight, Clock3, ReceiptText } from "lucide-react";
import type { Messages } from "../../i18n/en";
import { bankPhase, type BankFlow } from "./model";

export function PaymentHistory({
  flows,
  t,
  locale,
  busy,
  connected,
  onOpen,
}: {
  flows: BankFlow[];
  t: Messages;
  locale: string;
  busy: boolean;
  connected: boolean;
  onOpen: (flow: BankFlow) => void;
}) {
  return (
    <section className="card payment-history">
      <div className="section-heading">
        <div>
          <h2>{t.paymentHistory}</h2>
          <p>{t.paymentHistoryHint}</p>
        </div>
        <span className="history-local">
          <Clock3 size={14} />
          {t.localOnly}
        </span>
      </div>
      {flows.length ? (
        <div className="payment-list">
          {flows.map((flow) => {
            const phase = bankPhase(flow);
            return (
              <article className="payment-row" key={flow.order.id}>
                <div className={`payment-icon ${flow.kind}`}>
                  {flow.kind === "deposit" ? (
                    <ArrowDownLeft size={20} />
                  ) : (
                    <ArrowUpRight size={20} />
                  )}
                </div>
                <div className="payment-summary">
                  <h3>
                    {flow.kind === "deposit" ? t.depositTitle : t.withdrawTitle}
                  </h3>
                  <time dateTime={flow.createdAt}>
                    {new Date(flow.createdAt).toLocaleString(locale, {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <div className="payment-row-amount">
                  <strong>
                    {flow.amount} {flow.kind === "deposit" ? "TRY" : "USDC"}
                  </strong>
                  <span className={`status payment-${phase}`}>
                    {t[`payment_${phase}`]}
                  </span>
                </div>
                <button
                  className="button secondary small"
                  disabled={busy}
                  onClick={() => onOpen(flow)}
                >
                  {flow.complete ? t.viewPayment : t.resume}
                  <ArrowRightIcon complete={!!flow.complete} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="payment-empty">
          <ReceiptText size={24} />
          <div>
            <h3>{connected ? t.noPayments : t.paymentHistoryConnect}</h3>
            <p>{t.paymentHistoryEmpty}</p>
          </div>
        </div>
      )}
    </section>
  );
}
function ArrowRightIcon({ complete }: { complete: boolean }) {
  return complete ? <ReceiptText size={15} /> : <ArrowUpRight size={15} />;
}
