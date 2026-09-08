import "server-only";
import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import type { Invoice, InvoiceItem, Subject } from "@prisma/client";
import { computeTotals, dec } from "./totals";
import { readSupplier } from "./documents";
import type { Settings } from "./settings";
import { czechIban } from "./bank";
import { toInputDate, COUNTRY_NAMES } from "./format";

const esc = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const el = (name: string, value: string | number | null | undefined, attrs = "") => `<${name}${attrs}>${esc(value)}</${name}>`;
const money = (d: Decimal | number) => new Decimal(d).toFixed(2);

const DOCUMENT_TYPES: Record<Invoice["type"], number> = {
  INVOICE: 1,
  CREDIT_NOTE: 2,
  ADVANCE: 4,
  TAX_DOCUMENT: 5,
};

const PAYMENT_CODES = { BANK_TRANSFER: "42", CASH: "10", CARD: "48" } as const;

function splitStreet(street: string) {
  const m = street.trim().match(/^(.*?)[\s,]+([\d][\d\w/]*)$/);
  if (m) return { street: m[1], number: m[2] };
  return { street: street.trim(), number: "" };
}

function party(p: { name: string; ico: string; dic: string; street: string; city: string; zip: string; country: string; email?: string; phone?: string }) {
  const { street, number } = splitStreet(p.street);
  return `<Party>
<PartyIdentification>${el("ID", p.ico)}</PartyIdentification>
<PartyName>${el("Name", p.name)}</PartyName>
<PostalAddress>${el("StreetName", street)}${el("BuildingNumber", number)}${el("CityName", p.city)}${el("PostalZone", p.zip.replace(/\s/g, ""))}<Country>${el("IdentificationCode", p.country || "CZ")}${el("Name", COUNTRY_NAMES[p.country] ?? p.country)}</Country></PostalAddress>
${p.dic ? `<PartyTaxScheme>${el("CompanyID", p.dic)}${el("TaxScheme", "VAT")}</PartyTaxScheme>` : ""}
${p.email || p.phone ? `<Contact>${p.phone ? el("Telephone", p.phone) : ""}${p.email ? el("ElectronicMail", p.email) : ""}</Contact>` : ""}
</Party>`;
}

/** Generates an ISDOC 6.0.1 document for the invoice. */
export function renderIsdoc(inv: Invoice & { items: InvoiceItem[]; subject: Subject; relatedInvoice?: { number: string } | null }, settings: Settings): string {
  const supplier = readSupplier(inv.supplier, settings);
  const vatApplicable = supplier.vatPayer;
  const totals = computeTotals({ items: inv.items, discountType: inv.discountType, discountValue: inv.discountValue, roundTotal: inv.roundTotal, vatApplicable });
  const foreign = inv.currency !== "CZK";
  const rate = foreign ? dec(inv.exchangeRate) : new Decimal(1);
  const loc = (d: Decimal) => money(d.mul(rate));
  /** amount pair: Curr element (foreign) + local element */
  const pair = (name: string, d: Decimal) => (foreign ? el(`${name}Curr`, money(d)) : "") + el(name, loc(d));

  const lines = inv.items
    .map((it, i) => {
      const l = totals.lines[i];
      const qty = dec(it.quantity);
      const unitPrice = dec(it.unitPrice);
      const unitPriceTaxIncl = unitPrice.mul(100 + l.vatRate).div(100);
      return `<InvoiceLine>
${el("ID", String(i + 1))}
${el("InvoicedQuantity", qty.toFixed(3), ` unitCode="${esc(it.unit)}"`)}
${pair("LineExtensionAmount", l.netBase)}
${pair("LineExtensionAmountTaxInclusive", l.total)}
${pair("LineExtensionTaxAmount", l.vat)}
${el("UnitPrice", money(unitPrice))}
${el("UnitPriceTaxInclusive", money(unitPriceTaxIncl))}
<ClassifiedTaxCategory>${el("Percent", l.vatRate)}${el("VATCalculationMethod", "0")}</ClassifiedTaxCategory>
${Number(it.discountPercent) ? `<Note>Sleva ${it.discountPercent.toString()} %</Note>` : ""}
<Item>${el("Description", [it.name, it.description].filter(Boolean).join(" – "))}</Item>
</InvoiceLine>`;
    })
    .join("\n");

  const zero = new Decimal(0);
  const subTotals = totals.vatGroups
    .map(
      (g) => `<TaxSubTotal>
${pair("TaxableAmount", g.base)}
${pair("TaxAmount", g.vat)}
${pair("TaxInclusiveAmount", g.total)}
${pair("AlreadyClaimedTaxableAmount", zero)}
${pair("AlreadyClaimedTaxAmount", zero)}
${pair("AlreadyClaimedTaxInclusiveAmount", zero)}
${pair("DifferenceTaxableAmount", g.base)}
${pair("DifferenceTaxAmount", g.vat)}
${pair("DifferenceTaxInclusiveAmount", g.total)}
<TaxCategory>${el("Percent", g.rate)}${el("VATApplicable", vatApplicable ? "true" : "false")}</TaxCategory>
</TaxSubTotal>`,
    )
    .join("\n");

  const iban = supplier.iban || czechIban(supplier.bankAccount, supplier.bankCode);
  const paid = dec(inv.paidAmount);
  const noteParts = [inv.note];
  if (inv.type === "ADVANCE") noteParts.push("Zálohová faktura – není daňovým dokladem.");
  if (inv.relatedInvoice) noteParts.push(`Související doklad č. ${inv.relatedInvoice.number}`);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="http://isdoc.cz/namespace/2013" version="6.0.1">
${el("DocumentType", DOCUMENT_TYPES[inv.type])}
${el("ID", inv.number)}
${el("UUID", randomUUID())}
${el("IssuingSystem", "Nabídky a faktury")}
${el("IssueDate", toInputDate(inv.issueDate))}
${inv.taxDate ? el("TaxPointDate", toInputDate(inv.taxDate)) : ""}
${el("VATApplicable", vatApplicable ? "true" : "false")}
<ElectronicPossibilityAgreementReference/>
${noteParts.filter(Boolean).length ? el("Note", noteParts.filter(Boolean).join("\n")) : ""}
${el("LocalCurrencyCode", "CZK")}
${foreign ? el("ForeignCurrencyCode", inv.currency) : ""}
${el("CurrRate", foreign ? rate.toFixed(4) : "1")}
${el("RefCurrRate", "1")}
<AccountingSupplierParty>${party(supplier)}</AccountingSupplierParty>
<AccountingCustomerParty>${party({
    name: inv.customerName || inv.subject.name,
    ico: inv.customerIco,
    dic: inv.customerDic,
    street: inv.customerStreet,
    city: inv.customerCity,
    zip: inv.customerZip,
    country: inv.customerCountry,
    email: inv.customerEmail,
  })}</AccountingCustomerParty>
<InvoiceLines>
${lines}
</InvoiceLines>
<TaxTotal>
${subTotals}
${pair("TaxAmount", totals.vat)}
</TaxTotal>
<LegalMonetaryTotal>
${pair("TaxExclusiveAmount", totals.base)}
${pair("TaxInclusiveAmount", totals.total)}
${pair("AlreadyClaimedTaxExclusiveAmount", zero)}
${pair("AlreadyClaimedTaxInclusiveAmount", zero)}
${pair("DifferenceTaxExclusiveAmount", totals.base)}
${pair("DifferenceTaxInclusiveAmount", totals.total)}
${pair("PayableRoundingAmount", totals.rounding)}
${pair("PaidDepositsAmount", inv.type === "TAX_DOCUMENT" ? totals.total : zero)}
${pair("PayableAmount", inv.type === "TAX_DOCUMENT" ? zero : totals.payable)}
</LegalMonetaryTotal>
<PaymentMeans>
<Payment>
${el("PaidAmount", money(inv.type === "TAX_DOCUMENT" ? totals.total : totals.payable.minus(paid)))}
${el("PaymentMeansCode", PAYMENT_CODES[inv.paymentMethod])}
<Details>
${el("PaymentDueDate", toInputDate(inv.dueDate))}
${el("ID", supplier.bankAccount)}
${el("BankCode", supplier.bankCode)}
${iban ? el("IBAN", iban) : ""}
${supplier.bic ? el("BIC", supplier.bic) : ""}
${el("VariableSymbol", inv.variableSymbol)}
${inv.constantSymbol ? el("ConstantSymbol", inv.constantSymbol) : ""}
</Details>
</Payment>
</PaymentMeans>
</Invoice>
`.replace(/\n{2,}/g, "\n");
}
