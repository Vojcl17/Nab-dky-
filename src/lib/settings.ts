import "server-only";
import { cache } from "react";
import { prisma } from "./db";

export const getSettings = cache(async () => {
  return prisma.companySettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;
