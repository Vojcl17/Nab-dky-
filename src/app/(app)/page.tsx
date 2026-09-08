import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeTotals, dec } from "@/lib/totals";
import { formatDate, formatMoney, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_TYPE_SHORT, OFFER_STATUS_COLORS, OFFER_STATUS_LABELS } from "@/lib/format";
import { Badge, LinkButton, PageHeader } from "@/components/ui";

export default async function DashboardPage() {
  const user = await requireUser();
  const settings = await getSettings();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const [openOffers, openInvoices, recentOffers, recentInvoices, unmatched, counts, newInquiries] = await Promise.all([
    prisma.offer.findMany({ where: { status: { in: ["DRAFT", "SENT"] } }, include: { items: true } }),
    prisma.invoice.findMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, type: { in: ["INVOICE", "ADVANCE"] } }, include: { items: true } }),
    prisma.offer.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { subject: { select: { name: true } }, items: true } }),
    prisma.invoice.findMany({ orderBy: { updatedAt: "desc" }, take: 6, include: { items: true } }),
    prisma.bankTransaction.count({ where: { payment: null, amount: { gt: 0 } } }),
    Promise.all([prisma.subject.count(), prisma.priceItem.count({ where: { active: true } })]),
    prisma.inquiry.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
  ]);

  const sumCzk = (docs: { items: Parameters<typeof computeTotals>[0]["items"]; discountType: "NONE" | "PERCENT" | "AMOUNT"; discountValue: { toString(): string }; exchangeRate: { toString(): string }; roundTotal?: boolean; paidAmount?: { toString(): string } }[]) =>
    docs.reduce((s, d) => {
      const t = computeTotals({ items: d.items, discountType: d.discountType, discountValue: d.discountValue, roundTotal: d.roundTotal ?? false, vatApplicable: settings.vatPayer });
      const remaining = t.payable.minus(d.paidAmount ? dec(d.paidAmount) : 0);
      return s + remaining.mul(dec(d.exchangeRate)).toNumber();
    }, 0);

  const overdue = openInvoices.filter((i) => i.dueDate < today);
  const setupIncomplete = !settings.name || !settings.ico;

  const tiles = [
    { label: "Poptávky k vyřízení", value: String(newInquiries), sub: "nové a v řešení", href: "/poptavky", warn: newInquiries > 0 },
    { label: "Otevřené nabídky", value: String(openOffers.length), sub: formatMoney(sumCzk(openOffers), "CZK"), href: "/nabidky?stav=SENT" },
    { label: "Neuhrazené faktury", value: String(openInvoices.length), sub: formatMoney(sumCzk(openInvoices), "CZK"), href: "/faktury?stav=ISSUED" },
    { label: "Po splatnosti", value: String(overdue.length), sub: formatMoney(sumCzk(overdue), "CZK"), href: "/faktury?stav=OVERDUE", warn: overdue.length > 0 },
    { label: "Nespárované platby", value: String(unmatched), sub: "příchozí pohyby Fio", href: "/banka?filtr=nesparovane", warn: unmatched > 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Dobrý den, ${user.name.split(" ")[0]}`}
        subtitle={`${counts[0]} subjektů · ${counts[1]} položek v ceníku`}
        actions={
          <>
            {userCan(user, "offers:write") && <LinkButton href="/nabidky/nova" className="btn-primary">Nová nabídka</LinkButton>}
            {userCan(user, "invoices:write") && <LinkButton href="/faktury/nova">Nová faktura</LinkButton>}
          </>
        }
      />
      {setupIncomplete && userCan(user, "settings:write") && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Doplňte údaje o firmě (název, IČO, bankovní účet) v <Link href="/nastaveni" className="font-medium underline">Nastavení</Link>, aby se správně tiskly doklady.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={`card p-5 transition hover:shadow ${t.warn ? "border-rose-200" : ""}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{t.label}</div>
            <div className={`mt-1 text-3xl font-semibold ${t.warn ? "text-rose-600" : ""}`}>{t.value}</div>
            <div className="text-sm text-slate-500">{t.sub}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Poslední nabídky</h2>
            <Link href="/nabidky" className="text-sm text-indigo-700 hover:underline">
              všechny
            </Link>
          </div>
          <table className="table">
            <tbody>
              {recentOffers.map((o) => {
                const t = computeTotals({ items: o.items, discountType: o.discountType, discountValue: o.discountValue, vatApplicable: settings.vatPayer });
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/nabidky/${o.id}`} className="font-medium text-indigo-700 hover:underline">
                        {o.number}
                      </Link>
                      <div className="text-xs text-slate-500">{o.subject.name}</div>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(o.issueDate)}</td>
                    <td>
                      <Badge className={OFFER_STATUS_COLORS[o.status]}>{OFFER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className="text-right font-medium">{formatMoney(t.total.toNumber(), o.currency)}</td>
                  </tr>
                );
              })}
              {recentOffers.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-400">Zatím žádné nabídky</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Poslední faktury</h2>
            <Link href="/faktury" className="text-sm text-indigo-700 hover:underline">
              všechny
            </Link>
          </div>
          <table className="table">
            <tbody>
              {recentInvoices.map((i) => {
                const t = computeTotals({ items: i.items, discountType: i.discountType, discountValue: i.discountValue, roundTotal: i.roundTotal, vatApplicable: settings.vatPayer });
                const isOverdue = (i.status === "ISSUED" || i.status === "PARTIALLY_PAID") && i.dueDate < today;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/faktury/${i.id}`} className="font-medium text-indigo-700 hover:underline">
                        {INVOICE_TYPE_SHORT[i.type]} {i.number}
                      </Link>
                      <div className="text-xs text-slate-500">{i.customerName}</div>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(i.dueDate)}</td>
                    <td>
                      <Badge className={isOverdue ? "bg-rose-100 text-rose-800" : INVOICE_STATUS_COLORS[i.status]}>{isOverdue ? "Po splatnosti" : INVOICE_STATUS_LABELS[i.status]}</Badge>
                    </td>
                    <td className="text-right font-medium">{formatMoney(t.payable.toNumber(), i.currency)}</td>
                  </tr>
                );
              })}
              {recentInvoices.length === 0 && (
                <tr>
                  <td className="py-6 text-center text-slate-400">Zatím žádné faktury</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
