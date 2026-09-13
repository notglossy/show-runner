import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage("/settings");
  const { effective, defaults, overrides } = getSettings();
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm effective={effective} defaults={defaults} overrides={overrides} />
    </>
  );
}
