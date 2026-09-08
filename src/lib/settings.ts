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

/** Settings without secrets, safe to pass to client components. */
export function publicSettings(s: Settings) {
  const { fioToken: _f, imapPassword: _p, ...rest } = s;
  void _f;
  void _p;
  return { ...rest, hasFioToken: !!s.fioToken, hasImapPassword: !!s.imapPassword };
}
