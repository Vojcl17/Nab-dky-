"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstError, formToObject, subjectSchema } from "@/lib/schemas";
import type { FormState } from "@/lib/action-state";
import { redirectWithError } from "@/lib/flash";

export async function saveSubjectAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("subjects:write");
  const raw = formToObject(formData);
  raw.vatPayer = formData.get("vatPayer") === "on";
  const parsed = subjectSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = { ...parsed.data, aresUpdatedAt: formData.get("aresFilled") === "1" ? new Date() : undefined };
  const returnTo = String(formData.get("returnTo") ?? "");
  if (id) {
    await prisma.subject.update({ where: { id }, data });
    revalidatePath("/subjekty");
    redirect(returnTo || `/subjekty/${id}`);
  } else {
    const created = await prisma.subject.create({ data });
    const linkInquiryId = String(formData.get("linkInquiryId") ?? "");
    if (linkInquiryId) {
      await prisma.inquiry.updateMany({ where: { id: linkInquiryId, subjectId: null }, data: { subjectId: created.id } });
      revalidatePath(`/poptavky/${linkInquiryId}`);
    }
    revalidatePath("/subjekty");
    redirect(returnTo ? `${returnTo}${returnTo.includes("?") ? "&" : "?"}subjectId=${created.id}` : `/subjekty/${created.id}`);
  }
}

export async function deleteSubjectAction(formData: FormData) {
  await requireUser("subjects:write");
  const id = String(formData.get("id"));
  const s = await prisma.subject.findUnique({ where: { id }, select: { _count: { select: { offers: true, invoices: true } } } });
  if (!s) return;
  if (s._count.offers + s._count.invoices > 0) {
    redirectWithError(`/subjekty/${id}`, "Subjekt má doklady a nelze ho smazat.");
  }
  await prisma.subject.delete({ where: { id } });
  revalidatePath("/subjekty");
  redirect("/subjekty");
}
