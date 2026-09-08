"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { firstError, invoiceSchema } from "@/lib/schemas";
import { customerSnapshot, itemsToCreate, supplierSnapshot } from "@/lib/documents";
import { createInvoice, recalcInvoicePayments } from "@/lib/invoices";
import { computeTotals, dec } from "@/lib/totals";
import { parseDateInput, toInputDate, INVOICE_TYPE_SHORT } from "@/lib/format";
import type { FormState } from "@/lib/action-state";
import { redirectWithError } from "@/lib/flash";

function parsePayload(formData: FormData) {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? "{}"));
  } catch {
    return { error: "Neplatná data formuláře." } as const;
  }
  const parsed = invoiceSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) } as const;
  if (parsed.data.dueDate < parsed.data.issueDate) return { error: "Splatnost nemůže být před datem vystavení." } as const;
  return { data: parsed.data } as const;
}

export async function saveInvoiceAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("invoices:write");
  const p = parsePayload(formData);
  if ("error" in p) return { error: p.error };
  const d = p.data;
  const settings = await getSettings();

  if (id) {
    const existing = await prisma.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!existing) return { error: "Faktura neexistuje." };
    if (existing.status === "CANCELLED") return { error: "Stornovanou fakturu nelze upravovat." };
    if (existing.payments.length > 0) return { error: "Fakturu s evidovanými úhradami nelze upravovat." };
    const subject = await prisma.subject.findUniqueOrThrow({ where: { id: d.subjectId } });
    await prisma.$transaction(async (tx) => {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          subjectId: d.subjectId,
          issueDate: parseDateInput(d.issueDate),
          dueDate: parseDateInput(d.dueDate),
          taxDate: d.taxDate ? parseDateInput(d.taxDate) : existing.type === "ADVANCE" ? null : parseDateInput(d.issueDate),
          currency: d.currency,
          exchangeRate: d.exchangeRate,
          discountType: d.discountType,
          discountValue: d.discountValue,
          paymentMethod: d.paymentMethod,
          roundTotal: d.roundTotal && d.currency === "CZK",
          constantSymbol: d.constantSymbol,
          note: d.note,
          internalNote: d.internalNote,
          ...customerSnapshot(subject),
          items: { create: itemsToCreate(d.items) },
        },
      });
    });
    revalidatePath("/faktury");
    redirect(`/faktury/${id}`);
  }

  const type = d.type === "ADVANCE" ? "ADVANCE" : "INVOICE";
  const created = await prisma.$transaction((tx) =>
    createInvoice(
      tx,
      {
        ...d,
        type,
        roundTotal: d.roundTotal && d.currency === "CZK",
        createdById: user.id,
      },
      settings,
    ),
  );
  revalidatePath("/faktury");
  redirect(`/faktury/${created.id}`);
}

export async function issueInvoiceAction(formData: FormData) {
  await requireUser("invoices:write");
  const id = String(formData.get("id"));
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { subject: true, items: true } });
  if (!inv || inv.status !== "DRAFT") return;
  if (inv.items.length === 0) redirectWithError(`/faktury/${id}`, "Faktura nemá žádné položky.");
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({
      where: { id },
      data: {
        status: "ISSUED",
        ...customerSnapshot(inv.subject),
        supplier: supplierSnapshot(settings) as unknown as Prisma.InputJsonValue,
      },
    });
    await recalcInvoicePayments(tx, id);
  });
  revalidatePath(`/faktury/${id}`);
  revalidatePath("/faktury");
}

export async function cancelInvoiceAction(formData: FormData) {
  await requireUser("invoices:write");
  const id = String(formData.get("id"));
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { payments: true, relatedTo: true } });
  if (!inv) return;
  if (inv.payments.length > 0) redirectWithError(`/faktury/${id}`, "Fakturu s úhradami nelze stornovat – nejdřív odeberte úhrady nebo vystavte dobropis.");
  if (inv.relatedTo.length > 0) redirectWithError(`/faktury/${id}`, "Na fakturu navazují další doklady, nelze ji stornovat.");
  await prisma.invoice.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  revalidatePath(`/faktury/${id}`);
  revalidatePath("/faktury");
}

export async function deleteInvoiceAction(formData: FormData) {
  await requireUser("invoices:write");
  const id = String(formData.get("id"));
  const inv = await prisma.invoice.findUnique({ where: { id }, include: { relatedTo: true } });
  if (!inv) return;
  if (inv.status !== "DRAFT") redirectWithError(`/faktury/${id}`, "Smazat lze jen rozpracovanou fakturu. Vystavenou fakturu stornujte.");
  if (inv.relatedTo.length > 0) redirectWithError(`/faktury/${id}`, "Na fakturu navazují další doklady.");
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/faktury");
  redirect("/faktury");
}

export async function addPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("payments:write");
  const invoiceId = String(formData.get("invoiceId"));
  const amount = dec(String(formData.get("amount") ?? ""));
  const date = String(formData.get("date") ?? "");
  const note = String(formData.get("note") ?? "");
  if (amount.isZero()) return { error: "Zadejte částku." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Zadejte datum." };
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return { error: "Faktura neexistuje." };
  if (inv.status === "DRAFT" || inv.status === "CANCELLED") return { error: "Úhradu lze přidat jen k vystavené faktuře." };
  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { invoiceId, amount: amount.toFixed(2), currency: inv.currency, date: parseDateInput(date), note, createdById: user.id },
    });
    await recalcInvoicePayments(tx, invoiceId);
  });
  revalidatePath(`/faktury/${invoiceId}`);
  revalidatePath("/faktury");
  return { success: "Úhrada přidána." };
}

export async function deletePaymentAction(formData: FormData) {
  await requireUser("payments:write");
  const id = String(formData.get("id"));
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return;
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id } });
    await recalcInvoicePayments(tx, payment.invoiceId);
  });
  revalidatePath(`/faktury/${payment.invoiceId}`);
  revalidatePath("/faktury");
  revalidatePath("/banka");
}

/** Creates a tax document (daňový doklad k přijaté platbě) for the not-yet-documented paid part of an advance. */
export async function createTaxDocumentAction(formData: FormData) {
  const user = await requireUser("invoices:write");
  const advanceId = String(formData.get("id"));
  const settings = await getSettings();
  const adv = await prisma.invoice.findUnique({
    where: { id: advanceId },
    include: { items: { orderBy: { position: "asc" } }, payments: { orderBy: { date: "desc" } }, relatedTo: { include: { items: true } } },
  });
  if (!adv || adv.type !== "ADVANCE") return;
  const totals = computeTotals({ items: adv.items, discountType: adv.discountType, discountValue: adv.discountValue, roundTotal: adv.roundTotal, vatApplicable: settings.vatPayer });
  const paid = dec(adv.paidAmount);
  const documented = adv.relatedTo
    .filter((r) => r.type === "TAX_DOCUMENT" && r.status !== "CANCELLED")
    .reduce((s, r) => s.plus(computeTotals({ items: r.items, discountType: "NONE", discountValue: 0, vatApplicable: settings.vatPayer }).total), dec(0));
  const remaining = paid.minus(documented);
  if (remaining.lte(0)) redirectWithError(`/faktury/${advanceId}`, "K přijatým platbám už jsou daňové doklady vystaveny.");
  const proportion = totals.total.gt(0) ? remaining.div(totals.total) : dec(1);
  const paymentDate = toInputDate(adv.payments[0]?.date ?? new Date());
  const items = totals.vatGroups.map((g) => {
    // split the received amount (incl. VAT) into base and VAT for this rate
    const gross = g.total.mul(proportion);
    const base = gross.div(1 + g.rate / 100).toDecimalPlaces(2);
    return {
      priceItemId: null,
      name: `Přijatá platba k zálohové faktuře č. ${adv.number}${settings.vatPayer ? ` – DPH ${g.rate} %` : ""}`,
      description: "",
      quantity: "1",
      unit: "",
      unitPrice: base.toFixed(2),
      vatRate: g.rate,
      discountPercent: "0",
      noDiscount: false,
    };
  });
  const doc = await prisma.$transaction(async (tx) => {
    const created = await createInvoice(
      tx,
      {
        type: "TAX_DOCUMENT",
        subjectId: adv.subjectId,
        offerId: adv.offerId,
        relatedInvoiceId: adv.id,
        issueDate: toInputDate(new Date()),
        dueDate: paymentDate,
        taxDate: paymentDate,
        currency: adv.currency,
        exchangeRate: adv.exchangeRate.toString(),
        discountType: "NONE",
        discountValue: "0",
        paymentMethod: adv.paymentMethod,
        roundTotal: false,
        note: `Daňový doklad k platbě přijaté dne ${paymentDate.split("-").reverse().join(".")} na zálohovou fakturu č. ${adv.number} (VS ${adv.variableSymbol}).`,
        internalNote: "",
        items,
        createdById: user.id,
        status: "ISSUED",
      },
      settings,
    );
    // the tax document is settled by the received payment
    const t = computeTotals({ items: created.items, discountType: "NONE", discountValue: 0, vatApplicable: settings.vatPayer });
    await tx.invoice.update({ where: { id: created.id }, data: { status: "PAID", paidAmount: t.total.toFixed(2), paidAt: parseDateInput(paymentDate) } });
    return created;
  });
  revalidatePath("/faktury");
  redirect(`/faktury/${doc.id}`);
}

/** Creates the final invoice from an advance: original items minus the deduction of the advance already documented. */
export async function createFinalInvoiceAction(formData: FormData) {
  const user = await requireUser("invoices:write");
  const advanceId = String(formData.get("id"));
  const settings = await getSettings();
  const adv = await prisma.invoice.findUnique({
    where: { id: advanceId },
    include: { items: { orderBy: { position: "asc" } }, relatedTo: { include: { items: true } } },
  });
  if (!adv || adv.type !== "ADVANCE") return;
  const taxDocs = adv.relatedTo.filter((r) => r.type === "TAX_DOCUMENT" && r.status !== "CANCELLED");
  if (adv.relatedTo.some((r) => r.type === "INVOICE" && r.status !== "CANCELLED")) redirectWithError(`/faktury/${advanceId}`, "Konečná faktura k této záloze už existuje.");

  const deductionByRate = new Map<number, { base: ReturnType<typeof dec>; numbers: string[] }>();
  if (settings.vatPayer) {
    if (taxDocs.length === 0) redirectWithError(`/faktury/${advanceId}`, "Nejdřív vystavte daňový doklad k přijaté platbě, konečná faktura odečítá zdaněné zálohy.");
    for (const td of taxDocs) {
      const t = computeTotals({ items: td.items, discountType: "NONE", discountValue: 0 });
      for (const g of t.vatGroups) {
        const cur = deductionByRate.get(g.rate) ?? { base: dec(0), numbers: [] };
        cur.base = cur.base.plus(g.base);
        if (!cur.numbers.includes(td.number)) cur.numbers.push(td.number);
        deductionByRate.set(g.rate, cur);
      }
    }
  } else {
    const paid = dec(adv.paidAmount);
    if (paid.lte(0)) redirectWithError(`/faktury/${advanceId}`, "Záloha ještě nebyla uhrazena.");
    deductionByRate.set(0, { base: paid, numbers: [adv.number] });
  }

  const today = toInputDate(new Date());
  const items = [
    ...adv.items.map((it) => ({
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
    ...[...deductionByRate.entries()].map(([rate, d]) => ({
      priceItemId: null,
      name: settings.vatPayer ? `Odpočet zálohy – daňový doklad č. ${d.numbers.join(", ")} (DPH ${rate} %)` : `Odpočet uhrazené zálohy č. ${d.numbers.join(", ")}`,
      description: "",
      quantity: "-1",
      unit: "",
      unitPrice: d.base.toFixed(2),
      vatRate: rate,
      discountPercent: "0",
      noDiscount: true,
    })),
  ];
  const inv = await prisma.$transaction((tx) =>
    createInvoice(
      tx,
      {
        type: "INVOICE",
        subjectId: adv.subjectId,
        offerId: adv.offerId,
        relatedInvoiceId: adv.id,
        issueDate: today,
        dueDate: toInputDate(new Date(Date.now() + settings.defaultDueDays * 86400000)),
        taxDate: today,
        currency: adv.currency,
        exchangeRate: adv.exchangeRate.toString(),
        discountType: adv.discountType,
        discountValue: adv.discountValue.toString(),
        paymentMethod: adv.paymentMethod,
        roundTotal: adv.currency === "CZK" && settings.roundCzkTotals,
        note: `Konečné vyúčtování k zálohové faktuře č. ${adv.number}.`,
        internalNote: "",
        items,
        createdById: user.id,
      },
      settings,
    ),
  );
  revalidatePath("/faktury");
  redirect(`/faktury/${inv.id}`);
}

export async function createCreditNoteAction(formData: FormData) {
  const user = await requireUser("invoices:write");
  const invoiceId = String(formData.get("id"));
  const settings = await getSettings();
  const src = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { items: { orderBy: { position: "asc" } } } });
  if (!src || src.type === "CREDIT_NOTE" || src.status === "DRAFT" || src.status === "CANCELLED") return;
  const today = toInputDate(new Date());
  const inv = await prisma.$transaction((tx) =>
    createInvoice(
      tx,
      {
        type: "CREDIT_NOTE",
        subjectId: src.subjectId,
        offerId: src.offerId,
        relatedInvoiceId: src.id,
        issueDate: today,
        dueDate: toInputDate(new Date(Date.now() + settings.defaultDueDays * 86400000)),
        taxDate: today,
        currency: src.currency,
        exchangeRate: src.exchangeRate.toString(),
        discountType: src.discountType,
        discountValue: src.discountValue.toString(),
        paymentMethod: src.paymentMethod,
        roundTotal: src.roundTotal,
        note: `Opravný daňový doklad k dokladu ${INVOICE_TYPE_SHORT[src.type].toLowerCase()} č. ${src.number} ze dne ${toInputDate(src.issueDate).split("-").reverse().join(".")}. Důvod opravy: `,
        internalNote: "",
        items: src.items.map((it) => ({
          priceItemId: it.priceItemId,
          name: it.name,
          description: it.description,
          quantity: it.quantity.neg().toString(),
          unit: it.unit,
          unitPrice: it.unitPrice.toString(),
          vatRate: it.vatRate,
          discountPercent: it.discountPercent.toString(),
          noDiscount: it.noDiscount,
        })),
        createdById: user.id,
      },
      settings,
    ),
  );
  revalidatePath("/faktury");
  redirect(`/faktury/${inv.id}/upravit`);
}
