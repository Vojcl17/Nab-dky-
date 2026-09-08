import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { COMPANY_DEFAULTS } from "./company-defaults";

export const getSettings = cache(async () => {
  return prisma.companySettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...COMPANY_DEFAULTS },
    update: {},
  });
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;
