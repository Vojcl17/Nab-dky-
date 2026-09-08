import "server-only";
import type { InvoiceType, Prisma, SequenceKind } from "@prisma/client";
import { prisma } from "./db";
import { nextNumber, variableSymbolFromNumber } from "./numbering";
import { customerSnapshot, itemsToCreate, supplierSnapshot } from "./documents";
import type { Settings } from "./settings";
import type { DocumentItemInput } from "./schemas";
import { computeTotals, dec } from "./totals";
import { parseDateInput } from "./format";

type Tx = Prisma.TransactionClient;

export function sequenceKindFor(type: InvoiceType): SequenceKind {
  switch (type) {
    case "INVOICE":
      return "INVOICE";
    case "ADVANCE":
      return "ADVANCE";
    case "TAX_DOCUMENT":
      return "TAX_DOCUMENT";
    case "CREDIT_NOTE":
      return "CREDIT_NOTE";
  }
}

export function numberFormatFor(type: InvoiceType, s: Settings) {
  switch (type) {
    case "INVOICE":
      return s.invoiceNumberFormat;
    case "ADVANCE":
      return s.advanceNumberFormat;
    case "TAX_DOCUMENT":
      return s.taxDocNumberFormat;
    case "CREDIT_NOTE":
      return s.creditNoteNumberFormat;
  }
}

export interface NewInvoiceData {
  type: InvoiceType;
  subjectId: string;
  offerId?: string | null;
  relatedInvoiceId?: string | null;
  issueDate: string;
  dueDate: string;
  taxDate?: string;
  currency: "CZK" | "EUR";
  exchangeRate: string;
  discountType: "NONE" | "PERCENT" | "AMOUNT";
  discountValue: string;
  paymentMethod: "BANK_TRANSFER" | "CASH" | "CARD";
  roundTotal: boolean;
  constantSymbol?: string;
  note: string;
  internalNote: string;
  items: DocumentItemInput[];
  createdById: string;
  status?: "DRAFT" | "ISSUED";
}

export async function createInvoice(tx: Tx, data: NewInvoiceData, settings: Settings) {
  const subject = await tx.subject.findUniqueOrThrow({ where: { id: data.subjectId } });
  const issueDate = parseDateInput(data.issueDate);
  const number = await nextNumber(tx, sequenceKindFor(data.type), numberFormatFor(data.type, settings), issueDate);
  return tx.invoice.create({
    data: {
      number,
      type: data.type,
      status: data.status ?? "DRAFT",
      subjectId: data.subjectId,
      offerId: data.offerId ?? null,
      relatedInvoiceId: data.relatedInvoiceId ?? null,
      variableSymbol: variableSymbolFromNumber(number),
      constantSymbol: data.constantSymbol ?? "",
      issueDate,
      dueDate: parseDateInput(data.dueDate),
      taxDate: data.taxDate ? parseDateInput(data.taxDate) : data.type === "ADVANCE" ? null : issueDate,
      currency: data.currency,
      exchangeRate: data.exchangeRate,
      discountType: data.discountType,
      discountValue: data.discountValue,
      paymentMethod: data.paymentMethod,
      roundTotal: data.roundTotal,
      note: data.note,
      internalNote: data.internalNote,
      ...customerSnapshot(subject),
      supplier: supplierSnapshot(settings) as unknown as Prisma.InputJsonValue,
      createdById: data.createdById,
      items: { create: itemsToCreate(data.items) },
    },
    include: { items: true },
  });
}

/** Recomputes paidAmount and status from payments. */
export async function recalcInvoicePayments(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, payments: true } });
  if (inv.status === "DRAFT" || inv.status === "CANCELLED") return inv;
  const totals = computeTotals({ items: inv.items, discountType: inv.discountType, discountValue: inv.discountValue, roundTotal: inv.roundTotal });
  const paid = inv.payments.reduce((s, p) => s.plus(dec(p.amount)), dec(0));
  const payable = totals.payable;
  let status: "ISSUED" | "PARTIALLY_PAID" | "PAID" = "ISSUED";
  if (payable.isZero()) {
    status = "PAID";
  } else if (payable.gt(0)) {
    if (paid.gte(payable.minus(0.005))) status = "PAID";
    else if (paid.gt(0)) status = "PARTIALLY_PAID";
  } else {
    // credit note: settled when the refunded (negative) amount reaches the total
    if (paid.lte(payable.plus(0.005))) status = "PAID";
    else if (paid.lt(0)) status = "PARTIALLY_PAID";
  }
  const lastPayment = inv.payments.map((p) => p.date).sort((a, b) => b.getTime() - a.getTime())[0];
  return tx.invoice.update({
    where: { id: invoiceId },
    data: { paidAmount: paid.toFixed(2), status, paidAt: status === "PAID" ? (lastPayment ?? new Date()) : null },
    include: { items: true, payments: true },
  });
}

export const invoiceInclude = {
  items: { orderBy: { position: "asc" as const } },
  subject: true,
  offer: { select: { id: true, number: true } },
  relatedInvoice: { select: { id: true, number: true, type: true } },
  relatedTo: { select: { id: true, number: true, type: true, status: true }, orderBy: { issueDate: "asc" as const } },
  payments: { orderBy: { date: "desc" as const }, include: { bankTransaction: true, createdBy: { select: { name: true } } } },
  createdBy: { select: { name: true } },
} satisfies Prisma.InvoiceInclude;

export type InvoiceWithAll = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export async function getInvoice(id: string) {
  return prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
}
