import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SubjectForm } from "../subject-form";

export default async function NewSubjectPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; name?: string; email?: string; phone?: string; contactPerson?: string; inquiryId?: string }>;
}) {
  await requireUser("subjects:write");
  const { returnTo, name, email, phone, contactPerson, inquiryId } = await searchParams;
  return (
    <div>
      <PageHeader title="Nový subjekt" subtitle="Zadejte IČO a načtěte údaje z ARES, nebo vyplňte ručně." />
      <SubjectForm returnTo={returnTo} initial={{ name: name ?? "", email: email ?? "", phone: phone ?? "", contactPerson: contactPerson ?? "" }} linkInquiryId={inquiryId} />
    </div>
  );
}
