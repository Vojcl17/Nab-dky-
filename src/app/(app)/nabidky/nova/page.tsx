import { requireUser } from "@/lib/auth";
import { loadEditorData } from "@/lib/editor-data";
import { addDays, toInputDate, todayInput } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";
import { saveOfferAction } from "../actions";

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ subjectId?: string }> }) {
  await requireUser("offers:write");
  const { subjectId = "" } = await searchParams;
  const { subjects, priceItems, settings, raw } = await loadEditorData();
  const today = todayInput();
  return (
    <div>
      <PageHeader title="Nová nabídka" />
      <DocumentEditor
        mode="offer"
        header={{
          subjectId,
          title: "",
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
        returnTo="/nabidky/nova"
        submitLabel="Vytvořit nabídku"
      />
    </div>
  );
}
