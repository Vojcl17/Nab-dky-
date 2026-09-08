import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { renderIsdoc } from "@/lib/isdoc";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const { id } = await params;
  const inv = await prisma.invoice.findUnique({
    where: { id },
    include: { items: { orderBy: { position: "asc" } }, subject: true, relatedInvoice: { select: { number: true } } },
  });
  if (!inv) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  const xml = renderIsdoc(inv, await getSettings());
  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "content-disposition": `attachment; filename="faktura-${inv.number}.isdoc"`,
    },
  });
}
