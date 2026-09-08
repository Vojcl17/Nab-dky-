"use client";

import { useActionState } from "react";
import { setupAction } from "../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function SetupForm() {
  const [state, action] = useActionState(setupAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">První spuštění</h1>
        <p className="text-sm text-slate-500">Vytvořte účet administrátora. Další uživatele pozvete později v nastavení.</p>
      </div>
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Název firmy">
        <input name="companyName" className="input" placeholder="Moje firma s.r.o." />
      </Field>
      <Field label="Vaše jméno">
        <input name="name" className="input" required />
      </Field>
      <Field label="E-mail">
        <input name="email" type="email" className="input" required autoComplete="email" />
      </Field>
      <Field label="Heslo" hint="Alespoň 8 znaků">
        <input name="password" type="password" className="input" required minLength={8} autoComplete="new-password" />
      </Field>
      <SubmitButton className="btn-primary w-full" pendingText="Vytvářím…">
        Vytvořit účet a pokračovat
      </SubmitButton>
    </form>
  );
}
