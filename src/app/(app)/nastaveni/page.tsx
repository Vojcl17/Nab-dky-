import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { LinkButton, PageHeader } from "@/components/ui";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requireUser("settings:write");
  const s = await getSettings();
  const { fioLastSyncAt: _a, updatedAt: _b, id: _c, ...rest } = s;
  void _a;
  void _b;
  void _c;
  return (
    <div>
      <PageHeader title="Nastavení" actions={<LinkButton href="/nastaveni/uzivatele">Uživatelé a přístupy</LinkButton>} />
      <SettingsForm s={rest} />
    </div>
  );
}
