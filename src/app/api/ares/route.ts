import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { lookupAres } from "@/lib/ares";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const ico = new URL(req.url).searchParams.get("ico") ?? "";
  try {
    const subject = await lookupAres(ico);
    if (!subject) return NextResponse.json({ error: "Subjekt s tímto IČO nebyl v ARES nalezen." }, { status: 404 });
    return NextResponse.json(subject);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chyba ARES" }, { status: 502 });
  }
}
