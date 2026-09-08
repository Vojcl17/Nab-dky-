import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { SubjectForm } from "../subject-form";

export default async function NewSubjectPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  await requireUser("subjects:write");
  const { returnTo } = await searchParams;
  return (
    <div>
      <PageHeader title="Nový subjekt" subtitle="Zadejte IČO a načtěte údaje z ARES, nebo vyplňte ručně." />
      <SubjectForm returnTo={returnTo} />
    </div>
  );
}
