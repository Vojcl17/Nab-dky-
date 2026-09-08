"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstError, formToObject, priceItemSchema } from "@/lib/schemas";
import type { FormState } from "@/lib/action-state";

export async function savePriceItemAction(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("pricelist:write");
  const raw = formToObject(formData);
  raw.active = formData.get("active") === "on";
  const parsed = priceItemSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = parsed.data;
  if (id) {
    await prisma.priceItem.update({ where: { id }, data });
  } else {
    await prisma.priceItem.create({ data });
  }
  revalidatePath("/cenik");
  redirect("/cenik");
}

export async function deletePriceItemAction(formData: FormData) {
  await requireUser("pricelist:write");
  const id = String(formData.get("id"));
  const used = await prisma.priceItem.findUnique({
    where: { id },
    select: { _count: { select: { offerItems: true, invoiceItems: true } } },
  });
  if (!used) return;
  if (used._count.offerItems + used._count.invoiceItems > 0) {
    await prisma.priceItem.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.priceItem.delete({ where: { id } });
  }
  revalidatePath("/cenik");
  redirect("/cenik");
}
