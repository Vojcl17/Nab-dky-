import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { formatDate, formatDateTime, INVOICE_STATUS_COLORS, INVOICE_STATUS_LABELS, INVOICE_TYPE_SHORT, OFFER_STATUS_COLORS, OFFER_STATUS_LABELS } from "@/lib/format";
import { OFFER_TRANSITIONS } from "@/lib/offer-status";
import { Badge, ConfirmButton, PageHeader } from "@/components/ui";
import { DocumentItems, TotalsSummary, totalsForDoc } from "@/components/document-items";
import { createInvoiceFromOfferAction, deleteOfferAction, duplicateOfferAction, setOfferStatusAction } from "../actions";

export default async function OfferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const offer = await prisma.offer.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      subject: true,
      createdBy: { select: { name: true } },
      invoices: { select: { id: true, number: true, type: true, status: true }, orderBy: { issueDate: "asc" } },
    },
  });
  if (!offer) notFound();
  const settings = await getSettings();
  const totals = totalsForDoc(offer, settings.vatPayer);
  const canWrite = userCan(user, "offers:write");
  const canInvoice = userCan(user, "invoices:write");
  const editable = offer.status !== "INVOICED";
  const transitions = OFFER_TRANSITIONS[offer.status];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Nabídka {offer.number}
            <Badge className={OFFER_STATUS_COLORS[offer.status]}>{OFFER_STATUS_LABELS[offer.status]}</Badge>
          </span>
        }
        subtitle={offer.title}
        actions={
          <>
            <a href={`/api/nabidky/${offer.id}/pdf`} className="btn-secondary" target="_blank" rel="noreferrer">
              PDF
            </a>
            {canWrite && editable && (
              <Link href={`/nabidky/${offer.id}/upravit`} className="btn-secondary">
                Upravit
              </Link>
            )}
            {canWrite && (
              <form action={duplicateOfferAction}>
                <input type="hidden" name="id" value={offer.id} />
                <button className="btn-secondary">Duplikovat</button>
              </form>
            )}
            {canInvoice && offer.status !== "INVOICED" && offer.status !== "REJECTED" && (
              <>
                <form action={createInvoiceFromOfferAction}>
                  <input type="hidden" name="id" value={offer.id} />
                  <input type="hidden" name="type" value="ADVANCE" />
                  <button className="btn-secondary">Zálohová faktura</button>
                </form>
                <form action={createInvoiceFromOfferAction}>
                  <input type="hidden" name="id" value={offer.id} />
                  <input type="hidden" name="type" value="INVOICE" />
                  <button className="btn-primary">Vystavit fakturu</button>
                </form>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Odběratel</h2>
          <Link href={`/subjekty/${offer.subject.id}`} className="font-medium text-indigo-700 hover:underline">
            {offer.subject.name}
          </Link>
          <div className="text-sm text-slate-600">
            {offer.subject.street}
            <br />
            {offer.subject.zip} {offer.subject.city}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {offer.subject.ico && <>IČO {offer.subject.ico} </>}
            {offer.subject.dic && <>DIČ {offer.subject.dic}</>}
          </div>
        </div>
        <div className="card p-5 text-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Údaje</h2>
          <dl className="grid grid-cols-2 gap-y-1">
            <dt className="text-slate-500">Vystaveno</dt>
            <dd>{formatDate(offer.issueDate)}</dd>
            <dt className="text-slate-500">Platnost do</dt>
            <dd>{formatDate(offer.validUntil)}</dd>
            <dt className="text-slate-500">Měna</dt>
            <dd>
              {offer.currency}
              {offer.currency !== "CZK" && <span className="text-slate-400"> (kurz {offer.exchangeRate.toString()})</span>}
            </dd>
            <dt className="text-slate-500">Vytvořil</dt>
            <dd>{offer.createdBy?.name ?? "—"}</dd>
            <dt className="text-slate-500">Upraveno</dt>
            <dd>{formatDateTime(offer.updatedAt)}</dd>
          </dl>
        </div>
        <div className="card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Stav</h2>
          {canWrite && transitions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {transitions.map((s) => (
                <form key={s} action={setOfferStatusAction}>
                  <input type="hidden" name="id" value={offer.id} />
                  <input type="hidden" name="status" value={s} />
                  <button className="btn-secondary btn-sm">{OFFER_STATUS_LABELS[s]}</button>
                </form>
              ))}
            </div>
          ) : (
            <div className="text-sm text-slate-500">Stav nelze měnit.</div>
          )}
          {offer.invoices.length > 0 && (
            <div className="mt-3 text-sm">
              <div className="mb-1 text-xs text-slate-500">Vystavené doklady</div>
              <ul className="space-y-1">
                {offer.invoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <Link href={`/faktury/${i.id}`} className="text-indigo-700 hover:underline">
                      {INVOICE_TYPE_SHORT[i.type]} {i.number}
                    </Link>
                    <Badge className={INVOICE_STATUS_COLORS[i.status]}>{INVOICE_STATUS_LABELS[i.status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <DocumentItems items={offer.items} totals={totals} currency={offer.currency} vatApplicable={settings.vatPayer} />
        <div className="flex justify-end border-t border-slate-100 p-5">
          <div className="w-full max-w-sm">
            <TotalsSummary totals={totals} currency={offer.currency} vatApplicable={settings.vatPayer} exchangeRate={offer.exchangeRate} />
          </div>
        </div>
      </div>

      {(offer.note || offer.internalNote) && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {offer.note && (
            <div className="card p-5 text-sm">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Text na nabídce</h2>
              <p className="whitespace-pre-line">{offer.note}</p>
            </div>
          )}
          {offer.internalNote && (
            <div className="card p-5 text-sm">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Interní poznámka</h2>
              <p className="whitespace-pre-line">{offer.internalNote}</p>
            </div>
          )}
        </div>
      )}

      {canWrite && offer.invoices.length === 0 && (
        <form action={deleteOfferAction} className="flex justify-end">
          <input type="hidden" name="id" value={offer.id} />
          <ConfirmButton message={`Opravdu smazat nabídku ${offer.number}?`}>Smazat nabídku</ConfirmButton>
        </form>
      )}
    </div>
  );
}
