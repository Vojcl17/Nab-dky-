import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PriceItemForm } from "../price-item-form";

export default async function NewPriceItemPage() {
  await requireUser("pricelist:write");
  return (
    <div>
      <PageHeader title="Nová položka ceníku" />
      <PriceItemForm />
    </div>
  );
}
