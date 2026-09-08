"use client";

import { useActionState } from "react";
import { deletePriceItemAction, savePriceItemAction } from "./actions";
import { Alert, ConfirmButton, Field, LinkButton, SubmitButton } from "@/components/ui";
import { VAT_RATES } from "@/lib/format";

export interface PriceItemFormValues {
  id?: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  priceCzk: string;
  priceEur: string;
  vatRate: number;
  active: boolean;
}

export function PriceItemForm({ item, canDelete }: { item?: PriceItemFormValues; canDelete?: boolean }) {
  const [state, action] = useActionState(savePriceItemAction.bind(null, item?.id ?? null), null);
  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Kód">
          <input name="code" className="input" defaultValue={item?.code ?? ""} />
        </Field>
        <Field label="Název" className="sm:col-span-2">
          <input name="name" className="input" defaultValue={item?.name ?? ""} required />
        </Field>
      </div>
      <Field label="Popis">
        <textarea name="description" className="input" rows={2} defaultValue={item?.description ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Field label="Měrná jednotka">
          <input name="unit" className="input" defaultValue={item?.unit ?? "ks"} />
        </Field>
        <Field label="Cena bez DPH (CZK)">
          <input name="priceCzk" className="input" inputMode="decimal" defaultValue={item?.priceCzk ?? ""} required />
        </Field>
        <Field label="Cena bez DPH (EUR)" hint="Nepovinné, jinak přepočet kurzem">
          <input name="priceEur" className="input" inputMode="decimal" defaultValue={item?.priceEur ?? ""} />
        </Field>
        <Field label="Sazba DPH">
          <select name="vatRate" className="input" defaultValue={item?.vatRate ?? 21}>
            {VAT_RATES.map((r) => (
              <option key={r} value={r}>
                {r} %
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> Aktivní (nabízí se při tvorbě dokladů)
      </label>
      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <div className="flex gap-2">
          <SubmitButton>Uložit</SubmitButton>
          <LinkButton href="/cenik">Zpět</LinkButton>
        </div>
        {item?.id && canDelete && (
          <ConfirmButton formAction={deletePriceItemAction} message="Opravdu smazat položku? Pokud je použita v dokladech, bude jen deaktivována." name="id" value={item.id}>
            Smazat
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}
