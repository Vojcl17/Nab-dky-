import { NextResponse } from "next/server";
import { syncMail } from "@/lib/mail";
import { cronAuthorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  const result = await syncMail();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
