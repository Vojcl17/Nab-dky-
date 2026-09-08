"use client";

import { useActionState } from "react";
import { createInquiryAction } from "../actions";
import { Alert, Field, LinkButton, SubmitButton } from "@/components/ui";

export function InquiryForm({ subjects }: { subjects: { id: string; name: string }[] }) {
  const [state, action] = useActionState(createInquiryAction, null);
  return (
    <form action={action} className="card max-w-3xl space-y-4 p-6">
      {state?.error && <Alert>{state.error}</Alert>}
      <Field label="Předmět poptávky">
        <input name="subject" className="input" required />
      </Field>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Jméno / firma">
          <input name="fromName" className="input" />
        </Field>
        <Field label="E-mail">
          <input name="fromEmail" type="email" className="input" />
        </Field>
        <Field label="Telefon">
          <input name="fromPhone" className="input" />
        </Field>
      </div>
      <Field label="Existující subjekt (nepovinné)">
        <select name="subjectId" className="input" defaultValue="">
          <option value="">— nepřiřazeno —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Text poptávky">
        <textarea name="bodyText" className="input" rows={6} />
      </Field>
      <Field label="Interní poznámka">
        <textarea name="note" className="input" rows={2} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton>Vytvořit poptávku</SubmitButton>
        <LinkButton href="/poptavky">Zpět</LinkButton>
      </div>
    </form>
  );
}
