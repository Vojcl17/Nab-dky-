import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";

export default async function SubjectsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const subjects = await prisma.subject.findMany({
    where: q
      ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { ico: { contains: q } }, { city: { contains: q, mode: "insensitive" } }] }
      : {},
    orderBy: { name: "asc" },
    include: { _count: { select: { offers: true, invoices: true } } },
  });
  const canWrite = userCan(user, "subjects:write");
  return (
    <div>
      <PageHeader
        title="Subjekty"
        subtitle={`${subjects.length} odběratelů`}
        actions={canWrite && <LinkButton href="/subjekty/novy" className="btn-primary">Nový subjekt</LinkButton>}
      />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Hledat podle názvu, IČO nebo města…" className="input max-w-xs" />
        <button className="btn-secondary">Hledat</button>
      </form>
      {subjects.length === 0 ? (
        <EmptyState>Zatím žádné subjekty. {canWrite && <Link href="/subjekty/novy" className="text-indigo-600">Přidejte prvního odběratele</Link>} – stačí IČO, zbytek doplní ARES.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Název</th>
                <th>IČO</th>
                <th>DIČ</th>
                <th>Město</th>
                <th>Kontakt</th>
                <th className="text-right">Nabídky</th>
                <th className="text-right">Faktury</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/subjekty/${s.id}`} className="font-medium text-indigo-700 hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td className="font-mono text-xs">{s.ico}</td>
                  <td className="font-mono text-xs">{s.dic}</td>
                  <td>{s.city}</td>
                  <td className="text-xs text-slate-500">{[s.contactPerson, s.email, s.phone].filter(Boolean).join(" · ")}</td>
                  <td className="text-right">{s._count.offers}</td>
                  <td className="text-right">{s._count.invoices}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
