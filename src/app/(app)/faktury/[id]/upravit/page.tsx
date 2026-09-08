import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadEditorData } from "@/lib/editor-data";
import { toInputDate, INVOICE_TYPE_SHORT } from "@/lib/format";
import { toEditorItems } from "@/lib/documents";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";
import { saveInvoiceAction } from "../../actions";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("invoices:write");
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } }, payments: true } });
  if (!inv) notFound();
  if (inv.status === "CANCELLED" || inv.payments.length > 0) redirect(`/faktury/${id}`);
  const { subjects, priceItems, settings } = await loadEditorData();
  return (
    <div>
      <PageHeader title={`Úprava – ${INVOICE_TYPE_SHORT[inv.type]} ${inv.number}`} subtitle={inv.status !== "DRAFT" ? "Doklad už byl vystaven, úpravy se propíší do PDF i ISDOC." : undefined} />
      <DocumentEditor
        mode="invoice"
        typeLocked
        header={{
          type: inv.type,
          subjectId: inv.subjectId,
          title: "",
          issueDate: toInputDate(inv.issueDate),
          validUntil: "",
          dueDate: toInputDate(inv.dueDate),
          taxDate: toInputDate(inv.taxDate),
          currency: inv.currency,
          exchangeRate: inv.exchangeRate.toString(),
          discountType: inv.discountType,
          discountValue: inv.discountValue.toString(),
          paymentMethod: inv.paymentMethod,
          roundTotal: inv.roundTotal,
          constantSymbol: inv.constantSymbol,
          note: inv.note,
          internalNote: inv.internalNote,
        }}
        items={toEditorItems(inv.items)}
        subjects={subjects}
        priceItems={priceItems}
        settings={settings}
        action={saveInvoiceAction.bind(null, inv.id)}
        cancelHref={`/faktury/${inv.id}`}
        returnTo={`/faktury/${inv.id}/upravit`}
      />
    </div>
  );
}
