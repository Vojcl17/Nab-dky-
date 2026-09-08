"use client";

import { useActionState } from "react";
import { loginAction } from "../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      <h1 className="text-lg font-semibold">Přihlášení</h1>
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="E-mail">
        <input name="email" type="email" className="input" required autoComplete="email" autoFocus />
      </Field>
      <Field label="Heslo">
        <input name="password" type="password" className="input" required autoComplete="current-password" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Přihlašuji…">
        Přihlásit se
      </SubmitButton>
    </form>
  );
}
