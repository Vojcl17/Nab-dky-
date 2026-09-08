import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loadEditorData } from "@/lib/editor-data";
import { addDays, toInputDate, todayInput } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";
import { saveOfferAction } from "../actions";

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ subjectId?: string; inquiryId?: string }> }) {
  await requireUser("offers:write");
  const { subjectId = "", inquiryId = "" } = await searchParams;
  const { subjects, priceItems, settings, raw } = await loadEditorData();
  const inquiry = inquiryId ? await prisma.inquiry.findUnique({ where: { id: inquiryId }, select: { id: true, number: true, subject: true, subjectId: true } }) : null;
  const today = todayInput();
  return (
    <div>
      <PageHeader title="Nová nabídka" subtitle={inquiry ? `K poptávce ${inquiry.number}: ${inquiry.subject}` : undefined} />
      <DocumentEditor
        mode="offer"
        header={{
          subjectId: subjectId || inquiry?.subjectId || "",
          inquiryId: inquiry?.id ?? "",
          title: inquiry?.subject ?? "",
          issueDate: today,
          validUntil: toInputDate(addDays(today, raw.offerValidityDays)),
          dueDate: "",
          taxDate: "",
          currency: "CZK",
          exchangeRate: "1",
          discountType: "NONE",
          discountValue: "0",
          paymentMethod: "BANK_TRANSFER",
          roundTotal: false,
          constantSymbol: "",
          note: raw.offerFooterNote,
          internalNote: "",
          type: "INVOICE",
        }}
        items={[]}
        subjects={subjects}
        priceItems={priceItems}
        settings={settings}
        action={saveOfferAction.bind(null, null)}
        cancelHref="/nabidky"
        returnTo={`/nabidky/nova${inquiryId ? `?inquiryId=${inquiryId}` : ""}`}
        submitLabel="Vytvořit nabídku"
      />
    </div>
  );
}
