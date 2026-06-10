import { redirect } from "next/navigation";
import { requireSuperuser } from "@/lib/auth/session";
import ManageSettingsClient from "@/components/manage/ManageSettingsClient";

export default async function ManageSettingsPage() {
  const session = await requireSuperuser();
  if (!session) redirect("/codex/core/races");

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Settings</h1>
      <ManageSettingsClient />
    </div>
  );
}
