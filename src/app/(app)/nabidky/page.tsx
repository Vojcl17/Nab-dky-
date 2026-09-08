import Link from "next/link";
import type { OfferStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMoney, OFFER_STATUS_COLORS, OFFER_STATUS_LABELS } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";

const STATUSES = Object.keys(OFFER_STATUS_LABELS) as OfferStatus[];

export default async function OffersPage({ searchParams }: { searchParams: Promise<{ q?: string; stav?: string }> }) {
  const user = await requireUser();
  const settings = await getSettings();
  const { q = "", stav = "" } = await searchParams;
  const status = STATUSES.includes(stav as OfferStatus) ? (stav as OfferStatus) : undefined;
  const offers = await prisma.offer.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ number: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }, { subject: { name: { contains: q, mode: "insensitive" } } }] } : {}),
    },
    orderBy: [{ issueDate: "desc" }, { number: "desc" }],
    include: { subject: { select: { name: true } }, items: true },
    take: 200,
  });
  const canWrite = userCan(user, "offers:write");
  return (
    <div>
      <PageHeader
        title="Nabídky"
        subtitle={`${offers.length} nabídek`}
        actions={canWrite && <LinkButton href="/nabidky/nova" className="btn-primary">Nová nabídka</LinkButton>}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Číslo, předmět, odběratel…" className="input max-w-xs" />
        <select name="stav" defaultValue={stav} className="input max-w-[12rem]">
          <option value="">Všechny stavy</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {OFFER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="btn-secondary">Filtrovat</button>
      </form>
      {offers.length === 0 ? (
        <EmptyState>Žádné nabídky. {canWrite && <Link href="/nabidky/nova" className="text-indigo-600">Vytvořte první nabídku.</Link>}</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Číslo</th>
                <th>Odběratel</th>
                <th>Předmět</th>
                <th>Vystaveno</th>
                <th>Platnost</th>
                <th>Stav</th>
                <th className="text-right">Bez DPH</th>
                <th className="text-right">Celkem</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => {
                const t = computeTotals({ items: o.items, discountType: o.discountType, discountValue: o.discountValue, vatApplicable: settings.vatPayer });
                const expired = o.status === "SENT" && o.validUntil < new Date();
                return (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/nabidky/${o.id}`} className="font-medium text-indigo-700 hover:underline">
                        {o.number}
                      </Link>
                    </td>
                    <td>{o.subject.name}</td>
                    <td className="max-w-xs truncate text-slate-600">{o.title}</td>
                    <td className="whitespace-nowrap">{formatDate(o.issueDate)}</td>
                    <td className={`whitespace-nowrap ${expired ? "text-amber-600" : ""}`}>{formatDate(o.validUntil)}</td>
                    <td>
                      <Badge className={OFFER_STATUS_COLORS[o.status]}>{OFFER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className="whitespace-nowrap text-right">{formatMoney(t.base.toNumber(), o.currency)}</td>
                    <td className="whitespace-nowrap text-right font-medium">{formatMoney(t.total.toNumber(), o.currency)}</td>
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
