"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { clearSessionCookie, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import type { FormState } from "@/lib/action-state";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Neplatný e-mail"),
  password: z.string().min(1, "Zadejte heslo"),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.active || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Nesprávný e-mail nebo heslo." };
  }
  await setSessionCookie(user.id);
  redirect("/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

const setupSchema = z.object({
  name: z.string().trim().min(1, "Zadejte jméno"),
  email: z.string().trim().toLowerCase().email("Neplatný e-mail"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
  companyName: z.string().trim().default(""),
});

export async function setupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const count = await prisma.user.count();
  if (count > 0) return { error: "Aplikace už je nastavená." };
  const parsed = setupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    companyName: formData.get("companyName"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      passwordHash: await hashPassword(parsed.data.password),
      role: "ADMIN",
    },
  });
  await prisma.companySettings.upsert({
    where: { id: "default" },
    create: { id: "default", name: parsed.data.companyName },
    update: { name: parsed.data.companyName },
  });
  await setSessionCookie(user.id);
  redirect("/nastaveni");
}

const acceptSchema = z.object({
  token: z.string().min(1),
  name: z.string().trim().min(1, "Zadejte jméno"),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků"),
});

export async function acceptInvitationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const inv = await prisma.invitation.findUnique({ where: { token: parsed.data.token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return { error: "Pozvánka je neplatná nebo vypršela." };
  const existing = await prisma.user.findUnique({ where: { email: inv.email } });
  if (existing) return { error: "Uživatel s tímto e-mailem už existuje." };
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: { email: inv.email, name: parsed.data.name, role: inv.role, passwordHash: await hashPassword(parsed.data.password) },
    });
    await tx.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return u;
  });
  await setSessionCookie(user.id);
  redirect("/");
}
