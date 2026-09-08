"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { OfferStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { firstError, offerSchema } from "@/lib/schemas";
import { nextNumber } from "@/lib/numbering";
import { itemsToCreate } from "@/lib/documents";
import { addDays, parseDateInput, toInputDate } from "@/lib/format";
import { createInvoice } from "@/lib/invoices";
import type { FormState } from "@/lib/action-state";
import { redirectWithError } from "@/lib/flash";
import { OFFER_TRANSITIONS as TRANSITIONS } from "@/lib/offer-status";

function parsePayload(formData: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Neplatná data formuláře." } as const;
  }
  const parsed = offerSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  return { data: parsed.data } as const;
}

export async function saveOfferAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("offers:write");
  const p = parsePayload(formData);
  if ("error" in p) return { error: p.error };
  const d = p.data;
  const settings = await getSettings();

  const base = {
    subjectId: d.subjectId,
    title: d.title,
    issueDate: parseDateInput(d.issueDate),
    validUntil: parseDateInput(d.validUntil),
    currency: d.currency,
    exchangeRate: d.exchangeRate,
    discountType: d.discountType,
    discountValue: d.discountValue,
    note: d.note,
    internalNote: d.internalNote,
  };

  let offerId = id;
  if (id) {
    const existing = await prisma.offer.findUnique({ where: { id }, select: { status: true } });
    if (!existing) return { error: "Nabídka neexistuje." };
    if (existing.status === "INVOICED") return { error: "Vyfakturovanou nabídku nelze upravovat." };
    await prisma.$transaction(async (tx) => {
      await tx.offerItem.deleteMany({ where: { offerId: id } });
      await tx.offer.update({ where: { id }, data: { ...base, items: { create: itemsToCreate(d.items) } } });
    });
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const number = await nextNumber(tx, "OFFER", settings.offerNumberFormat, base.issueDate);
      return tx.offer.create({ data: { ...base, number, createdById: user.id, items: { create: itemsToCreate(d.items) } } });
    });
    offerId = created.id;
  }
  revalidatePath("/nabidky");
  redirect(`/nabidky/${offerId}`);
}

export async function setOfferStatusAction(formData: FormData) {
  await requireUser("offers:write");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as OfferStatus;
  const offer = await prisma.offer.findUnique({ where: { id }, select: { status: true } });
  if (!offer) return;
  if (!TRANSITIONS[offer.status].includes(status)) redirectWithError(`/nabidky/${id}`, "Tato změna stavu není povolena.");
  await prisma.offer.update({ where: { id }, data: { status } });
  revalidatePath(`/nabidky/${id}`);
  revalidatePath("/nabidky");
}

export async function deleteOfferAction(formData: FormData) {
  await requireUser("offers:write");
  const id = String(formData.get("id"));
  const offer = await prisma.offer.findUnique({ where: { id }, select: { status: true, _count: { select: { invoices: true } } } });
  if (!offer) return;
  if (offer._count.invoices > 0) redirectWithError(`/nabidky/${id}`, "K nabídce existují faktury, nelze ji smazat.");
  await prisma.offer.delete({ where: { id } });
  revalidatePath("/nabidky");
  redirect("/nabidky");
}

export async function duplicateOfferAction(formData: FormData) {
  const user = await requireUser("offers:write");
  const id = String(formData.get("id"));
  const src = await prisma.offer.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!src) return;
  const settings = await getSettings();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  const created = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "OFFER", settings.offerNumberFormat, today);
    return tx.offer.create({
      data: {
        number,
        status: "DRAFT",
        subjectId: src.subjectId,
        title: src.title,
        issueDate: today,
        validUntil: addDays(today, settings.offerValidityDays),
        currency: src.currency,
        exchangeRate: src.exchangeRate,
        discountType: src.discountType,
        discountValue: src.discountValue,
        note: src.note,
        internalNote: src.internalNote,
        createdById: user.id,
        items: {
          create: src.items.map((it, i) => ({
            position: i,
            priceItemId: it.priceItemId,
            name: it.name,
            description: it.description,
            quantity: it.quantity,
            unit: it.unit,
            unitPrice: it.unitPrice,
            vatRate: it.vatRate,
            discountPercent: it.discountPercent,
          })),
        },
      },
    });
  });
  revalidatePath("/nabidky");
  redirect(`/nabidky/${created.id}/upravit`);
}

export async function createInvoiceFromOfferAction(formData: FormData) {
  const user = await requireUser("invoices:write");
  const id = String(formData.get("id"));
  const type = String(formData.get("type")) === "ADVANCE" ? "ADVANCE" : "INVOICE";
  const offer = await prisma.offer.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } } } });
  if (!offer) return;
  const settings = await getSettings();
  const today = toInputDate(new Date());
  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await createInvoice(
      tx,
      {
        type,
        subjectId: offer.subjectId,
        offerId: offer.id,
        issueDate: today,
        dueDate: toInputDate(addDays(today, settings.defaultDueDays)),
        taxDate: type === "ADVANCE" ? "" : today,
        currency: offer.currency,
        exchangeRate: offer.exchangeRate.toString(),
        discountType: offer.discountType,
        discountValue: offer.discountValue.toString(),
        paymentMethod: "BANK_TRANSFER",
        roundTotal: offer.currency === "CZK" && settings.roundCzkTotals,
        note: [offer.title ? `Fakturujeme Vám dle nabídky č. ${offer.number}: ${offer.title}` : `Fakturujeme Vám dle nabídky č. ${offer.number}.`, offer.note]
          .filter(Boolean)
          .join("\n"),
        internalNote: "",
        items: offer.items.map((it) => ({
          priceItemId: it.priceItemId,
          name: it.name,
          description: it.description,
          quantity: it.quantity.toString(),
          unit: it.unit,
          unitPrice: it.unitPrice.toString(),
          vatRate: it.vatRate,
          discountPercent: it.discountPercent.toString(),
          noDiscount: it.noDiscount,
        })),
        createdById: user.id,
      },
      settings,
    );
    if (type === "INVOICE") {
      await tx.offer.update({ where: { id }, data: { status: "INVOICED" } });
    } else if (offer.status !== "INVOICED") {
      await tx.offer.update({ where: { id }, data: { status: "ACCEPTED" } });
    }
    return inv;
  });
  revalidatePath("/nabidky");
  revalidatePath("/faktury");
  redirect(`/faktury/${invoice.id}`);
}
