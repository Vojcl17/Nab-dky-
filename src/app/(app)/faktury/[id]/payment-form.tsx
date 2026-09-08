"use client";

import { useActionState } from "react";
import { addPaymentAction } from "../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function PaymentForm({ invoiceId, suggestedAmount, currency, today }: { invoiceId: string; suggestedAmount: string; currency: string; today: string }) {
  const [state, action] = useActionState(addPaymentAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <div className="grid grid-cols-3 gap-2">
        <Field label={`Částka (${currency})`}>
          <input name="amount" className="input" inputMode="decimal" defaultValue={suggestedAmount} required />
        </Field>
        <Field label="Datum">
          <input name="date" type="date" className="input" defaultValue={today} required />
        </Field>
        <Field label="Poznámka">
          <input name="note" className="input" placeholder="hotově, převodem…" />
        </Field>
      </div>
      <SubmitButton className="btn-secondary">Přidat úhradu</SubmitButton>
    </form>
  );
}
