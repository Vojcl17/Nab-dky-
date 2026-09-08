import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PriceItemForm } from "../price-item-form";

export default async function EditPriceItemPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser("pricelist:write");
  const { id } = await params;
  const item = await prisma.priceItem.findUnique({ where: { id } });
  if (!item) notFound();
  return (
    <div>
      <PageHeader title={item.name} subtitle="Položka ceníku" />
      <PriceItemForm
        canDelete
        item={{
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          unit: item.unit,
          priceCzk: item.priceCzk.toString(),
          priceEur: item.priceEur?.toString() ?? "",
          vatRate: item.vatRate,
          active: item.active,
        }}
      />
    </div>
  );
}
