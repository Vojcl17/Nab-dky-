import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const settings = await getSettings();
  return (
    <AppShell user={user} companyName={settings.name}>
      {children}
    </AppShell>
  );
}
