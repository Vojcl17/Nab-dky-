"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { computeTotals } from "@/lib/totals";
import { formatMoney, VAT_RATES } from "@/lib/format";
import type { EditorItem } from "@/lib/documents";
import type { FormState } from "@/lib/action-state";
import { Alert, Field, SubmitButton } from "@/components/ui";

export interface EditorSubject {
  id: string;
  name: string;
  ico: string;
  city: string;
}

export interface EditorPriceItem {
  id: string;
  code: string;
  name: string;
  description: string;
  unit: string;
  priceCzk: string;
  priceEur: string | null;
  vatRate: number;
}

export interface EditorSettings {
  vatPayer: boolean;
  defaultVatRate: number;
  roundCzkTotals: boolean;
}

export interface EditorHeader {
  subjectId: string;
  inquiryId?: string;
  title: string;
  issueDate: string;
  validUntil: string;
  dueDate: string;
  taxDate: string;
  currency: "CZK" | "EUR";
  exchangeRate: string;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: string;
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  roundTotal: boolean;
  constantSymbol: string;
  note: string;
  internalNote: string;
  type: "INVOICE" | "ADVANCE" | "TAX_DOCUMENT" | "CREDIT_NOTE";
}

export interface DocumentEditorProps {
  mode: "offer" | "invoice";
  header: EditorHeader;
  items: EditorItem[];
  subjects: EditorSubject[];
  priceItems: EditorPriceItem[];
  settings: EditorSettings;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancelHref: string;
  returnTo: string;
  typeLocked?: boolean;
  submitLabel?: string;
}

let keyCounter = 1000;
const newKey = () => `n${keyCounter++}`;

export function DocumentEditor({
  mode,
  header: initialHeader,
  items: initialItems,
  subjects,
  priceItems,
  settings,
  action,
  cancelHref,
  returnTo,
  typeLocked,
  submitLabel = "Uložit",
}: DocumentEditorProps) {
  const [state, formAction] = useActionState(action, null);
  const [h, setH] = useState<EditorHeader>(initialHeader);
  const [items, setItems] = useState<EditorItem[]>(initialItems.length ? initialItems : []);
  const [rateInfo, setRateInfo] = useState<string>("");
  const [pickerId, setPickerId] = useState("");
  const skipRateFetch = useRef(initialHeader.currency === "EUR" && Number(initialHeader.exchangeRate) > 1);

  const setHeader = <K extends keyof EditorHeader>(k: K, v: EditorHeader[K]) => setH((s) => ({ ...s, [k]: v }));

  const vatApplicable = settings.vatPayer;

  const totals = useMemo(
    () =>
      computeTotals({
        items,
        discountType: h.discountType,
        discountValue: h.discountValue,
        roundTotal: mode === "invoice" && h.roundTotal,
        vatApplicable,
      }),
    [items, h.discountType, h.discountValue, h.roundTotal, mode, vatApplicable],
  );

  // fetch ČNB rate when currency or date changes
  useEffect(() => {
    if (h.currency === "CZK") {
      setHeader("exchangeRate", "1");
      setRateInfo("");
      return;
    }
    if (skipRateFetch.current) {
      skipRateFetch.current = false;
      return;
    }
    let cancelled = false;
    setRateInfo("Načítám kurz ČNB…");
    fetch(`/api/kurz?mena=${h.currency}&datum=${h.issueDate}`)
      .then(async (r) => {
        const d = await r.json();
        if (cancelled) return;
        if (r.ok) {
          setHeader("exchangeRate", String(d.rate));
          setRateInfo(`Kurz ČNB k ${h.issueDate}: ${d.rate} CZK/${h.currency}`);
        } else {
          setRateInfo(d.error ?? "Kurz se nepodařilo načíst, zadejte ručně.");
        }
      })
      .catch(() => !cancelled && setRateInfo("Kurz se nepodařilo načíst, zadejte ručně."));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [h.currency, h.issueDate]);

  function priceFor(p: EditorPriceItem): string {
    if (h.currency === "CZK") return p.priceCzk;
    if (p.priceEur) return p.priceEur;
    const rate = Number(h.exchangeRate) || 0;
    if (rate <= 0) return p.priceCzk;
    return (Number(p.priceCzk) / rate).toFixed(2);
  }

  function addFromPriceList(id: string) {
    const p = priceItems.find((x) => x.id === id);
    if (!p) return;
    setItems((arr) => [
      ...arr,
      {
        key: newKey(),
        priceItemId: p.id,
        name: p.name,
        description: p.description,
        quantity: "1",
        unit: p.unit,
        unitPrice: priceFor(p),
        vatRate: p.vatRate,
        discountPercent: "0",
      },
    ]);
    setPickerId("");
  }

  function addFreeItem() {
    setItems((arr) => [
      ...arr,
      { key: newKey(), priceItemId: null, name: "", description: "", quantity: "1", unit: "ks", unitPrice: "", vatRate: settings.defaultVatRate, discountPercent: "0" },
    ]);
  }

  function updateItem(key: string, patch: Partial<EditorItem>) {
    setItems((arr) => arr.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  }

  function removeItem(key: string) {
    setItems((arr) => arr.filter((it) => it.key !== key));
  }

  function move(key: string, dir: -1 | 1) {
    setItems((arr) => {
      const i = arr.findIndex((it) => it.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  const payload = JSON.stringify({
    ...h,
    items: items.map(({ key: _k, ...rest }) => rest),
  });

  const cur = h.currency;
  const isInvoice = mode === "invoice";

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="payload" value={payload} />
      {state?.error && <Alert>{state.error}</Alert>}

      <div className="card space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {isInvoice && (
            <Field label="Typ dokladu">
              <select className="input" value={h.type} onChange={(e) => setHeader("type", e.target.value as EditorHeader["type"])} disabled={typeLocked}>
                <option value="INVOICE">Faktura – daňový doklad</option>
                <option value="ADVANCE">Zálohová faktura</option>
                {typeLocked && <option value="TAX_DOCUMENT">Daňový doklad k přijaté platbě</option>}
                {typeLocked && <option value="CREDIT_NOTE">Opravný daňový doklad</option>}
              </select>
            </Field>
          )}
          <Field label="Odběratel" className={isInvoice ? "md:col-span-2" : "md:col-span-2"}>
            <div className="flex gap-2">
              <select className="input" value={h.subjectId} onChange={(e) => setHeader("subjectId", e.target.value)} required>
                <option value="">— vyberte —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.ico ? ` (IČO ${s.ico})` : ""}
                    {s.city ? ` – ${s.city}` : ""}
                  </option>
                ))}
              </select>
              <Link href={`/subjekty/novy?returnTo=${encodeURIComponent(returnTo)}`} className="btn-secondary whitespace-nowrap">
                Nový
              </Link>
            </div>
          </Field>
          {!isInvoice && (
            <Field label="Předmět nabídky">
              <input className="input" value={h.title} onChange={(e) => setHeader("title", e.target.value)} placeholder="např. Dodávka a montáž…" />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
          <Field label="Datum vystavení">
            <input type="date" className="input" value={h.issueDate} onChange={(e) => setHeader("issueDate", e.target.value)} required />
          </Field>
          {isInvoice ? (
            <>
              <Field label="Splatnost">
                <input type="date" className="input" value={h.dueDate} onChange={(e) => setHeader("dueDate", e.target.value)} required />
              </Field>
              {h.type !== "ADVANCE" && (
                <Field label="DUZP">
                  <input type="date" className="input" value={h.taxDate} onChange={(e) => setHeader("taxDate", e.target.value)} />
                </Field>
              )}
              <Field label="Způsob úhrady">
                <select className="input" value={h.paymentMethod} onChange={(e) => setHeader("paymentMethod", e.target.value as EditorHeader["paymentMethod"])}>
                  <option value="BANK_TRANSFER">Převodem</option>
                  <option value="CASH">Hotově</option>
                  <option value="CARD">Kartou</option>
                </select>
              </Field>
            </>
          ) : (
            <Field label="Platnost do">
              <input type="date" className="input" value={h.validUntil} onChange={(e) => setHeader("validUntil", e.target.value)} required />
            </Field>
          )}
          <Field label="Měna">
            <select className="input" value={h.currency} onChange={(e) => setHeader("currency", e.target.value as "CZK" | "EUR")}>
              <option value="CZK">CZK</option>
              <option value="EUR">EUR</option>
            </select>
          </Field>
          {h.currency !== "CZK" && (
            <Field label="Kurz (CZK za 1 EUR)" hint={rateInfo}>
              <input className="input" inputMode="decimal" value={h.exchangeRate} onChange={(e) => setHeader("exchangeRate", e.target.value)} />
            </Field>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <h2 className="font-semibold">Položky</h2>
          <div className="flex flex-wrap items-center gap-2">
            <select className="input max-w-xs" value={pickerId} onChange={(e) => addFromPriceList(e.target.value)}>
              <option value="">+ Přidat z ceníku…</option>
              {priceItems.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code ? `${p.code} – ` : ""}
                  {p.name} ({formatMoney(priceFor(p), cur)}/{p.unit})
                </option>
              ))}
            </select>
            <button type="button" className="btn-secondary" onClick={addFreeItem}>
              + Volná položka
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th className="min-w-[16rem]">Název / popis</th>
                <th className="w-24">Množství</th>
                <th className="w-20">MJ</th>
                <th className="w-32">Cena/MJ bez DPH</th>
                {vatApplicable && <th className="w-24">DPH</th>}
                <th className="w-24">Sleva %</th>
                <th className="w-32 text-right">Celkem bez DPH</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={it.key}>
                  <td className="text-xs text-slate-400">{idx + 1}.</td>
                  <td>
                    <input className="input" value={it.name} onChange={(e) => updateItem(it.key, { name: e.target.value })} placeholder="Název položky" required />
                    <input
                      className="input mt-1 text-xs"
                      value={it.description}
                      onChange={(e) => updateItem(it.key, { description: e.target.value })}
                      placeholder="Popis (nepovinné)"
                    />
                  </td>
                  <td>
                    <input className="input" inputMode="decimal" value={it.quantity} onChange={(e) => updateItem(it.key, { quantity: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" value={it.unit} onChange={(e) => updateItem(it.key, { unit: e.target.value })} />
                  </td>
                  <td>
                    <input className="input" inputMode="decimal" value={it.unitPrice} onChange={(e) => updateItem(it.key, { unitPrice: e.target.value })} />
                  </td>
                  {vatApplicable && (
                    <td>
                      <select className="input" value={it.vatRate} onChange={(e) => updateItem(it.key, { vatRate: Number(e.target.value) })}>
                        {VAT_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r} %
                          </option>
                        ))}
                      </select>
                    </td>
                  )}
                  <td>
                    <input className="input" inputMode="decimal" value={it.discountPercent} onChange={(e) => updateItem(it.key, { discountPercent: e.target.value })} />
                    {it.noDiscount && <span className="mt-1 block text-[10px] text-slate-400">bez slevy na doklad</span>}
                  </td>
                  <td className="text-right font-medium">{formatMoney(totals.lines[idx]?.base.toNumber() ?? 0, cur)}</td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" className="btn-secondary btn-sm px-1.5" onClick={() => move(it.key, -1)} title="Nahoru" aria-label="Nahoru">
                        ↑
                      </button>
                      <button type="button" className="btn-secondary btn-sm px-1.5" onClick={() => move(it.key, 1)} title="Dolů" aria-label="Dolů">
                        ↓
                      </button>
                      <button type="button" className="btn-danger btn-sm px-1.5" onClick={() => removeItem(it.key)} title="Odebrat" aria-label="Odebrat">
                        ×
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-400">
                    Zatím žádné položky. Přidejte je z ceníku nebo jako volnou položku.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card space-y-4 p-6 lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field label="Sleva na celý doklad">
              <select className="input" value={h.discountType} onChange={(e) => setHeader("discountType", e.target.value as EditorHeader["discountType"])}>
                <option value="NONE">Bez slevy</option>
                <option value="PERCENT">Procentuální (%)</option>
                <option value="AMOUNT">Částka bez DPH ({cur})</option>
              </select>
            </Field>
            {h.discountType !== "NONE" && (
              <Field label={h.discountType === "PERCENT" ? "Sleva v %" : `Sleva v ${cur} bez DPH`}>
                <input className="input" inputMode="decimal" value={h.discountValue} onChange={(e) => setHeader("discountValue", e.target.value)} />
              </Field>
            )}
            {isInvoice && (
              <>
                <Field label="Konstantní symbol">
                  <input className="input" value={h.constantSymbol} onChange={(e) => setHeader("constantSymbol", e.target.value)} />
                </Field>
                {cur === "CZK" && (
                  <label className="flex items-center gap-2 text-sm md:col-span-3">
                    <input type="checkbox" checked={h.roundTotal} onChange={(e) => setHeader("roundTotal", e.target.checked)} /> Zaokrouhlit celkovou částku na celé koruny
                  </label>
                )}
              </>
            )}
          </div>
          <Field label="Text na dokladu (viditelný pro odběratele)">
            <textarea className="input" rows={3} value={h.note} onChange={(e) => setHeader("note", e.target.value)} />
          </Field>
          <Field label="Interní poznámka">
            <textarea className="input" rows={2} value={h.internalNote} onChange={(e) => setHeader("internalNote", e.target.value)} />
          </Field>
        </div>
        <div className="card p-6">
          <h2 className="mb-3 font-semibold">Souhrn</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Položky bez DPH</dt>
              <dd>{formatMoney(totals.subtotal.toNumber(), cur)}</dd>
            </div>
            {totals.discountAmount.gt(0) && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Sleva na doklad</dt>
                <dd>− {formatMoney(totals.discountAmount.toNumber(), cur)}</dd>
              </div>
            )}
            {vatApplicable &&
              totals.vatGroups.map((g) => (
                <div key={g.rate} className="flex justify-between text-slate-500">
                  <dt>
                    Základ {g.rate} % / DPH
                  </dt>
                  <dd>
                    {formatMoney(g.base.toNumber(), cur)} / {formatMoney(g.vat.toNumber(), cur)}
                  </dd>
                </div>
              ))}
            {!totals.rounding.isZero() && (
              <div className="flex justify-between">
                <dt className="text-slate-500">Zaokrouhlení</dt>
                <dd>{formatMoney(totals.rounding.toNumber(), cur)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
              <dt>Celkem {vatApplicable ? "s DPH" : ""}</dt>
              <dd>{formatMoney(totals.payable.toNumber(), cur)}</dd>
            </div>
            {cur !== "CZK" && Number(h.exchangeRate) > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <dt>≈ v CZK</dt>
                <dd>{formatMoney(totals.payable.toNumber() * Number(h.exchangeRate), "CZK")}</dd>
              </div>
            )}
          </dl>
          <div className="mt-6 flex gap-2">
            <SubmitButton>{submitLabel}</SubmitButton>
            <Link href={cancelHref} className="btn-secondary">
              Zrušit
            </Link>
          </div>
        </div>
      </div>
    </form>
  );
}
