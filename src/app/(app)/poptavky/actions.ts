"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { InquiryStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { nextNumber } from "@/lib/numbering";
import { firstError, formToObject, inquirySchema } from "@/lib/schemas";
import { syncMail } from "@/lib/mail";
import { redirectWithError } from "@/lib/flash";
import type { FormState } from "@/lib/action-state";

export async function syncMailAction(_prev: FormState, _formData: FormData): Promise<FormState> {
  await requireUser("inquiries:write");
  const result = await syncMail();
  revalidatePath("/poptavky");
  return result.ok ? { success: result.message } : { error: result.message };
}

export async function createInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("inquiries:write");
  const parsed = inquirySchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  const settings = await getSettings();
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const number = await nextNumber(tx, "INQUIRY", settings.inquiryNumberFormat, now);
    return tx.inquiry.create({
      data: {
        number,
        source: "MANUAL",
        fromName: d.fromName,
        fromEmail: d.fromEmail,
        fromPhone: d.fromPhone,
        subject: d.subject,
        bodyText: d.bodyText,
        subjectId: d.subjectId || null,
        note: d.note,
        receivedAt: now,
      },
    });
  });
  revalidatePath("/poptavky");
  redirect(`/poptavky/${created.id}`);
}

const STATUSES: InquiryStatus[] = ["NEW", "IN_PROGRESS", "OFFERED", "WON", "LOST", "SPAM"];

export async function setInquiryStatusAction(formData: FormData) {
  await requireUser("inquiries:write");
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as InquiryStatus;
  if (!STATUSES.includes(status)) return;
  await prisma.inquiry.update({ where: { id }, data: { status } });
  revalidatePath(`/poptavky/${id}`);
  revalidatePath("/poptavky");
}

export async function updateInquiryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("inquiries:write");
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId") ?? "");
  const assignedToId = String(formData.get("assignedToId") ?? "");
  const note = String(formData.get("note") ?? "");
  await prisma.inquiry.update({
    where: { id },
    data: { subjectId: subjectId || null, assignedToId: assignedToId || null, note },
  });
  revalidatePath(`/poptavky/${id}`);
  revalidatePath("/poptavky");
  return { success: "Uloženo." };
}

export async function deleteInquiryAction(formData: FormData) {
  await requireUser("inquiries:write");
  const id = String(formData.get("id"));
  const inq = await prisma.inquiry.findUnique({ where: { id }, select: { _count: { select: { offers: true } } } });
  if (!inq) return;
  if (inq._count.offers > 0) redirectWithError(`/poptavky/${id}`, "K poptávce existují nabídky, označte ji raději jako prohranou.");
  await prisma.inquiry.delete({ where: { id } });
  revalidatePath("/poptavky");
  redirect("/poptavky");
}
