import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCnbRate } from "@/lib/cnb";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const url = new URL(req.url);
  const currency = url.searchParams.get("mena") ?? "EUR";
  const date = url.searchParams.get("datum") ?? new Date().toISOString().slice(0, 10);
  try {
    const r = await getCnbRate(currency, date);
    if (!r) return NextResponse.json({ error: "Kurz nenalezen" }, { status: 404 });
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chyba ČNB" }, { status: 502 });
  }
}
