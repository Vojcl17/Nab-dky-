"use client";

import { useActionState } from "react";
import { syncMailAction } from "./actions";
import { Alert, SubmitButton } from "@/components/ui";

export function SyncMailForm({ configured }: { configured: boolean }) {
  const [state, action] = useActionState(syncMailAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton className="btn-secondary" pendingText="Stahuji e-maily…" disabled={!configured} title={configured ? "" : "Nastavte e-mailovou schránku v Nastavení"}>
        Stáhnout nové e-maily
      </SubmitButton>
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
    </form>
  );
}
