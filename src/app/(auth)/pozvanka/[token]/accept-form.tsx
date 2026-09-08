"use client";

import { useActionState } from "react";
import { acceptInvitationAction } from "../../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function AcceptForm({ token, email, name, roleLabel }: { token: string; email: string; name: string; roleLabel: string }) {
  const [state, action] = useActionState(acceptInvitationAction, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <h1 className="text-lg font-semibold">Dokončení registrace</h1>
        <p className="text-sm text-slate-500">
          Účet <b>{email}</b> s rolí <b>{roleLabel}</b>. Zvolte si heslo.
        </p>
      </div>
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Jméno">
        <input name="name" className="input" defaultValue={name} required />
      </Field>
      <Field label="Heslo" hint="Alespoň 8 znaků">
        <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Vytvářím…">
        Vytvořit účet
      </SubmitButton>
    </form>
  );
}
