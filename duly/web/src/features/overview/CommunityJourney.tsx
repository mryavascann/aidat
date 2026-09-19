import { ArrowDownLeft, CheckCheck, ReceiptText } from "lucide-react";
import type { Messages } from "../../i18n/en";

export function CommunityJourney({
  t,
  onBank,
  onExpenses,
  onProofs,
}: {
  t: Messages;
  onBank: () => void;
  onExpenses: () => void;
  onProofs: () => void;
}) {
  const steps = [
    {
      Icon: ArrowDownLeft,
      title: t.journeyCollect,
      body: t.journeyCollectBody,
      action: onBank,
    },
    {
      Icon: CheckCheck,
      title: t.journeyDecide,
      body: t.journeyDecideBody,
      action: onExpenses,
    },
    {
      Icon: ReceiptText,
      title: t.journeyVerify,
      body: t.journeyVerifyBody,
      action: onProofs,
    },
  ];
  return (
    <section className="community-journey" aria-label={t.howDulyWorks}>
      {steps.map(({ Icon, title, body, action }, index) => (
        <button key={title} onClick={action}>
          <div className="journey-icon">
            <Icon size={20} />
            <span>0{index + 1}</span>
          </div>
          <div>
            <strong>{title}</strong>
            <p>{body}</p>
          </div>
        </button>
      ))}
    </section>
  );
}
