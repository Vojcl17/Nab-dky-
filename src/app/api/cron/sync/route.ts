import { NextResponse } from "next/server";
import { syncFio } from "@/lib/fio";
import { syncMail } from "@/lib/mail";
import { getSettings } from "@/lib/settings";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Runs all periodic integrations that are configured: Fio bank sync and e-mail inquiries. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const settings = await getSettings();
  const result: Record<string, unknown> = {};
  if (settings.fioToken) result.fio = await syncFio();
  if (settings.imapHost && settings.imapUser) result.mail = await syncMail();
  return NextResponse.json(result);
}
