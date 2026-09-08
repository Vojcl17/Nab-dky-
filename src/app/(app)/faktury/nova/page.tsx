import { requireUser } from "@/lib/auth";
import { loadEditorData } from "@/lib/editor-data";
import { addDays, toInputDate, todayInput } from "@/lib/format";
import { PageHeader } from "@/components/ui";
import { DocumentEditor } from "@/components/document-editor";
import { saveInvoiceAction } from "../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ subjectId?: string; typ?: string }> }) {
  await requireUser("invoices:write");
  const { subjectId = "", typ = "" } = await searchParams;
  const { subjects, priceItems, settings, raw } = await loadEditorData();
  const today = todayInput();
  const type = typ === "ADVANCE" ? "ADVANCE" : "INVOICE";
  return (
    <div>
      <PageHeader title={type === "ADVANCE" ? "Nová zálohová faktura" : "Nová faktura"} />
      <DocumentEditor
        mode="invoice"
        header={{
          type,
          subjectId,
          title: "",
          issueDate: today,
          validUntil: "",
          dueDate: toInputDate(addDays(today, raw.defaultDueDays)),
          taxDate: today,
          currency: "CZK",
          exchangeRate: "1",
          discountType: "NONE",
          discountValue: "0",
          paymentMethod: "BANK_TRANSFER",
          roundTotal: raw.roundCzkTotals,
          constantSymbol: "",
          note: raw.invoiceFooterNote,
          internalNote: "",
        }}
        items={[]}
        subjects={subjects}
        priceItems={priceItems}
        settings={settings}
        action={saveInvoiceAction.bind(null, null)}
        cancelHref="/faktury"
        returnTo={`/faktury/nova${typ ? `?typ=${typ}` : ""}`}
        submitLabel="Vytvořit fakturu"
      />
    </div>
  );
}
