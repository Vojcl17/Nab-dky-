import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { loadEditorData } from "@/lib/editor-data";
import { toInputDate } from "@/lib/format";
import { toEditorItems } from "@/lib/documents";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";
import { saveOfferAction } from "../../actions";

export default async function EditOfferPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("offers:write");
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!offer) notFound();
  if (offer.status === "INVOICED") redirect(`/nabidky/${id}`);
  const { subjects, priceItems, settings } = await loadEditorData();
  return (
    <div>
      <PageHeader title={`Úprava nabídky ${offer.number}`} />
      <DocumentEditor
        mode="offer"
        header={{
          subjectId: offer.subjectId,
          title: offer.title,
          issueDate: toInputDate(offer.issueDate),
          validUntil: toInputDate(offer.validUntil),
          dueDate: "",
          taxDate: "",
          currency: offer.currency,
          exchangeRate: offer.exchangeRate.toString(),
          discountType: offer.discountType,
          discountValue: offer.discountValue.toString(),
          paymentMethod: "BANK_TRANSFER",
          roundTotal: false,
          constantSymbol: "",
          note: offer.note,
          internalNote: offer.internalNote,
          type: "INVOICE",
        }}
        items={toEditorItems(offer.items)}
        subjects={subjects}
        priceItems={priceItems}
        settings={settings}
        action={saveOfferAction.bind(null, offer.id)}
        cancelHref={`/nabidky/${offer.id}`}
        returnTo={`/nabidky/${offer.id}/upravit`}
      />
    </div>
  );
}
