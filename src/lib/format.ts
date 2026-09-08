import type { InvoiceStatus, InvoiceType, OfferStatus, Currency, InquiryStatus } from "@prisma/client";

export function formatMoney(value: number | string | { toString(): string } | null | undefined, currency: string = "CZK") {
  const n = typeof value === "number" ? value : Number(String(value ?? 0).replace(",", "."));
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    isNaN(n) ? 0 : n,
  );
}

export function formatNumber(value: number | string | { toString(): string } | null | undefined, digits = 2) {
  const n = typeof value === "number" ? value : Number(String(value ?? 0).replace(",", "."));
  return new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(isNaN(n) ? 0 : n);
}

export function formatQuantity(value: number | string | { toString(): string }) {
  const n = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  return new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(isNaN(n) ? 0 : n);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("cs-CZ", { dateStyle: "short", timeStyle: "short" }).format(date);
}

/** yyyy-mm-dd for <input type="date"> (UTC based, matches @db.Date columns). */
export function toInputDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(d: Date | string, days: number) {
  const date = new Date(typeof d === "string" ? d : d.toISOString());
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function parseDateInput(s: string): Date {
  // interpret as UTC midnight so @db.Date columns store exactly this day
  return new Date(`${s}T00:00:00.000Z`);
}

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: "Rozpracovaná",
  SENT: "Odeslaná",
  ACCEPTED: "Přijatá",
  REJECTED: "Odmítnutá",
  EXPIRED: "Vypršela",
  INVOICED: "Vyfakturovaná",
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SENT: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  EXPIRED: "bg-amber-100 text-amber-800",
  INVOICED: "bg-violet-100 text-violet-800",
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Rozpracovaná",
  ISSUED: "Vystavená",
  PARTIALLY_PAID: "Částečně uhrazená",
  PAID: "Uhrazená",
  CANCELLED: "Stornovaná",
};

export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-blue-100 text-blue-800",
  PARTIALLY_PAID: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  INVOICE: "Faktura – daňový doklad",
  ADVANCE: "Zálohová faktura",
  TAX_DOCUMENT: "Daňový doklad k přijaté platbě",
  CREDIT_NOTE: "Opravný daňový doklad (dobropis)",
};

export const INVOICE_TYPE_SHORT: Record<InvoiceType, string> = {
  INVOICE: "Faktura",
  ADVANCE: "Záloha",
  TAX_DOCUMENT: "DD k platbě",
  CREDIT_NOTE: "Dobropis",
};

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  NEW: "Nová",
  IN_PROGRESS: "V řešení",
  OFFERED: "Nabídnuto",
  WON: "Vyhráno",
  LOST: "Prohráno",
  SPAM: "Spam",
};

export const INQUIRY_STATUS_COLORS: Record<InquiryStatus, string> = {
  NEW: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  OFFERED: "bg-violet-100 text-violet-800",
  WON: "bg-emerald-100 text-emerald-800",
  LOST: "bg-rose-100 text-rose-800",
  SPAM: "bg-slate-100 text-slate-500",
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export const CURRENCIES: Currency[] = ["CZK", "EUR"];

export const VAT_RATES = [21, 12, 0];

export const COUNTRY_NAMES: Record<string, string> = {
  CZ: "Česká republika",
  SK: "Slovensko",
  DE: "Německo",
  AT: "Rakousko",
  PL: "Polsko",
};
