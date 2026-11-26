"use client";

import { useActionState } from "react";
import type { Dictionary } from "@/i18n/dictionaries";
import { ui } from "@/components/ui";
import { createInviteAction } from "./actions";

export function InvitePanel({ locale, t }: { locale: string; t: Dictionary["home"] }) {
  const [state, action, pending] = useActionState(createInviteAction.bind(null, locale), undefined);
  return (
    <form action={action} className="space-y-2">
      <button className={ui.buttonGhost} disabled={pending}>
        {t.inviteCreate}
      </button>
      {state?.code && (
        <p className="font-mono text-sm" data-testid="invite-code">
          {t.inviteCreated.replace("{code}", state.code)}
        </p>
      )}
      {state?.error && <p className={ui.error}>{t.inviteLocked}</p>}
    </form>
  );
}
