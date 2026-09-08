import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderOfferPdf } from "@/lib/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, include: { items: { orderBy: { position: "asc" } }, subject: true, createdBy: { select: { name: true } } } });
  if (!offer) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  const pdf = await renderOfferPdf(offer, await getSettings());
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="nabidka-${offer.number}.pdf"`,
    },
  });
}
