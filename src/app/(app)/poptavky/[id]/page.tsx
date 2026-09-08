import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { formatBytes, formatDateTime, formatMoney, INQUIRY_STATUS_COLORS, INQUIRY_STATUS_LABELS, OFFER_STATUS_COLORS, OFFER_STATUS_LABELS } from "@/lib/format";
import { computeTotals } from "@/lib/totals";
import { Badge, ConfirmButton, PageHeader } from "@/components/ui";
import { InquiryEditForm } from "./inquiry-edit-form";
import { deleteInquiryAction, setInquiryStatusAction } from "../actions";

const NEXT_STATUSES: Record<string, ("NEW" | "IN_PROGRESS" | "OFFERED" | "WON" | "LOST" | "SPAM")[]> = {
  NEW: ["IN_PROGRESS", "LOST", "SPAM"],
  IN_PROGRESS: ["NEW", "LOST", "SPAM"],
  OFFERED: ["WON", "LOST"],
  WON: ["OFFERED"],
  LOST: ["IN_PROGRESS"],
  SPAM: ["NEW"],
};

export default async function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [inq, subjects, users] = await Promise.all([
    prisma.inquiry.findUnique({
      where: { id },
      include: {
        customer: true,
        assignedTo: { select: { name: true } },
        attachments: { select: { id: true, filename: true, contentType: true, size: true } },
        offers: { orderBy: { issueDate: "desc" }, include: { items: true } },
      },
    }),
    prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!inq) notFound();
  const canWrite = userCan(user, "inquiries:write");
  const canOffer = userCan(user, "offers:write");
  const matchingSubject = !inq.customer && inq.fromEmail ? await prisma.subject.findFirst({ where: { email: { equals: inq.fromEmail, mode: "insensitive" } } }) : null;
  const newSubjectHref = `/subjekty/novy?${new URLSearchParams({
    returnTo: `/poptavky/${inq.id}`,
    inquiryId: inq.id,
    name: inq.fromName,
    email: inq.fromEmail,
    phone: inq.fromPhone,
  })}`;
  const replyHref = inq.fromEmail ? `mailto:${inq.fromEmail}?subject=${encodeURIComponent(`Re: ${inq.subject}`)}` : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            Poptávka {inq.number}
            <Badge className={INQUIRY_STATUS_COLORS[inq.status]}>{INQUIRY_STATUS_LABELS[inq.status]}</Badge>
          </span>
        }
        subtitle={inq.subject}
        actions={
          <>
            {replyHref && (
              <a href={replyHref} className="btn-secondary">
                Odpovědět e-mailem
              </a>
            )}
            {canOffer && inq.status !== "SPAM" && (
              <Link href={`/nabidky/nova?inquiryId=${inq.id}${inq.subjectId ? `&subjectId=${inq.subjectId}` : ""}`} className="btn-primary">
                Vytvořit nabídku
              </Link>
            )}
          </>
        }
      />

      {!inq.customer && canWrite && inq.status !== "SPAM" && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <span>Poptávka zatím není přiřazená k subjektu.</span>
          {matchingSubject && (
            <span>
              Podle e-mailu odpovídá <b>{matchingSubject.name}</b> – vyberte ho vpravo.
            </span>
          )}
          <Link href={newSubjectHref} className="btn-secondary btn-sm">
            Založit nový subjekt z poptávky
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm">
              <div>
                <span className="font-medium">{inq.fromName || inq.fromEmail || "Neznámý odesílatel"}</span>
                {inq.fromName && inq.fromEmail && <span className="text-slate-500"> &lt;{inq.fromEmail}&gt;</span>}
                {inq.fromPhone && <span className="text-slate-500"> · {inq.fromPhone}</span>}
              </div>
              <div className="text-xs text-slate-500">
                {inq.source === "EMAIL" ? "E-mail" : "Ručně zadáno"} · {formatDateTime(inq.receivedAt)}
              </div>
            </div>
            <div className="px-5 py-4">
              <pre className="whitespace-pre-wrap break-words font-sans text-sm text-slate-800">{inq.bodyText || "(bez textu)"}</pre>
            </div>
            {inq.attachments.length > 0 && (
              <div className="border-t border-slate-100 px-5 py-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Přílohy</div>
                <ul className="flex flex-wrap gap-2">
                  {inq.attachments.map((a) => (
                    <li key={a.id}>
                      <a href={`/api/poptavky/${inq.id}/prilohy/${a.id}`} className="btn-secondary btn-sm">
                        📎 {a.filename} <span className="text-slate-400">({formatBytes(a.size)})</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="card">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold">Nabídky k poptávce</h2>
            </div>
            {inq.offers.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-500">Zatím žádná nabídka.</div>
            ) : (
              <table className="table">
                <tbody>
                  {inq.offers.map((o) => {
                    const t = computeTotals({ items: o.items, discountType: o.discountType, discountValue: o.discountValue });
                    return (
                      <tr key={o.id}>
                        <td>
                          <Link href={`/nabidky/${o.id}`} className="font-medium text-indigo-700 hover:underline">
                            {o.number}
                          </Link>
                          {o.title && <div className="text-xs text-slate-500">{o.title}</div>}
                        </td>
                        <td>
                          <Badge className={OFFER_STATUS_COLORS[o.status]}>{OFFER_STATUS_LABELS[o.status]}</Badge>
                        </td>
                        <td className="text-right font-medium">{formatMoney(t.total.toNumber(), o.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stav</h2>
            {canWrite ? (
              <div className="flex flex-wrap gap-2">
                {NEXT_STATUSES[inq.status].map((s) => (
                  <form key={s} action={setInquiryStatusAction}>
                    <input type="hidden" name="id" value={inq.id} />
                    <input type="hidden" name="status" value={s} />
                    <button className="btn-secondary btn-sm">{INQUIRY_STATUS_LABELS[s]}</button>
                  </form>
                ))}
              </div>
            ) : (
              <div className="text-sm">{INQUIRY_STATUS_LABELS[inq.status]}</div>
            )}
            <p className="mt-2 text-xs text-slate-400">Vytvoření nabídky přepne poptávku na „Nabídnuto“, přijetí nabídky na „Vyhráno“, odmítnutí na „Prohráno“.</p>
          </div>
          <div className="card p-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Přiřazení</h2>
            {inq.customer && (
              <div className="mb-3 text-sm">
                <Link href={`/subjekty/${inq.customer.id}`} className="font-medium text-indigo-700 hover:underline">
                  {inq.customer.name}
                </Link>
                <div className="text-xs text-slate-500">
                  {inq.customer.city}
                  {inq.customer.ico && ` · IČO ${inq.customer.ico}`}
                </div>
              </div>
            )}
            {canWrite ? (
              <InquiryEditForm inquiryId={inq.id} subjectId={inq.subjectId ?? ""} assignedToId={inq.assignedToId ?? ""} note={inq.note} subjects={subjects} users={users} />
            ) : (
              <div className="text-sm text-slate-600">
                <div>Řeší: {inq.assignedTo?.name ?? "—"}</div>
                {inq.note && <p className="mt-2 whitespace-pre-line">{inq.note}</p>}
              </div>
            )}
          </div>
          {canWrite && inq.offers.length === 0 && (
            <form action={deleteInquiryAction} className="flex justify-end">
              <input type="hidden" name="id" value={inq.id} />
              <ConfirmButton message={`Smazat poptávku ${inq.number} včetně příloh?`}>Smazat poptávku</ConfirmButton>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
