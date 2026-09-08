import "server-only";
import path from "node:path";
import PdfPrinter from "pdfmake";
import type { Content, ContentTable, TDocumentDefinitions, TableCell } from "pdfmake/interfaces";
import type { Invoice, InvoiceItem, Offer, OfferItem, Subject } from "@prisma/client";
import { computeTotals } from "./totals";
import { formatDate, formatMoney, formatQuantity, INVOICE_TYPE_LABELS } from "./format";
import { readSupplier, type SupplierSnapshot } from "./documents";
import type { Settings } from "./settings";
import { czechIban, spaydString } from "./bank";

import fs from "node:fs";

const fontsDir = path.join(process.cwd(), "fonts");
const logoPath = path.join(process.cwd(), "public", "logo.png");
const logo = fs.existsSync(logoPath) ? logoPath : null;

function titleRow(title: string, subtitle: string, number: string): Content {
  const right: Content = { stack: [{ text: title, fontSize: 18, bold: true, alignment: "right" }, { text: `č. ${number}`, fontSize: 12, alignment: "right" }, ...(subtitle ? [{ text: subtitle, color: GRAY, alignment: "right" } as Content] : [])] };
  return logo ? { columns: [{ image: logo, fit: [170, 64], width: 180 }, right], columnGap: 20 } : right;
}
const printer = new PdfPrinter({
  Liberation: {
    normal: path.join(fontsDir, "LiberationSans-Regular.ttf"),
    bold: path.join(fontsDir, "LiberationSans-Bold.ttf"),
    italics: path.join(fontsDir, "LiberationSans-Italic.ttf"),
    bolditalics: path.join(fontsDir, "LiberationSans-BoldItalic.ttf"),
  },
});

function render(def: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument({
      ...def,
      defaultStyle: { font: "Liberation", fontSize: 9, ...(def.defaultStyle ?? {}) },
      pageSize: "A4",
      pageMargins: [40, 40, 40, 50],
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

const GRAY = "#6b7280";
const LINE = "#e5e7eb";

function partyBlock(title: string, p: { name: string; street: string; city: string; zip: string; country: string; ico: string; dic: string; extra?: string[] }): Content {
  return {
    stack: [
      { text: title, color: GRAY, fontSize: 8, margin: [0, 0, 0, 4] },
      { text: p.name, bold: true, fontSize: 11 },
      { text: [p.street, `${p.zip} ${p.city}`.trim(), p.country !== "CZ" ? p.country : ""].filter(Boolean).join("\n") },
      { text: [p.ico ? `IČO: ${p.ico}` : "", p.dic ? `DIČ: ${p.dic}` : ""].filter(Boolean).join("   "), margin: [0, 4, 0, 0] },
      ...(p.extra ?? []).filter(Boolean).map((t) => ({ text: t, color: GRAY })),
    ],
  };
}

type AnyItem = OfferItem | InvoiceItem;

function itemsTable(items: AnyItem[], totals: ReturnType<typeof computeTotals>, currency: string, vatApplicable: boolean): Content {
  const header: TableCell[] = [
    { text: "#", color: GRAY },
    { text: "Položka", color: GRAY },
    { text: "Množství", color: GRAY, alignment: "right" },
    { text: "Cena/MJ", color: GRAY, alignment: "right" },
    ...(vatApplicable ? [{ text: "DPH", color: GRAY, alignment: "right" } as TableCell] : []),
    { text: "Sleva", color: GRAY, alignment: "right" },
    { text: vatApplicable ? "Bez DPH" : "Celkem", color: GRAY, alignment: "right" },
  ];
  const body: TableCell[][] = [header];
  items.forEach((it, i) => {
    const l = totals.lines[i];
    body.push([
      { text: String(i + 1), color: GRAY },
      { stack: [{ text: it.name }, ...(it.description ? [{ text: it.description, color: GRAY, fontSize: 8 }] : [])] },
      { text: `${formatQuantity(it.quantity)} ${it.unit}`.trim(), alignment: "right", noWrap: true },
      { text: formatMoney(it.unitPrice, currency), alignment: "right", noWrap: true },
      ...(vatApplicable ? [{ text: `${it.vatRate} %`, alignment: "right" } as TableCell] : []),
      { text: Number(it.discountPercent) ? `${formatQuantity(it.discountPercent)} %` : "", alignment: "right" },
      { text: formatMoney(l.base.toNumber(), currency), alignment: "right", noWrap: true },
    ]);
  });
  const widths = vatApplicable ? [16, "*", 60, 70, 34, 36, 75] : [16, "*", 60, 70, 40, 75];
  return {
    table: { headerRows: 1, widths, body },
    layout: {
      hLineWidth: (i: number) => (i === 0 ? 0 : 0.5),
      vLineWidth: () => 0,
      hLineColor: () => LINE,
      paddingTop: () => 4,
      paddingBottom: () => 4,
      paddingLeft: () => 3,
      paddingRight: () => 3,
    },
    margin: [0, 10, 0, 10],
  };
}

function totalsBlock(totals: ReturnType<typeof computeTotals>, currency: string, vatApplicable: boolean, rate: number, opts: { showCzk?: boolean; payLabel?: string; paid?: number } = {}): ContentTable {
  const rows: TableCell[][] = [];
  const showCzk = !!opts.showCzk && currency !== "CZK" && rate > 0;
  if (totals.discountAmount.gt(0)) {
    rows.push([{ text: "Položky celkem bez DPH", color: GRAY }, { text: formatMoney(totals.subtotal.toNumber(), currency), alignment: "right" }]);
    rows.push([{ text: "Sleva na doklad", color: GRAY }, { text: "− " + formatMoney(totals.discountAmount.toNumber(), currency), alignment: "right" }]);
  }
  if (vatApplicable) {
    const head: TableCell[] = [
      { text: "Sazba DPH", color: GRAY },
      { text: "Základ", color: GRAY, alignment: "right" },
      { text: "DPH", color: GRAY, alignment: "right" },
      { text: "Celkem", color: GRAY, alignment: "right" },
    ];
    if (showCzk) head.push({ text: "Základ v CZK", color: GRAY, alignment: "right" }, { text: "DPH v CZK", color: GRAY, alignment: "right" });
    const vatRows: TableCell[][] = [head];
    for (const g of totals.vatGroups) {
      const r: TableCell[] = [
        { text: `${g.rate} %` },
        { text: formatMoney(g.base.toNumber(), currency), alignment: "right" },
        { text: formatMoney(g.vat.toNumber(), currency), alignment: "right" },
        { text: formatMoney(g.total.toNumber(), currency), alignment: "right" },
      ];
      if (showCzk) r.push({ text: formatMoney(g.base.toNumber() * rate, "CZK"), alignment: "right" }, { text: formatMoney(g.vat.toNumber() * rate, "CZK"), alignment: "right" });
      vatRows.push(r);
    }
    rows.push([
      {
        colSpan: 2,
        table: { widths: showCzk ? [58, "*", "*", "*", "*", "*"] : [58, "*", "*", "*"], body: vatRows },
        layout: { hLineWidth: (i: number) => (i === 1 ? 0.5 : 0), vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0, paddingRight: () => 4 },
      },
      {},
    ]);
  } else {
    rows.push([{ text: "Celkem bez DPH", color: GRAY }, { text: formatMoney(totals.base.toNumber(), currency), alignment: "right" }]);
  }
  if (!totals.rounding.isZero()) {
    rows.push([{ text: "Zaokrouhlení", color: GRAY }, { text: formatMoney(totals.rounding.toNumber(), currency), alignment: "right" }]);
  }
  if (opts.paid !== undefined && opts.paid !== 0) {
    rows.push([{ text: "Celkem", color: GRAY }, { text: formatMoney(totals.payable.toNumber(), currency), alignment: "right" }]);
    rows.push([{ text: "Uhrazeno", color: GRAY }, { text: "− " + formatMoney(opts.paid, currency), alignment: "right" }]);
    rows.push([
      { text: opts.payLabel ?? "Zbývá uhradit", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
      { text: formatMoney(Math.max(0, totals.payable.toNumber() - opts.paid), currency), bold: true, fontSize: 12, alignment: "right", margin: [0, 4, 0, 0] },
    ]);
  } else {
    rows.push([
      { text: opts.payLabel ?? "Celkem k úhradě", bold: true, fontSize: 12, margin: [0, 4, 0, 0] },
      { text: formatMoney(totals.payable.toNumber(), currency), bold: true, fontSize: 12, alignment: "right", margin: [0, 4, 0, 0] },
    ]);
  }
  if (showCzk) {
    rows.push([{ text: `Kurz ČNB ${formatQuantity(rate)} CZK/${currency}`, color: GRAY, fontSize: 8 }, { text: formatMoney(totals.payable.toNumber() * rate, "CZK"), color: GRAY, alignment: "right", fontSize: 8 }]);
  }
  return {
    table: { widths: ["*", 110], body: rows },
    layout: "noBorders",
  };
}

function footer(supplier: SupplierSnapshot, settings: Settings) {
  return (currentPage: number, pageCount: number): Content => ({
    columns: [
      { text: [supplier.registrationNote || settings.registrationNote, [supplier.email, supplier.phone, supplier.web].filter(Boolean).join(" · ")].filter(Boolean).join("\n"), color: GRAY, fontSize: 7 },
      { text: `Strana ${currentPage} / ${pageCount}`, alignment: "right", color: GRAY, fontSize: 7 },
    ],
    margin: [40, 10, 40, 0],
  });
}

export async function renderOfferPdf(offer: Offer & { items: OfferItem[]; subject: Subject; createdBy?: { name: string } | null }, settings: Settings): Promise<Buffer> {
  const supplier = readSupplier(null, settings);
  const vatApplicable = settings.vatPayer;
  const totals = computeTotals({ items: offer.items, discountType: offer.discountType, discountValue: offer.discountValue, vatApplicable });
  const rate = Number(offer.exchangeRate);
  const def: TDocumentDefinitions = {
    info: { title: `Nabídka ${offer.number}`, author: supplier.name },
    footer: footer(supplier, settings),
    content: [
      titleRow("NABÍDKA", offer.title, offer.number),
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#111827" }], margin: [0, 8, 0, 12] },
      {
        columns: [
          partyBlock("DODAVATEL", { ...supplier, extra: [[supplier.email, supplier.phone].filter(Boolean).join(" · ")] }),
          partyBlock("ODBĚRATEL", {
            name: offer.subject.name,
            street: offer.subject.street,
            city: offer.subject.city,
            zip: offer.subject.zip,
            country: offer.subject.country,
            ico: offer.subject.ico,
            dic: offer.subject.dic,
            extra: [offer.subject.contactPerson, offer.subject.email].filter(Boolean),
          }),
        ],
        columnGap: 20,
      },
      {
        margin: [0, 14, 0, 0],
        table: {
          widths: ["*", "*", "*"],
          body: [
            [
              { text: [{ text: "Datum vystavení\n", color: GRAY, fontSize: 8 }, formatDate(offer.issueDate)] },
              { text: [{ text: "Platnost nabídky do\n", color: GRAY, fontSize: 8 }, formatDate(offer.validUntil)] },
              { text: [{ text: "Měna\n", color: GRAY, fontSize: 8 }, offer.currency + (offer.currency !== "CZK" ? ` (kurz ${formatQuantity(rate)})` : "")] },
            ],
          ],
        },
        layout: { hLineWidth: () => 0.5, vLineWidth: () => 0, hLineColor: () => LINE, paddingLeft: () => 0 },
      },
      itemsTable(offer.items, totals, offer.currency, vatApplicable),
      { columns: [{ width: "*", text: "" }, { width: 300, ...totalsBlock(totals, offer.currency, vatApplicable, rate, { payLabel: "Celkem" }) }] },
      offer.note ? { text: offer.note, margin: [0, 16, 0, 0], color: "#374151" } : "",
      offer.createdBy?.name ? { text: `Vystavil: ${offer.createdBy.name}`, margin: [0, 14, 0, 0], color: GRAY, fontSize: 8 } : "",
    ],
  };
  return render(def);
}

const TYPE_TITLES: Record<Invoice["type"], string> = {
  INVOICE: "FAKTURA",
  ADVANCE: "ZÁLOHOVÁ FAKTURA",
  TAX_DOCUMENT: "DAŇOVÝ DOKLAD",
  CREDIT_NOTE: "OPRAVNÝ DAŇOVÝ DOKLAD",
};

const PAYMENT_LABELS = { BANK_TRANSFER: "bankovním převodem", CASH: "hotově", CARD: "platební kartou" } as const;

export async function renderInvoicePdf(
  inv: Invoice & { items: InvoiceItem[]; subject: Subject; createdBy?: { name: string } | null; relatedInvoice?: { number: string; type: Invoice["type"] } | null },
  settings: Settings,
): Promise<Buffer> {
  const supplier = readSupplier(inv.supplier, settings);
  const vatApplicable = supplier.vatPayer;
  const totals = computeTotals({ items: inv.items, discountType: inv.discountType, discountValue: inv.discountValue, roundTotal: inv.roundTotal, vatApplicable });
  const rate = Number(inv.exchangeRate);
  const iban = supplier.iban || czechIban(supplier.bankAccount, supplier.bankCode);
  const paid = Number(inv.paidAmount);
  const remaining = Math.max(0, totals.payable.toNumber() - paid);
  const showQr = inv.paymentMethod === "BANK_TRANSFER" && iban && remaining > 0 && inv.type !== "TAX_DOCUMENT" && inv.type !== "CREDIT_NOTE";
  const subtitle =
    inv.type === "INVOICE"
      ? vatApplicable
        ? "daňový doklad"
        : "neplátce DPH"
      : inv.type === "ADVANCE"
        ? "není daňovým dokladem"
        : inv.type === "TAX_DOCUMENT"
          ? "k přijaté platbě"
          : `k dokladu č. ${inv.relatedInvoice?.number ?? ""}`;

  const paymentRows: TableCell[][] = [
    [{ text: "Bankovní účet", color: GRAY }, { text: supplier.bankAccount ? `${supplier.bankAccount}/${supplier.bankCode}` : "—", bold: true }],
    ...(iban ? [[{ text: "IBAN", color: GRAY }, { text: iban }] as TableCell[]] : []),
    ...(supplier.bic ? [[{ text: "BIC/SWIFT", color: GRAY }, { text: supplier.bic }] as TableCell[]] : []),
    [{ text: "Variabilní symbol", color: GRAY }, { text: inv.variableSymbol, bold: true }],
    ...(inv.constantSymbol ? [[{ text: "Konstantní symbol", color: GRAY }, { text: inv.constantSymbol }] as TableCell[]] : []),
    [{ text: "Způsob úhrady", color: GRAY }, { text: PAYMENT_LABELS[inv.paymentMethod] }],
  ];
  const dateRows: TableCell[][] = [
    [{ text: "Datum vystavení", color: GRAY }, { text: formatDate(inv.issueDate) }],
    ...(inv.taxDate ? [[{ text: inv.type === "TAX_DOCUMENT" ? "Datum přijetí platby" : "Datum zdanitelného plnění", color: GRAY }, { text: formatDate(inv.taxDate) }] as TableCell[]] : []),
    [{ text: "Datum splatnosti", color: GRAY }, { text: formatDate(inv.dueDate), bold: true }],
    ...(inv.currency !== "CZK" ? [[{ text: "Měna / kurz ČNB", color: GRAY }, { text: `${inv.currency} / ${formatQuantity(rate)}` }] as TableCell[]] : []),
  ];

  const def: TDocumentDefinitions = {
    info: { title: `${TYPE_TITLES[inv.type]} ${inv.number}`, author: supplier.name },
    footer: footer(supplier, settings),
    content: [
      titleRow(TYPE_TITLES[inv.type], subtitle, inv.number),
      { canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#111827" }], margin: [0, 8, 0, 12] },
      {
        columns: [
          partyBlock("DODAVATEL", { ...supplier, extra: [!supplier.vatPayer ? "Neplátce DPH" : "", [supplier.email, supplier.phone].filter(Boolean).join(" · ")] }),
          partyBlock("ODBĚRATEL", {
            name: inv.customerName || inv.subject.name,
            street: inv.customerStreet,
            city: inv.customerCity,
            zip: inv.customerZip,
            country: inv.customerCountry,
            ico: inv.customerIco,
            dic: inv.customerDic,
          }),
        ],
        columnGap: 20,
      },
      {
        margin: [0, 14, 0, 0],
        columns: [
          { table: { widths: [90, "*"], body: paymentRows }, layout: "noBorders" },
          { table: { widths: [120, "*"], body: dateRows }, layout: "noBorders" },
        ],
        columnGap: 20,
      },
      itemsTable(inv.items, totals, inv.currency, vatApplicable),
      {
        columns: [
          {
            width: "*",
            stack: showQr
              ? [
                  {
                    qr: spaydString({ iban, bic: supplier.bic, amount: remaining.toFixed(2), currency: inv.currency, vs: inv.variableSymbol, ks: inv.constantSymbol, message: `${TYPE_TITLES[inv.type]} ${inv.number}` }),
                    fit: 90,
                  },
                  { text: "QR platba", color: GRAY, fontSize: 7, margin: [12, 2, 0, 0] },
                ]
              : [],
          },
          { width: 300, ...totalsBlock(totals, inv.currency, vatApplicable, rate, { showCzk: true, paid: inv.status === "DRAFT" ? 0 : paid, payLabel: inv.type === "TAX_DOCUMENT" ? "Celkem přijato" : inv.type === "CREDIT_NOTE" ? "Celkem k vrácení" : undefined }) },
        ],
      },
      inv.note ? { text: inv.note, margin: [0, 16, 0, 0], color: "#374151" } : "",
      inv.type === "ADVANCE" ? { text: "Zálohová faktura není daňovým dokladem. Daňový doklad bude vystaven po přijetí platby.", margin: [0, 8, 0, 0], color: GRAY, fontSize: 8 } : "",
      { text: [inv.createdBy?.name ? `Vystavil: ${inv.createdBy.name}` : "", settings.invoiceFooterNote && settings.invoiceFooterNote !== inv.note ? settings.invoiceFooterNote : ""].filter(Boolean).join("\n"), margin: [0, 14, 0, 0], color: GRAY, fontSize: 8 },
    ],
  };
  return render(def);
}

export const invoiceTypeLabel = (t: Invoice["type"]) => INVOICE_TYPE_LABELS[t];
