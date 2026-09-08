import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser, userCan } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export default async function PriceListPage({ searchParams }: { searchParams: Promise<{ q?: string; vse?: string }> }) {
  const user = await requireUser();
  const { q = "", vse } = await searchParams;
  const items = await prisma.priceItem.findMany({
    where: {
      ...(vse ? {} : { active: true }),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ code: "asc" }, { name: "asc" }],
  });
  const canWrite = userCan(user, "pricelist:write");
  return (
    <div>
      <PageHeader
        title="Ceník"
        subtitle={`${items.length} položek`}
        actions={canWrite && <LinkButton href="/cenik/novy" className="btn-primary">Nová položka</LinkButton>}
      />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Hledat podle názvu nebo kódu…" className="input max-w-xs" />
        <label className="flex items-center gap-1 text-sm text-slate-600">
          <input type="checkbox" name="vse" value="1" defaultChecked={!!vse} /> včetně neaktivních
        </label>
        <button className="btn-secondary">Filtrovat</button>
      </form>
      {items.length === 0 ? (
        <EmptyState>Ceník je prázdný. {canWrite && <Link href="/cenik/novy" className="text-indigo-600">Přidejte první položku.</Link>}</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Kód</th>
                <th>Název</th>
                <th>MJ</th>
                <th className="text-right">Cena CZK</th>
                <th className="text-right">Cena EUR</th>
                <th className="text-right">DPH</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="font-mono text-xs">{it.code}</td>
                  <td>
                    <Link href={`/cenik/${it.id}`} className="font-medium text-indigo-700 hover:underline">
                      {it.name}
                    </Link>
                    {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                  </td>
                  <td>{it.unit}</td>
                  <td className="text-right">{formatMoney(it.priceCzk, "CZK")}</td>
                  <td className="text-right">{it.priceEur != null ? formatMoney(it.priceEur, "EUR") : "—"}</td>
                  <td className="text-right">{it.vatRate} %</td>
                  <td>{!it.active && <Badge className="bg-slate-100 text-slate-500">neaktivní</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
