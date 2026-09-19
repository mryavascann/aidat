import { useState } from "react";
import { Check, Clock3, Users } from "lucide-react";
import type { BuildingData } from "../../lib/building";
import {
  duesPeriod,
  duesPeriodRange,
  duesReport,
  type DuesLedger,
} from "../../lib/dues";
import { buildingCopy } from "../../i18n/building";
import { short, txUrl } from "../../lib/chain";

export function DuesOverview({
  data,
  ledger,
  error,
  lang,
  isManager,
}: {
  data: BuildingData;
  ledger: DuesLedger | null;
  error: string;
  lang: "tr" | "en";
  isManager: boolean;
}) {
  const t = buildingCopy(lang);
  const [selected, setSelected] = useState<number | null>(null);
  const [onlyUnpaid, setOnlyUnpaid] = useState(false);
  const current = duesPeriod(
    data.config,
    Math.floor(Date.now() / 1000),
    data.ledger,
  );
  const period = selected === null ? current : Math.min(selected, current);
  const money = (value: bigint) =>
    new Intl.NumberFormat(lang === "tr" ? "tr-TR" : "en-GB", {
      style: "currency",
      currency: "TRY",
    }).format(Number(value) / 100);
  const date = (value: number) =>
    new Date(value * 1000).toLocaleDateString(
      lang === "tr" ? "tr-TR" : "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/Istanbul",
      },
    );
  const range = duesPeriodRange(data.config, period);
  const rows = ledger
    ? duesReport(data.config, data.seats, ledger.payments, current, period)
    : [];
  const filtered = rows.filter(
    (row) => !onlyUnpaid || row.status === "partial" || row.status === "unpaid",
  );
  const incomplete = rows.some((row) => row.unmatched);
  return (
    <section
      className="card v3-dues-tracker"
      aria-labelledby="dues-tracker-title"
    >
      <header className="v3-tracker-heading">
        <div>
          <span className="eyebrow">
            {isManager ? t("managerView") : t("sharedDues")}
          </span>
          <h2 id="dues-tracker-title">{t("duesTracking")}</h2>
        </div>
        <label>
          {t("billingPeriod")}
          <select
            aria-label={t("billingPeriod")}
            value={period}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {Array.from({ length: current + 1 }, (_, i) => current - i).map(
              (p) => {
                const r = duesPeriodRange(data.config, p);
                return (
                  <option key={p} value={p}>
                    {p + 1}. {t("periodLabel")} · {date(r.start)}
                    {p === current ? ` · ${t("currentPeriod")}` : ""}
                  </option>
                );
              },
            )}
          </select>
        </label>
      </header>
      <p className="v3-help">
        {date(range.start)} – {date(range.end - 1)} · {t("perApartment")}:{" "}
        <strong>{money(data.config.dues_try)}</strong> ·{" "}
        {data.config.demo ? t("demoBilling") : t("billingCycle")}
      </p>
      {!ledger ? (
        <p className="payment-notice" role="status">
          {error ? t("ledgerUnavailable") : t("ledgerLoading")}
        </p>
      ) : (
        <>
          <div className="v3-dues-stats">
            <div>
              <Check size={18} />
              <span>{t("paidApartments")}</span>
              <strong>
                {rows.filter((r) => r.status === "paid").length}/{rows.length}
              </strong>
            </div>
            <div>
              <Users size={18} />
              <span>{t("unpaidApartments")}</span>
              <strong>
                {
                  rows.filter((r) => ["partial", "unpaid"].includes(r.status))
                    .length
                }
              </strong>
            </div>
            <div>
              <Clock3 size={18} />
              <span>{t("remainingThisPeriod")}</span>
              <strong>
                {incomplete
                  ? "—"
                  : money(rows.reduce((sum, r) => sum + r.remaining, 0n))}
              </strong>
            </div>
          </div>
          {incomplete && <p className="payment-notice">{t("unmatchedDues")}</p>}
          <label className="v3-unpaid-filter">
            <input
              type="checkbox"
              checked={onlyUnpaid}
              onChange={(e) => setOnlyUnpaid(e.target.checked)}
            />
            {t("onlyUnpaid")}
          </label>
          <div
            className="v3-dues-table-wrap"
            tabIndex={0}
            role="region"
            aria-labelledby="dues-tracker-title"
          >
            <table className="v3-dues-table">
              <thead>
                <tr>
                  <th scope="col">{t("apartment")}</th>
                  <th scope="col">{t("duesStatus")}</th>
                  <th scope="col">{t("paidThisPeriod")}</th>
                  <th scope="col">{t("remainingThisPeriod")}</th>
                  <th scope="col">{t("totalArrears")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} data-seat={row.id}>
                    <th scope="row">
                      {t("apartment")} {row.id}
                      <small className="mono">{short(row.owner)}</small>
                    </th>
                    <td>
                      <span className={`v3-tag v3-dues-${row.status}`}>
                        {t(
                          (
                            {
                              paid: "duesPaid",
                              partial: "duesPartial",
                              unpaid: "duesUnpaid",
                              review: "duesReview",
                            } as const
                          )[
                            row.status as
                              "paid" | "partial" | "unpaid" | "review"
                          ],
                        )}
                      </span>
                      {row.advance > 0n && !row.unmatched && (
                        <small>
                          {t("advanceCredit")}: {money(row.advance)}
                        </small>
                      )}
                    </td>
                    <td>{row.unmatched ? "—" : money(row.paid)}</td>
                    <td>{row.unmatched ? "—" : money(row.remaining)}</td>
                    <td>{row.unmatched ? "—" : money(row.arrears)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && (
            <p className="v3-help">{t("noUnpaidApartments")}</p>
          )}
          <p className="v3-help">{t("allocationHelp")}</p>
          {ledger.payments.length > 0 && (
            <details className="v3-dues-receipts">
              <summary>{t("recordedDues")}</summary>
              {ledger.payments.slice(0, 50).map((payment) => (
                <p key={payment.hash}>
                  <span>
                    {t("apartment")} {payment.seat} ·{" "}
                    {money(BigInt(payment.amountTry))} · {payment.method} ·{" "}
                    {date(payment.paidAt)}
                  </span>
                  <a
                    href={txUrl(payment.hash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("receipt")} ↗
                  </a>
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  );
}
