import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { InquiryForm } from "./inquiry-form";

export default async function NewInquiryPage() {
  await requireUser("inquiries:write");
  const subjects = await prisma.subject.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div>
      <PageHeader title="Nová poptávka" subtitle="Ruční zadání (telefon, osobní jednání)." />
      <InquiryForm subjects={subjects} />
    </div>
  );
}
