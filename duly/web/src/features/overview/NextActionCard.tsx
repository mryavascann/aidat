import {
  ArrowDownLeft,
  ArrowRight,
  CheckCheck,
  Clock3,
  Landmark,
  Sparkles,
  Users,
} from "lucide-react";
import type { Messages } from "../../i18n/en";
import type { BankFlow, BankKind } from "../banking/model";

export function NextActionCard({
  t,
  connected,
  isMember,
  hasDemo,
  pendingPayment,
  needsApproval,
  readyExpense,
  walletBalance,
  dues,
  busy,
  onBank,
  onDemo,
  onExpenses,
  onWallet,
}: {
  t: Messages;
  connected: boolean;
  isMember: boolean;
  hasDemo: boolean;
  pendingPayment?: BankFlow;
  needsApproval: boolean;
  readyExpense: boolean;
  walletBalance: string | null;
  dues: string;
  busy: boolean;
  onBank: (kind: BankKind) => void;
  onDemo: () => void;
  onExpenses: () => void;
  onWallet: () => void;
}) {
  let title = t.nextTitle,
    body = t.nextBody,
    button = hasDemo ? t.resumeDemo : t.startDemo,
    action = onDemo,
    Icon = Sparkles;
  if (connected) {
    if (pendingPayment) {
      title = t.nextResume;
      body = t.resumeHelp;
      button = t.resume;
      action = () => onBank(pendingPayment.kind);
      Icon = Clock3;
    } else if (readyExpense || needsApproval) {
      title = readyExpense ? t.nextPay : t.nextApprove;
      body = readyExpense ? t.balanceNotice : t.quorumHint;
      button = t.viewAll;
      action = onExpenses;
      Icon = CheckCheck;
    } else if (isMember) {
      title = t.memberCard;
      body = t.duesHint;
      button = t.contribute;
      action = () => onBank("deposit");
      Icon = ArrowDownLeft;
    } else if (walletBalance !== null && Number(walletBalance) >= 1) {
      title = t.nextWithdraw;
      body = t.withdrawBody;
      button = t.withdraw;
      action = () => onBank("withdraw");
      Icon = Landmark;
    } else {
      title = t.nextReceive;
      body = t.nextReceiveBody;
      button = t.viewWallet;
      action = onWallet;
      Icon = Users;
    }
  }
  return (
    <section className="next-card">
      <div className="next-card-top">
        <div className="next-icon">
          <Icon size={22} />
        </div>
        <span>{t.nextAction}</span>
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
      {connected &&
        isMember &&
        !pendingPayment &&
        !needsApproval &&
        !readyExpense && <div className="dues-amount">{dues}</div>}
      {!connected && (
        <ol className="journey">
          {[t.step1, t.step2, t.step3].map((step, i) => (
            <li key={step}>
              <span>{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      )}
      <button className="button full" disabled={busy} onClick={action}>
        {button}
        <ArrowRight size={17} />
      </button>
    </section>
  );
}
