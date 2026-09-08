import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { AcceptForm } from "./accept-form";

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await prisma.invitation.findUnique({ where: { token } });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) {
    return (
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Pozvánka není platná</h1>
        <p className="text-sm text-slate-500">Odkaz vypršel nebo už byl použit. Požádejte administrátora o novou pozvánku.</p>
      </div>
    );
  }
  return <AcceptForm token={token} email={inv.email} name={inv.name} roleLabel={ROLE_LABELS[inv.role]} />;
}
