import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { Badge, PageHeader } from "@/components/ui";
import { formatDate, formatMoney, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_TYPE_SHORT, OFFER_STATUS_COLORS, OFFER_STATUS_LABELS } from "@/lib/format";
import { SubjectForm } from "../subject-form";
import { computeTotals } from "@/lib/totals";

export default async function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: {
      offers: { orderBy: { issueDate: "desc" }, take: 20, include: { items: true } },
      invoices: { orderBy: { issueDate: "desc" }, take: 20, include: { items: true } },
      _count: { select: { offers: true, invoices: true } },
    },
  });
  if (!subject) notFound();
  const canWrite = userCan(user, "subjects:write");
  const canDelete = canWrite && subject._count.offers + subject._count.invoices === 0;
  return (
    <div className="space-y-6">
      <PageHeader title={subject.name} subtitle={[subject.ico && `IČO ${subject.ico}`, subject.dic && `DIČ ${subject.dic}`].filter(Boolean).join(" · ")} />
      {canWrite ? (
        <SubjectForm subject={{ ...subject }} canDelete={canDelete} />
      ) : (
        <div className="card p-6 text-sm">
          <div>{subject.street}</div>
          <div>
            {subject.zip} {subject.city}
          </div>
          <div className="mt-2 text-slate-500">{[subject.contactPerson, subject.email, subject.phone].filter(Boolean).join(" · ")}</div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Nabídky</h2>
            {userCan(user, "offers:write") && (
              <Link href={`/nabidky/nova?subjectId=${subject.id}`} className="btn-secondary btn-sm">
                Nová nabídka
              </Link>
            )}
          </div>
          <table className="table">
            <tbody>
              {subject.offers.map((o) => {
                const t = computeTotals({ items: o.items, discountType: o.discountType, discountValue: o.discountValue });
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/nabidky/${o.id}`} className="font-medium text-indigo-700 hover:underline">
                        {o.number}
                      </Link>
                      {o.title && <div className="text-xs text-slate-500">{o.title}</div>}
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(o.issueDate)}</td>
                    <td>
                      <Badge className={OFFER_STATUS_COLORS[o.status]}>{OFFER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className="text-right">{formatMoney(t.total.toNumber(), o.currency)}</td>
                  </tr>
                );
              })}
              {subject.offers.length === 0 && (
                <tr>
                  <td className="text-slate-400">Žádné nabídky</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Faktury</h2>
            {userCan(user, "invoices:write") && (
              <Link href={`/faktury/nova?subjectId=${subject.id}`} className="btn-secondary btn-sm">
                Nová faktura
              </Link>
            )}
          </div>
          <table className="table">
            <tbody>
              {subject.invoices.map((i) => {
                const t = computeTotals({ items: i.items, discountType: i.discountType, discountValue: i.discountValue, roundTotal: i.roundTotal });
                return (
                  <tr key={i.id}>
                    <td>
                      <Link href={`/faktury/${i.id}`} className="font-medium text-indigo-700 hover:underline">
                        {i.number}
                      </Link>
                      <div className="text-xs text-slate-500">{INVOICE_TYPE_SHORT[i.type]}</div>
                    </td>
                    <td className="text-xs text-slate-500">{formatDate(i.issueDate)}</td>
                    <td>
                      <Badge className={INVOICE_STATUS_COLORS[i.status]}>{INVOICE_STATUS_LABELS[i.status]}</Badge>
                    </td>
                    <td className="text-right">{formatMoney(t.payable.toNumber(), i.currency)}</td>
                  </tr>
                );
              })}
              {subject.invoices.length === 0 && (
                <tr>
                  <td className="text-slate-400">Žádné faktury</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
