import Link from "next/link";
import type { InvoiceStatus, InvoiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMoney, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_TYPE_LABELS, INVOICE_TYPE_SHORT } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";

const STATUSES = Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[];
const TYPES = Object.keys(INVOICE_TYPE_LABELS) as InvoiceType[];

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ q?: string; stav?: string; typ?: string }> }) {
  const user = await requireUser();
  const settings = await getSettings();
  const { q = "", stav = "", typ = "" } = await searchParams;
  const status = stav === "OVERDUE" ? undefined : STATUSES.includes(stav as InvoiceStatus) ? (stav as InvoiceStatus) : undefined;
  const type = TYPES.includes(typ as InvoiceType) ? (typ as InvoiceType) : undefined;
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const invoices = await prisma.invoice.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(stav === "OVERDUE" ? { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueDate: { lt: today } } : {}),
      ...(type ? { type } : {}),
      ...(q
        ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { variableSymbol: { contains: q } }, { customerName: { contains: q, mode: "insensitive" } }, { subject: { name: { contains: q, mode: "insensitive" } } }] }
        : {}),
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { subject: { select: { name: true } }, items: true },
    take: 300,
  });
  const canWrite = userCan(user, "invoices:write");
  return (
    <div>
      <PageHeader
        title="Faktury"
        subtitle={`${invoices.length} dokladů`}
        actions={
          canWrite && (
            <>
              <LinkButton href="/faktury/nova?typ=ADVANCE">Nová zálohová faktura</LinkButton>
              <LinkButton href="/faktury/nova" className="btn-primary">Nová faktura</LinkButton>
            </>
          )
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Číslo, VS, odběratel…" className="input max-w-xs" />
        <select name="typ" defaultValue={typ} className="input max-w-[14rem]">
          <option value="">Všechny typy</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {INVOICE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select name="stav" defaultValue={stav} className="input max-w-[12rem]">
          <option value="">Všechny stavy</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABELS[s]}
            </option>
          ))}
          <option value="OVERDUE">Po splatnosti</option>
        </select>
        <button className="btn-secondary">Filtrovat</button>
      </form>
      {invoices.length === 0 ? (
        <EmptyState>Žádné faktury. Fakturu vystavíte z přijaté nabídky nebo {canWrite && <Link href="/faktury/nova" className="text-indigo-600">ručně</Link>}.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Číslo</th>
                <th>Typ</th>
                <th>Odběratel</th>
                <th>Vystaveno</th>
                <th>Splatnost</th>
                <th>Stav</th>
                <th className="text-right">Celkem</th>
                <th className="text-right">Zbývá</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const t = computeTotals({ items: i.items, discountType: i.discountType, discountValue: i.discountValue, roundTotal: i.roundTotal, vatApplicable: settings.vatPayer });
                const open = t.payable.minus(i.paidAmount.toString());
                const overdue = (i.status === "ISSUED" || i.status === "PARTIALLY_PAID") && i.dueDate < today;
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/faktury/${i.id}`} className="font-medium text-indigo-700 hover:underline">
                        {i.number}
                      </Link>
                    </td>
                    <td className="text-xs text-slate-500">{INVOICE_TYPE_SHORT[i.type]}</td>
                    <td>{i.customerName || i.subject.name}</td>
                    <td className="whitespace-nowrap">{formatDate(i.issueDate)}</td>
                    <td className={`whitespace-nowrap ${overdue ? "font-medium text-rose-600" : ""}`}>{formatDate(i.dueDate)}</td>
                    <td>
                      <Badge className={INVOICE_STATUS_COLORS[i.status]}>{overdue ? "Po splatnosti" : INVOICE_STATUS_LABELS[i.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-right font-medium">{formatMoney(t.payable.toNumber(), i.currency)}</td>
                    <td className="whitespace-nowrap text-right text-slate-500">
                      {i.status === "PAID" || i.status === "CANCELLED" ? "—" : formatMoney(open.toNumber(), i.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
