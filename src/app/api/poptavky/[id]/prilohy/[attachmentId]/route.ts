import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 });
  const { id, attachmentId } = await params;
  const att = await prisma.inquiryAttachment.findFirst({ where: { id: attachmentId, inquiryId: id } });
  if (!att) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 });
  const filename = encodeURIComponent(att.filename);
  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      "content-type": att.contentType || "application/octet-stream",
      "content-length": String(att.size),
      "content-disposition": `attachment; filename*=UTF-8''${filename}`,
      "x-content-type-options": "nosniff",
    },
  });
}
