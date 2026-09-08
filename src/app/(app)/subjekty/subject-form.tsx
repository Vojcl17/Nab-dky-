"use client";

import { useActionState, useState } from "react";
import { deleteSubjectAction, saveSubjectAction } from "./actions";
import { Alert, ConfirmButton, Field, LinkButton, SubmitButton } from "@/components/ui";
import { COUNTRY_NAMES } from "@/lib/format";

export interface SubjectFormValues {
  id?: string;
  name: string;
  ico: string;
  dic: string;
  street: string;
  city: string;
  zip: string;
  country: string;
  email: string;
  phone: string;
  contactPerson: string;
  note: string;
  vatPayer: boolean;
}

const EMPTY: SubjectFormValues = {
  name: "",
  ico: "",
  dic: "",
  street: "",
  city: "",
  zip: "",
  country: "CZ",
  email: "",
  phone: "",
  contactPerson: "",
  note: "",
  vatPayer: false,
};

export function SubjectForm({
  subject,
  canDelete,
  returnTo,
  initial,
  linkInquiryId,
}: {
  subject?: SubjectFormValues;
  canDelete?: boolean;
  returnTo?: string;
  initial?: Partial<SubjectFormValues>;
  linkInquiryId?: string;
}) {
  const [state, action] = useActionState(saveSubjectAction.bind(null, subject?.id ?? null), null);
  const [values, setValues] = useState<SubjectFormValues>(subject ?? { ...EMPTY, ...initial });
  const [aresState, setAresState] = useState<{ loading?: boolean; error?: string; filled?: boolean }>({});

  const set = (k: keyof SubjectFormValues, v: string | boolean) => setValues((s) => ({ ...s, [k]: v }));

  async function fillFromAres() {
    setAresState({ loading: true });
    try {
      const res = await fetch(`/api/ares?ico=${encodeURIComponent(values.ico)}`);
      const data = await res.json();
      if (!res.ok) {
        setAresState({ error: data.error ?? "Chyba ARES" });
        return;
      }
      setValues((s) => ({
        ...s,
        name: data.name || s.name,
        ico: data.ico || s.ico,
        dic: data.dic || s.dic,
        street: data.street || s.street,
        city: data.city || s.city,
        zip: data.zip || s.zip,
        country: data.country || s.country,
        vatPayer: !!data.dic,
      }));
      setAresState({ filled: true });
    } catch {
      setAresState({ error: "ARES není dostupný." });
    }
  }

  return (
    <form action={action} className="card max-w-3xl space-y-4 p-6">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      {linkInquiryId && <input type="hidden" name="linkInquiryId" value={linkInquiryId} />}
      <input type="hidden" name="aresFilled" value={aresState.filled ? "1" : "0"} />
      {state?.error && <Alert>{state.error}</Alert>}
      {aresState.error && <Alert>{aresState.error}</Alert>}
      {aresState.filled && <Alert kind="success">Údaje doplněny z ARES. Zkontrolujte a uložte.</Alert>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="IČO">
          <div className="flex gap-2">
            <input name="ico" className="input" value={values.ico} onChange={(e) => set("ico", e.target.value)} inputMode="numeric" />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={fillFromAres} disabled={aresState.loading || !values.ico}>
              {aresState.loading ? "Hledám…" : "Načíst z ARES"}
            </button>
          </div>
        </Field>
        <Field label="DIČ">
          <input name="dic" className="input" value={values.dic} onChange={(e) => set("dic", e.target.value)} />
        </Field>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input type="checkbox" name="vatPayer" checked={values.vatPayer} onChange={(e) => set("vatPayer", e.target.checked)} /> Plátce DPH
        </label>
      </div>
      <Field label="Název / jméno">
        <input name="name" className="input" value={values.name} onChange={(e) => set("name", e.target.value)} required />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Ulice a č.p." className="sm:col-span-2">
          <input name="street" className="input" value={values.street} onChange={(e) => set("street", e.target.value)} />
        </Field>
        <Field label="Město">
          <input name="city" className="input" value={values.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="PSČ">
          <input name="zip" className="input" value={values.zip} onChange={(e) => set("zip", e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Field label="Země">
          <select name="country" className="input" value={values.country} onChange={(e) => set("country", e.target.value)}>
            {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Kontaktní osoba">
          <input name="contactPerson" className="input" value={values.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} />
        </Field>
        <Field label="E-mail">
          <input name="email" type="email" className="input" value={values.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Telefon">
          <input name="phone" className="input" value={values.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="Poznámka (interní)">
        <textarea name="note" className="input" rows={2} value={values.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          <SubmitButton>Uložit</SubmitButton>
          <LinkButton href={returnTo || "/subjekty"}>Zpět</LinkButton>
        </div>
        {subject?.id && canDelete && (
          <ConfirmButton formAction={deleteSubjectAction} message="Opravdu smazat subjekt?" name="id" value={subject.id}>
            Smazat
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}
