import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getInvoice } from "@/lib/invoices";
import { readSupplier } from "@/lib/documents";
import { computeTotals, dec } from "@/lib/totals";
import {
  formatDate,
  formatMoney,
  todayInput,
  INVOICE_STATUS_COLORS,
  INVOICE_STATUS_LABELS,
  INVOICE_TYPE_LABELS,
  INVOICE_TYPE_SHORT,
} from "@/lib/format";
import { Badge, ConfirmButton, PageHeader } from "@/components/ui";
import { DocumentItems, TotalsSummary, totalsForDoc } from "@/components/document-items";
import { PaymentForm } from "./payment-form";
import {
  cancelInvoiceAction,
  createCreditNoteAction,
  createFinalInvoiceAction,
  createTaxDocumentAction,
  deleteInvoiceAction,
  deletePaymentAction,
  issueInvoiceAction,
} from "../actions";

const PAYMENT_LABELS = { BANK_TRANSFER: "převodem", CASH: "hotově", CARD: "kartou" } as const;

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const inv = await getInvoice(id);
  if (!inv) notFound();
  const settings = await getSettings();
  const supplier = readSupplier(inv.supplier, settings);
  const vatApplicable = supplier.vatPayer;
  const totals = totalsForDoc(inv, vatApplicable);
  const canWrite = userCan(user, "invoices:write");
  const canPay = userCan(user, "payments:write");
  const isDraft = inv.status === "DRAFT";
  const isOpen = inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID";
  const today = new Date(todayInput() + "T00:00:00.000Z");
  const overdue = isOpen && inv.dueDate < today;
  const remaining = totals.payable.minus(dec(inv.paidAmount));
  const editable = canWrite && inv.status !== "CANCELLED" && inv.payments.length === 0;

  const taxDocs = inv.relatedTo.filter((r) => r.type === "TAX_DOCUMENT" && r.status !== "CANCELLED");
  const finalInvoice = inv.relatedTo.find((r) => r.type === "INVOICE" && r.status !== "CANCELLED");
  const canCreateTaxDoc = canWrite && inv.type === "ADVANCE" && dec(inv.paidAmount).gt(0) && vatApplicable;
  const canCreateFinal = canWrite && inv.type === "ADVANCE" && !finalInvoice && (vatApplicable ? taxDocs.length > 0 : dec(inv.paidAmount).gt(0));

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {INVOICE_TYPE_SHORT[inv.type]} {inv.number}
            <Badge className={overdue ? "bg-rose-100 text-rose-800" : INVOICE_STATUS_COLORS[inv.status]}>{overdue ? "Po splatnosti" : INVOICE_STATUS_LABELS[inv.status]}</Badge>
          </span>
        }
        subtitle={INVOICE_TYPE_LABELS[inv.type]}
        actions={
          <>
            <a href={`/api/faktury/${inv.id}/pdf`} className="btn-secondary" target="_blank" rel="noreferrer">
              PDF
            </a>
            <a href={`/api/faktury/${inv.id}/isdoc`} className="btn-secondary">
              ISDOC
            </a>
            {editable && (
              <Link href={`/faktury/${inv.id}/upravit`} className="btn-secondary">
                Upravit
              </Link>
            )}
            {canWrite && isDraft && (
              <form action={issueInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-primary">Vystavit</button>
              </form>
            )}
            {canCreateTaxDoc && (
              <form action={createTaxDocumentAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-secondary">Daňový doklad k platbě</button>
              </form>
            )}
            {canCreateFinal && (
              <form action={createFinalInvoiceAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-primary">Konečná faktura</button>
              </form>
            )}
            {canWrite && inv.type !== "CREDIT_NOTE" && !isDraft && inv.status !== "CANCELLED" && (
              <form action={createCreditNoteAction}>
                <input type="hidden" name="id" value={inv.id} />
                <button className="btn-secondary">Dobropis</button>
              </form>
            )}
          </>
        }
      />

      {inv.type === "ADVANCE" && dec(inv.paidAmount).gt(0) && vatApplicable && taxDocs.length === 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Záloha je uhrazená. Vystavte daňový doklad k přijaté platbě (do 15 dnů od přijetí platby).
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Dodavatel</h2>
          <div className="font-medium">{supplier.name}</div>
          <div className="text-slate-600">
            {supplier.street}
            <br />
            {supplier.zip} {supplier.city}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {supplier.ico && <>IČO {supplier.ico} </>}
            {supplier.dic && <>DIČ {supplier.dic}</>}
            {!supplier.vatPayer && <div>Neplátce DPH</div>}
          </div>
        </div>
        <div className="card p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Odběratel</h2>
          <Link href={`/subjekty/${inv.subjectId}`} className="font-medium text-indigo-700 hover:underline">
            {inv.customerName || inv.subject.name}
          </Link>
          <div className="text-slate-600">
            {inv.customerStreet}
            <br />
            {inv.customerZip} {inv.customerCity}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {inv.customerIco && <>IČO {inv.customerIco} </>}
            {inv.customerDic && <>DIČ {inv.customerDic}</>}
          </div>
        </div>
        <div className="card p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Platební údaje</h2>
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-slate-500">Vystaveno</dt>
            <dd>{formatDate(inv.issueDate)}</dd>
            <dt className="text-slate-500">Splatnost</dt>
            <dd className={overdue ? "font-medium text-rose-600" : ""}>{formatDate(inv.dueDate)}</dd>
            {inv.taxDate && (
              <>
                <dt className="text-slate-500">DUZP</dt>
                <dd>{formatDate(inv.taxDate)}</dd>
              </>
            )}
            <dt className="text-slate-500">Úhrada</dt>
            <dd>{PAYMENT_LABELS[inv.paymentMethod]}</dd>
            <dt className="text-slate-500">Var. symbol</dt>
            <dd className="font-mono">{inv.variableSymbol}</dd>
            {inv.constantSymbol && (
              <>
                <dt className="text-slate-500">Konst. symbol</dt>
                <dd className="font-mono">{inv.constantSymbol}</dd>
              </>
            )}
            <dt className="text-slate-500">Účet</dt>
            <dd className="font-mono">
              {supplier.bankAccount}
              {supplier.bankCode && `/${supplier.bankCode}`}
            </dd>
            {inv.currency !== "CZK" && (
              <>
                <dt className="text-slate-500">IBAN</dt>
                <dd className="font-mono text-xs">{supplier.iban}</dd>
              </>
            )}
          </dl>
          {(inv.offer || inv.relatedInvoice || inv.relatedTo.length > 0) && (
            <div className="mt-3 border-t border-slate-100 pt-2 text-xs">
              <div className="mb-1 text-slate-500">Související doklady</div>
              <ul className="space-y-0.5">
                {inv.offer && (
                  <li>
                    <Link href={`/nabidky/${inv.offer.id}`} className="text-indigo-700 hover:underline">
                      Nabídka {inv.offer.number}
                    </Link>
                  </li>
                )}
                {inv.relatedInvoice && (
                  <li>
                    <Link href={`/faktury/${inv.relatedInvoice.id}`} className="text-indigo-700 hover:underline">
                      {INVOICE_TYPE_SHORT[inv.relatedInvoice.type]} {inv.relatedInvoice.number}
                    </Link>
                  </li>
                )}
                {inv.relatedTo.map((r) => (
                  <li key={r.id} className="flex items-center gap-1">
                    <Link href={`/faktury/${r.id}`} className="text-indigo-700 hover:underline">
                      {INVOICE_TYPE_SHORT[r.type]} {r.number}
                    </Link>
                    <Badge className={INVOICE_STATUS_COLORS[r.status]}>{INVOICE_STATUS_LABELS[r.status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <DocumentItems items={inv.items} totals={totals} currency={inv.currency} vatApplicable={vatApplicable} />
        <div className="flex justify-end border-t border-slate-100 p-5">
          <div className="w-full max-w-sm">
            <TotalsSummary totals={totals} currency={inv.currency} vatApplicable={vatApplicable} exchangeRate={inv.exchangeRate} paidAmount={isDraft ? undefined : inv.paidAmount} />
          </div>
        </div>
      </div>

      {inv.note && (
        <div className="card p-5 text-sm">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Text na dokladu</h2>
          <p className="whitespace-pre-line">{inv.note}</p>
        </div>
      )}

      {!isDraft && (
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Úhrady</h2>
          </div>
          {inv.payments.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className="text-right">Částka</th>
                  <th>Zdroj</th>
                  <th>Poznámka</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {inv.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td className="text-right font-medium">{formatMoney(p.amount, p.currency)}</td>
                    <td className="text-xs text-slate-500">
                      {p.bankTransaction ? (
                        <>
                          Fio banka · {p.bankTransaction.counterName || p.bankTransaction.counterAccount}
                          {p.bankTransaction.variableSymbol && ` · VS ${p.bankTransaction.variableSymbol}`}
                        </>
                      ) : (
                        <>ručně{p.createdBy ? ` · ${p.createdBy.name}` : ""}</>
                      )}
                    </td>
                    <td className="text-xs text-slate-500">{p.note}</td>
                    <td className="text-right">
                      {canPay && (
                        <form action={deletePaymentAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <ConfirmButton message="Odebrat úhradu? Bankovní pohyb zůstane v bance jako nespárovaný.">Odebrat</ConfirmButton>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-5 py-4 text-sm text-slate-500">Zatím žádné úhrady. Platby z Fio banky se párují automaticky podle variabilního symbolu {inv.variableSymbol}.</div>
          )}
          {canPay && isOpen && (
            <div className="border-t border-slate-100 px-5 py-4">
              <PaymentForm invoiceId={inv.id} suggestedAmount={remaining.toFixed(2)} currency={inv.currency} today={todayInput()} />
            </div>
          )}
        </div>
      )}

      {canWrite && (
        <div className="flex justify-end gap-2">
          {isDraft && inv.relatedTo.length === 0 && (
            <form action={deleteInvoiceAction}>
              <input type="hidden" name="id" value={inv.id} />
              <ConfirmButton message={`Opravdu smazat rozpracovaný doklad ${inv.number}? Číslo dokladu zůstane vynechané.`}>Smazat</ConfirmButton>
            </form>
          )}
          {isOpen && inv.payments.length === 0 && inv.relatedTo.length === 0 && (
            <form action={cancelInvoiceAction}>
              <input type="hidden" name="id" value={inv.id} />
              <ConfirmButton message={`Stornovat doklad ${inv.number}?`}>Stornovat</ConfirmButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
