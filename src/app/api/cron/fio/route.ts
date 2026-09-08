import { NextResponse } from "next/server";
import { syncFio } from "@/lib/fio";

export const dynamic = "force-dynamic";

/** Periodic bank sync. Call e.g. hourly: curl -H "Authorization: Bearer $CRON_SECRET" https://app/api/cron/fio */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : new URL(req.url).searchParams.get("secret") ?? "";
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const result = await syncFio();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
