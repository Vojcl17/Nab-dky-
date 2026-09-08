"use client";

import { useActionState } from "react";
import { updateInquiryAction } from "../actions";
import { Alert, Field, SubmitButton } from "@/components/ui";

export function InquiryEditForm({
  inquiryId,
  subjectId,
  assignedToId,
  note,
  subjects,
  users,
}: {
  inquiryId: string;
  subjectId: string;
  assignedToId: string;
  note: string;
  subjects: { id: string; name: string }[];
  users: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(updateInquiryAction, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={inquiryId} />
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}
      <Field label="Odběratel (subjekt)">
        <select name="subjectId" className="input" defaultValue={subjectId}>
          <option value="">— nepřiřazeno —</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Řeší">
        <select name="assignedToId" className="input" defaultValue={assignedToId}>
          <option value="">— nikdo —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Interní poznámka">
        <textarea name="note" className="input" rows={3} defaultValue={note} />
      </Field>
      <SubmitButton className="btn-secondary">Uložit</SubmitButton>
    </form>
  );
}
