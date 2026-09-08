"use client";

import { useActionState } from "react";
import { createInvitationAction, resetPasswordAction } from "../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

const ROLES = ["ADMIN", "SALES", "ACCOUNTANT", "VIEWER"] as const;

export function InviteForm() {
  const [state, action] = useActionState(createInvitationAction, null);
  return (
    <form action={action} className="space-y-3">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Field label="E-mail">
          <input name="email" type="email" className="input" required />
        </Field>
        <Field label="Jméno">
          <input name="name" className="input" />
        </Field>
        <Field label="Role">
          <select name="role" className="input" defaultValue="SALES">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end">
          <SubmitButton pendingText="Vytvářím…">Vytvořit pozvánku</SubmitButton>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-1 text-xs text-slate-500 md:grid-cols-4">
        {ROLES.map((r) => (
          <li key={r}>
            <b>{ROLE_LABELS[r]}</b> – {ROLE_DESCRIPTIONS[r]}
          </li>
        ))}
      </ul>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="id" value={userId} />
      <input name="password" type="password" className="input max-w-[10rem] py-1 text-xs" placeholder="Nové heslo" minLength={8} required />
      <SubmitButton className="btn-secondary btn-sm" pendingText="…">
        Nastavit
      </SubmitButton>
      {state?.error && <span className="text-xs text-rose-600">{state.error}</span>}
      {state?.success && <span className="text-xs text-emerald-600">{state.success}</span>}
    </form>
  );
}

export function CopyLink({ url }: { url: string }) {
  return (
    <button type="button" className="btn-secondary btn-sm" onClick={() => navigator.clipboard?.writeText(url)} title={url}>
      Kopírovat odkaz
    </button>
  );
}
