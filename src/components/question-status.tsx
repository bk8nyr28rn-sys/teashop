import type { QuestionStatus } from "@/db/schema";
import type { Dictionary } from "@/i18n/dictionaries";
import { ui } from "./ui";

const STYLE: Record<QuestionStatus, string> = {
  awaiting_payment: ui.badgeWarn,
  open: ui.badgeAccent,
  answered: ui.badgeSuccess,
  expired: ui.badge,
  cancelled: ui.badge,
  refunded: ui.badge,
};

export function QuestionStatusBadge({ status, t }: { status: QuestionStatus; t: Dictionary["qa"] }) {
  return <span className={STYLE[status]}>{t.status[status]}</span>;
}
