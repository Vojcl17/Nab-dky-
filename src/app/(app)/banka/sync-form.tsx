"use client";

import { useActionState, useState } from "react";
import { setFioPointerAction, syncFioAction } from "./actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function SyncForm({ hasToken }: { hasToken: boolean }) {
  const [state, action] = useActionState(syncFioAction, null);
  const [pointerState, pointerAction] = useActionState(setFioPointerAction, null);
  const [advanced, setAdvanced] = useState(false);
  return (
    <div className="space-y-3">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      {pointerState?.error && <Alert>{pointerState.error}</Alert>}
      {pointerState?.success && <Alert kind="success">{pointerState.success}</Alert>}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <SubmitButton className="btn-primary" pendingText="Stahuji…" disabled={!hasToken}>
          Stáhnout nové pohyby z Fio
        </SubmitButton>
        <button type="button" className="btn-secondary" onClick={() => setAdvanced((v) => !v)}>
          {advanced ? "Skrýt" : "Import za období…"}
        </button>
        {advanced && (
          <>
            <Field label="Od">
              <input type="date" name="from" className="input" required />
            </Field>
            <Field label="Do">
              <input type="date" name="to" className="input" required />
            </Field>
            <SubmitButton className="btn-secondary" pendingText="Stahuji…" disabled={!hasToken}>
              Importovat období
            </SubmitButton>
          </>
        )}
      </form>
      {advanced && (
        <form action={pointerAction} className="flex flex-wrap items-end gap-2 text-sm">
          <Field label="Nastavit zarážku Fio (další stahování začne od data)">
            <input type="date" name="date" className="input" required />
          </Field>
          <SubmitButton className="btn-secondary" pendingText="Nastavuji…" disabled={!hasToken}>
            Nastavit zarážku
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
