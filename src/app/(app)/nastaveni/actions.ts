"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { firstError, formToObject, settingsSchema } from "@/lib/schemas";
import type { FormState } from "@/lib/action-state";
import { redirectWithError } from "@/lib/flash";

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("settings:write");
  const raw = formToObject(formData);
  raw.vatPayer = formData.get("vatPayer") === "on";
  raw.roundCzkTotals = formData.get("roundCzkTotals") === "on";
  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) return { error: firstError(parsed.error) };
  await prisma.companySettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
  revalidatePath("/", "layout");
  return { success: "Nastavení uloženo." };
}

const ROLES: Role[] = ["ADMIN", "SALES", "ACCOUNTANT", "VIEWER"];

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Neplatný e-mail"),
  name: z.string().trim().default(""),
  role: z.enum(ROLES),
});

export async function createInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser("users:manage");
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), name: formData.get("name"), role: formData.get("role") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { error: "Uživatel s tímto e-mailem už existuje." };
  const token = randomBytes(24).toString("base64url");
  await prisma.invitation.create({
    data: { ...parsed.data, token, expiresAt: new Date(Date.now() + 7 * 86400000), createdById: user.id },
  });
  revalidatePath("/nastaveni/uzivatele");
  return { success: `Pozvánka pro ${parsed.data.email} vytvořena. Odkaz zkopírujte a pošlete uživateli.` };
}

export async function deleteInvitationAction(formData: FormData) {
  await requireUser("users:manage");
  await prisma.invitation.delete({ where: { id: String(formData.get("id")) } });
  revalidatePath("/nastaveni/uzivatele");
}

export async function updateUserAction(formData: FormData) {
  const me = await requireUser("users:manage");
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as Role;
  const active = formData.get("active") === "1";
  if (!ROLES.includes(role)) return;
  if (id === me.id && (role !== "ADMIN" || !active)) redirectWithError("/nastaveni/uzivatele", "Nemůžete si odebrat vlastní administrátorská práva.");
  await prisma.user.update({ where: { id }, data: { role, active } });
  revalidatePath("/nastaveni/uzivatele");
}

const passwordSchema = z.object({
  id: z.string().min(1),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser("users:manage");
  const parsed = passwordSchema.safeParse({ id: formData.get("id"), password: formData.get("password") });
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { hashPassword } = await import("@/lib/auth");
  await prisma.user.update({ where: { id: parsed.data.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  return { success: "Heslo změněno." };
}
