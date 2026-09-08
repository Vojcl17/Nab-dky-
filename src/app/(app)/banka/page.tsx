import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime, formatMoney, INVOICE_TYPE_SHORT } from "@/lib/format";
import { computeTotals, dec } from "@/lib/totals";
import { Badge, ConfirmButton, PageHeader } from "@/components/ui";
import { SyncForm } from "./sync-form";
import { matchManuallyAction, unmatchAction } from "./actions";

export default async function BankPage({ searchParams }: { searchParams: Promise<{ filtr?: string }> }) {
  const user = await requireUser();
  const settings = await getSettings();
  const { filtr = "" } = await searchParams;
  const [transactions, logs, openInvoices] = await Promise.all([
    prisma.bankTransaction.findMany({
      where: filtr === "nesparovane" ? { payment: null, amount: { gt: 0 } } : {},
      orderBy: [{ date: "desc" }, { fioId: "desc" }],
      take: 200,
      include: { payment: { include: { invoice: { select: { id: true, number: true, type: true } } } } },
    }),
    prisma.syncLog.findMany({ where: { kind: "FIO" }, orderBy: { at: "desc" }, take: 5 }),
    prisma.invoice.findMany({
      where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, type: { in: ["INVOICE", "ADVANCE"] } },
      orderBy: { issueDate: "desc" },
      include: { items: true },
      take: 200,
    }),
  ]);
  const canSync = userCan(user, "bank:sync");
  const canPay = userCan(user, "payments:write");
  const unmatchedCount = transactions.filter((t) => !t.payment && dec(t.amount).gt(0)).length;
  const openOptions = openInvoices.map((i) => {
    const t = computeTotals({ items: i.items, discountType: i.discountType, discountValue: i.discountValue, roundTotal: i.roundTotal });
    return { id: i.id, label: `${INVOICE_TYPE_SHORT[i.type]} ${i.number} · VS ${i.variableSymbol} · zbývá ${formatMoney(t.payable.minus(dec(i.paidAmount)).toNumber(), i.currency)} · ${i.customerName}` };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banka (Fio)"
        subtitle={
          settings.fioToken
            ? `Poslední synchronizace: ${settings.fioLastSyncAt ? formatDateTime(settings.fioLastSyncAt) : "nikdy"}`
            : "Fio API token není nastaven – doplňte ho v Nastavení."
        }
      />
      {canSync && (
        <div className="card p-5">
          <SyncForm hasToken={!!settings.fioToken} />
          {logs.length > 0 && (
            <ul className="mt-3 space-y-0.5 text-xs text-slate-500">
              {logs.map((l) => (
                <li key={l.id}>
                  {formatDateTime(l.at)} – <span className={l.ok ? "" : "text-rose-600"}>{l.message}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Automatické stahování: volejte pravidelně (např. cronem každou hodinu) <code>GET /api/cron/sync</code> s hlavičkou <code>Authorization: Bearer CRON_SECRET</code>.
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 text-sm">
        <Link href="/banka" className={`rounded-md px-3 py-1.5 ${!filtr ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
          Všechny pohyby
        </Link>
        <Link href="/banka?filtr=nesparovane" className={`rounded-md px-3 py-1.5 ${filtr === "nesparovane" ? "bg-indigo-50 font-medium text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
          Nespárované příchozí {unmatchedCount > 0 && <Badge className="ml-1 bg-amber-100 text-amber-800">{unmatchedCount}</Badge>}
        </Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th className="text-right">Částka</th>
              <th>Protistrana</th>
              <th>VS</th>
              <th>Zpráva</th>
              <th>Faktura</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => {
              const incoming = dec(t.amount).gt(0);
              return (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className={`whitespace-nowrap text-right font-medium ${incoming ? "text-emerald-700" : "text-slate-700"}`}>{formatMoney(t.amount, t.currency)}</td>
                  <td>
                    <div>{t.counterName || "—"}</div>
                    <div className="text-xs text-slate-500">
                      {t.counterAccount}
                      {t.counterBankCode && `/${t.counterBankCode}`}
                    </div>
                  </td>
                  <td className="font-mono text-xs">{t.variableSymbol}</td>
                  <td className="max-w-xs truncate text-xs text-slate-500">{[t.message, t.comment].filter(Boolean).join(" · ")}</td>
                  <td>
                    {t.payment ? (
                      <Link href={`/faktury/${t.payment.invoice.id}`} className="text-indigo-700 hover:underline">
                        {INVOICE_TYPE_SHORT[t.payment.invoice.type]} {t.payment.invoice.number}
                      </Link>
                    ) : incoming ? (
                      <Badge className="bg-amber-100 text-amber-800">nespárováno</Badge>
                    ) : (
                      <span className="text-xs text-slate-400">odchozí</span>
                    )}
                  </td>
                  <td className="text-right">
                    {canPay && t.payment && (
                      <form action={unmatchAction}>
                        <input type="hidden" name="transactionId" value={t.id} />
                        <ConfirmButton message="Zrušit spárování s fakturou?" className="btn-secondary btn-sm">
                          Odpárovat
                        </ConfirmButton>
                      </form>
                    )}
                    {canPay && !t.payment && incoming && openOptions.length > 0 && (
                      <form action={matchManuallyAction} className="flex items-center gap-1">
                        <input type="hidden" name="transactionId" value={t.id} />
                        <select name="invoiceId" className="input max-w-[16rem] py-1 text-xs" defaultValue="">
                          <option value="">Spárovat s fakturou…</option>
                          {openOptions.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <button className="btn-secondary btn-sm">OK</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Zatím žádné pohyby. Nastavte Fio token a stáhněte výpis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
