import { z } from "zod";

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).replace(",", ".").trim())
  .refine((v) => v === "" || !isNaN(Number(v)), "Neplatné číslo");

export const documentItemSchema = z.object({
  id: z.string().optional(),
  priceItemId: z.string().nullable().optional(),
  name: z.string().trim().min(1, "Název položky je povinný"),
  description: z.string().default(""),
  quantity: decimalString.refine((v) => v !== "" && Number(v) !== 0, "Množství musí být nenulové"),
  unit: z.string().default("ks"),
  unitPrice: decimalString.transform((v) => (v === "" ? "0" : v)),
  vatRate: z.coerce.number().int().min(0).max(100),
  discountPercent: decimalString.transform((v) => (v === "" ? "0" : v)),
  noDiscount: z.boolean().optional().default(false),
});

export type DocumentItemInput = z.infer<typeof documentItemSchema>;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Neplatné datum");

export const offerSchema = z.object({
  subjectId: z.string().min(1, "Vyberte odběratele"),
  title: z.string().default(""),
  issueDate: dateString,
  validUntil: dateString,
  currency: z.enum(["CZK", "EUR"]),
  exchangeRate: decimalString.transform((v) => (v === "" ? "1" : v)),
  discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]),
  discountValue: decimalString.transform((v) => (v === "" ? "0" : v)),
  note: z.string().default(""),
  internalNote: z.string().default(""),
  items: z.array(documentItemSchema).min(1, "Přidejte alespoň jednu položku"),
});

export type OfferInput = z.infer<typeof offerSchema>;

export const invoiceSchema = z.object({
  type: z.enum(["INVOICE", "ADVANCE", "TAX_DOCUMENT", "CREDIT_NOTE"]),
  subjectId: z.string().min(1, "Vyberte odběratele"),
  issueDate: dateString,
  dueDate: dateString,
  taxDate: dateString.or(z.literal("")).default(""),
  currency: z.enum(["CZK", "EUR"]),
  exchangeRate: decimalString.transform((v) => (v === "" ? "1" : v)),
  discountType: z.enum(["NONE", "PERCENT", "AMOUNT"]),
  discountValue: decimalString.transform((v) => (v === "" ? "0" : v)),
  paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CARD"]),
  roundTotal: z.boolean().default(false),
  constantSymbol: z.string().default(""),
  note: z.string().default(""),
  internalNote: z.string().default(""),
  items: z.array(documentItemSchema).min(1, "Přidejte alespoň jednu položku"),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const subjectSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný"),
  ico: z.string().trim().default(""),
  dic: z.string().trim().default(""),
  street: z.string().trim().default(""),
  city: z.string().trim().default(""),
  zip: z.string().trim().default(""),
  country: z.string().trim().default("CZ"),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  contactPerson: z.string().trim().default(""),
  note: z.string().default(""),
  vatPayer: z.boolean().default(false),
});

export const priceItemSchema = z.object({
  code: z.string().trim().default(""),
  name: z.string().trim().min(1, "Název je povinný"),
  description: z.string().default(""),
  unit: z.string().trim().default("ks"),
  priceCzk: decimalString.transform((v) => (v === "" ? "0" : v)),
  priceEur: decimalString.transform((v) => (v === "" ? null : v)),
  vatRate: z.coerce.number().int().min(0).max(100),
  active: z.boolean().default(true),
});

export const settingsSchema = z.object({
  name: z.string().trim().default(""),
  ico: z.string().trim().default(""),
  dic: z.string().trim().default(""),
  street: z.string().trim().default(""),
  city: z.string().trim().default(""),
  zip: z.string().trim().default(""),
  country: z.string().trim().default("CZ"),
  email: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  web: z.string().trim().default(""),
  registrationNote: z.string().default(""),
  bankAccount: z.string().trim().default(""),
  bankCode: z.string().trim().default(""),
  iban: z.string().trim().default(""),
  bic: z.string().trim().default(""),
  vatPayer: z.boolean().default(true),
  defaultVatRate: z.coerce.number().int().min(0).max(100).default(21),
  defaultDueDays: z.coerce.number().int().min(0).max(365).default(14),
  offerValidityDays: z.coerce.number().int().min(0).max(365).default(30),
  roundCzkTotals: z.boolean().default(false),
  offerNumberFormat: z.string().trim().min(1).default("N{YYYY}{NNNN}"),
  invoiceNumberFormat: z.string().trim().min(1).default("{YYYY}{NNNN}"),
  advanceNumberFormat: z.string().trim().min(1).default("Z{YYYY}{NNNN}"),
  taxDocNumberFormat: z.string().trim().min(1).default("D{YYYY}{NNNN}"),
  creditNoteNumberFormat: z.string().trim().min(1).default("O{YYYY}{NNNN}"),
  offerFooterNote: z.string().default(""),
  invoiceFooterNote: z.string().default(""),
  fioToken: z.string().trim().default(""),
});

export function formToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

export function firstError(e: z.ZodError): string {
  const issue = e.issues[0];
  return issue ? `${issue.path.length ? issue.path.join(".") + ": " : ""}${issue.message}` : "Neplatná data";
}
