import Link from "next/link";
import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDateTime, INQUIRY_STATUS_COLORS, INQUIRY_STATUS_LABELS } from "@/lib/format";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { SyncMailForm } from "./sync-button";

const STATUSES = Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[];

export default async function InquiriesPage({ searchParams }: { searchParams: Promise<{ q?: string; stav?: string }> }) {
  const user = await requireUser();
  const settings = await getSettings();
  const { q = "", stav = "" } = await searchParams;
  const status = STATUSES.includes(stav as InquiryStatus) ? (stav as InquiryStatus) : undefined;
  const [inquiries, lastLog] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        ...(status ? { status } : stav === "" ? { status: { notIn: ["SPAM"] } } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: "insensitive" } },
                { subject: { contains: q, mode: "insensitive" } },
                { fromName: { contains: q, mode: "insensitive" } },
                { fromEmail: { contains: q, mode: "insensitive" } },
                { bodyText: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { receivedAt: "desc" },
      include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } }, _count: { select: { offers: true, attachments: true } } },
      take: 200,
    }),
    prisma.syncLog.findFirst({ where: { kind: "MAIL" }, orderBy: { at: "desc" } }),
  ]);
  const canWrite = userCan(user, "inquiries:write");
  const configured = !!settings.imapHost && !!settings.imapUser;
  return (
    <div>
      <PageHeader
        title="Poptávky"
        subtitle={
          configured
            ? `Schránka ${settings.imapUser} · poslední stažení ${settings.imapLastSyncAt ? formatDateTime(settings.imapLastSyncAt) : "nikdy"}${lastLog && !lastLog.ok ? ` · chyba: ${lastLog.message}` : ""}`
            : "E-mailová schránka pro poptávky není nastavena (Nastavení → Poptávky z e-mailu)."
        }
        actions={
          canWrite && (
            <>
              <SyncMailForm configured={configured} />
              <LinkButton href="/poptavky/nova" className="btn-primary">Nová poptávka</LinkButton>
            </>
          )
        }
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Předmět, odesílatel, text…" className="input max-w-xs" />
        <select name="stav" defaultValue={stav} className="input max-w-[12rem]">
          <option value="">Aktivní (bez spamu)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {INQUIRY_STATUS_LABELS[s]}
            </option>
          ))}
          <option value="vse">Vše</option>
        </select>
        <button className="btn-secondary">Filtrovat</button>
      </form>
      {inquiries.length === 0 ? (
        <EmptyState>Žádné poptávky. Nastavte schránku v Nastavení a stáhněte e-maily, nebo poptávku zadejte ručně.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Číslo</th>
                <th>Předmět</th>
                <th>Od</th>
                <th>Přijato</th>
                <th>Stav</th>
                <th>Řeší</th>
                <th className="text-right">Nabídky</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((i) => (
                <tr key={i.id} className={i.status === "NEW" ? "font-medium" : ""}>
                  <td>
                    <Link href={`/poptavky/${i.id}`} className="text-indigo-700 hover:underline">
                      {i.number}
                    </Link>
                  </td>
                  <td className="max-w-md">
                    <Link href={`/poptavky/${i.id}`} className="block truncate hover:underline">
                      {i.subject}
                    </Link>
                    {i._count.attachments > 0 && <span className="text-xs font-normal text-slate-400">📎 {i._count.attachments}</span>}
                  </td>
                  <td className="text-sm">
                    <div>{i.customer?.name ?? i.fromName ?? ""}</div>
                    <div className="text-xs font-normal text-slate-500">{i.fromEmail}</div>
                  </td>
                  <td className="whitespace-nowrap text-xs font-normal text-slate-500">{formatDateTime(i.receivedAt)}</td>
                  <td>
                    <Badge className={INQUIRY_STATUS_COLORS[i.status]}>{INQUIRY_STATUS_LABELS[i.status]}</Badge>
                  </td>
                  <td className="text-xs font-normal text-slate-500">{i.assignedTo?.name ?? "—"}</td>
                  <td className="text-right">{i._count.offers}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
