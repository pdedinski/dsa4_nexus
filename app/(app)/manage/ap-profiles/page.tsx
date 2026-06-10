import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import ManageApProfilesClient from "@/components/admin/ManageApProfilesClient";

export default async function ManageApProfilesPage() {
  const session = await requireAdmin();
  if (!session) redirect("/codex/core/races");

  return (
    <div className="max-w-5xl p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold text-ink">AP Spending Profiles</h1>
      <ManageApProfilesClient />
    </div>
  );
}
