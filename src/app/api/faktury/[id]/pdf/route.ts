import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/pdf";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, subject: true, createdBy: { select: { name: true } }, relatedInvoice: { select: { number: true, type: true } } },
  });
  if (!inv) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  const pdf = await renderInvoicePdf(inv, await getSettings());
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="faktura-${inv.number}.pdf"`,
    },
  });
}
