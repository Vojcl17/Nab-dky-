"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { matchTransaction, setFioPointer, syncFio } from "@/lib/fio";
import { recalcInvoicePayments } from "@/lib/invoices";
import type { FormState } from "@/lib/action-state";

export async function syncFioAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("bank:sync");
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? "");
  const result = await syncFio(from && to ? { from, to } : {});
  revalidatePath("/banka");
  revalidatePath("/faktury");
  return result.ok ? { success: result.message } : { error: result.message };
}

export async function setFioPointerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("bank:sync");
  const date = String(formData.get("date") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Zadejte datum." };
  try {
    await setFioPointer(date);
    return { success: `Zarážka nastavena na ${date}. Další synchronizace stáhne pohyby od tohoto data.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Chyba Fio" };
  }
}

export async function matchManuallyAction(formData: FormData) {
  await requireUser("payments:write");
  const transactionId = String(formData.get("transactionId"));
  const invoiceId = String(formData.get("invoiceId"));
  if (!invoiceId) return;
  await matchTransaction(transactionId, invoiceId);
  revalidatePath("/banka");
  revalidatePath("/faktury");
}

export async function unmatchAction(formData: FormData) {
  await requireUser("payments:write");
  const transactionId = String(formData.get("transactionId"));
  const payment = await prisma.payment.findUnique({ where: { bankTransactionId: transactionId } });
  if (!payment) return;
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: payment.id } });
    await recalcInvoicePayments(tx, payment.invoiceId);
  });
  revalidatePath("/banka");
  revalidatePath("/faktury");
}
