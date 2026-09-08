"use client";

import { useActionState } from "react";
import { saveSettingsAction } from "./actions";
import { Alert, Field, SubmitButton } from "@/components/ui";
import { COUNTRY_NAMES, VAT_RATES } from "@/lib/format";

type Values = Record<string, string | number | boolean>;

export function SettingsForm({ s }: { s: Values }) {
  const [state, action] = useActionState(saveSettingsAction, null);
  const str = (k: string) => String(s[k] ?? "");
  return (
    <form action={action} className="space-y-6">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.success && <Alert kind="success">{state.success}</Alert>}

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Údaje firmy (dodavatel)</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Název firmy / jméno" className="md:col-span-3">
            <input name="name" className="input" defaultValue={str("name")} required />
          </Field>
          <Field label="IČO">
            <input name="ico" className="input" defaultValue={str("ico")} />
          </Field>
          <Field label="DIČ">
            <input name="dic" className="input" defaultValue={str("dic")} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="vatPayer" defaultChecked={!!s.vatPayer} /> Plátce DPH
          </label>
          <Field label="Ulice a č.p." className="md:col-span-1">
            <input name="street" className="input" defaultValue={str("street")} />
          </Field>
          <Field label="Město">
            <input name="city" className="input" defaultValue={str("city")} />
          </Field>
          <Field label="PSČ">
            <input name="zip" className="input" defaultValue={str("zip")} />
          </Field>
          <Field label="Země">
            <select name="country" className="input" defaultValue={str("country") || "CZ"}>
              {Object.entries(COUNTRY_NAMES).map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label="E-mail">
            <input name="email" className="input" defaultValue={str("email")} />
          </Field>
          <Field label="Telefon">
            <input name="phone" className="input" defaultValue={str("phone")} />
          </Field>
          <Field label="Web">
            <input name="web" className="input" defaultValue={str("web")} />
          </Field>
          <Field label="Zápis v rejstříku (patička dokladů)" className="md:col-span-2" hint="např. Zapsána v OR vedeném Městským soudem v Praze, oddíl C, vložka 12345">
            <input name="registrationNote" className="input" defaultValue={str("registrationNote")} />
          </Field>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Bankovní spojení</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Číslo účtu" hint="včetně předčíslí, např. 19-123456789">
            <input name="bankAccount" className="input" defaultValue={str("bankAccount")} />
          </Field>
          <Field label="Kód banky">
            <input name="bankCode" className="input" defaultValue={str("bankCode")} placeholder="2010" />
          </Field>
          <Field label="IBAN" hint="Nepovinné, dopočítá se z účtu">
            <input name="iban" className="input" defaultValue={str("iban")} />
          </Field>
          <Field label="BIC / SWIFT">
            <input name="bic" className="input" defaultValue={str("bic")} placeholder="FIOBCZPPXXX" />
          </Field>
        </div>
        <Field label="Fio API token" hint="Vygenerujete v internetovém bankovnictví Fio: Nastavení → API. Stačí oprávnění „pouze sledovat“.">
          <input name="fioToken" className="input font-mono text-xs" defaultValue={str("fioToken")} autoComplete="off" />
        </Field>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Doklady</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Field label="Výchozí sazba DPH">
            <select name="defaultVatRate" className="input" defaultValue={String(s.defaultVatRate ?? 21)}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r} %
                </option>
              ))}
            </select>
          </Field>
          <Field label="Splatnost faktur (dní)">
            <input name="defaultDueDays" type="number" className="input" defaultValue={String(s.defaultDueDays ?? 14)} />
          </Field>
          <Field label="Platnost nabídek (dní)">
            <input name="offerValidityDays" type="number" className="input" defaultValue={String(s.offerValidityDays ?? 30)} />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" name="roundCzkTotals" defaultChecked={!!s.roundCzkTotals} /> Zaokrouhlovat CZK faktury na koruny
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Field label="Číslování nabídek">
            <input name="offerNumberFormat" className="input font-mono" defaultValue={str("offerNumberFormat")} />
          </Field>
          <Field label="Faktury">
            <input name="invoiceNumberFormat" className="input font-mono" defaultValue={str("invoiceNumberFormat")} />
          </Field>
          <Field label="Zálohové faktury">
            <input name="advanceNumberFormat" className="input font-mono" defaultValue={str("advanceNumberFormat")} />
          </Field>
          <Field label="Daňové doklady k platbě">
            <input name="taxDocNumberFormat" className="input font-mono" defaultValue={str("taxDocNumberFormat")} />
          </Field>
          <Field label="Dobropisy">
            <input name="creditNoteNumberFormat" className="input font-mono" defaultValue={str("creditNoteNumberFormat")} />
          </Field>
        </div>
        <p className="text-xs text-slate-500">
          Zástupné znaky: <code>{"{YYYY}"}</code> rok, <code>{"{YY}"}</code> dvoumístný rok, <code>{"{MM}"}</code> měsíc, <code>{"{NNNN}"}</code> pořadové číslo (počet N = počet míst). Číselná řada se každý rok resetuje. Variabilní symbol faktury tvoří číslice z čísla dokladu.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Výchozí text na nabídce">
            <textarea name="offerFooterNote" className="input" rows={3} defaultValue={str("offerFooterNote")} />
          </Field>
          <Field label="Výchozí text na faktuře">
            <textarea name="invoiceFooterNote" className="input" rows={3} defaultValue={str("invoiceFooterNote")} />
          </Field>
        </div>
      </section>

      <SubmitButton>Uložit nastavení</SubmitButton>
    </form>
  );
}
