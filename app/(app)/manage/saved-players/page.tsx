import { requireAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import ManageSavedPlayersClient from "@/components/admin/ManageSavedPlayersClient";

export default async function ManageSavedPlayersPage() {
  const session = await requireAdmin();
  if (!session) redirect("/codex/core/races");

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-ink mb-2">Saved Players</h1>
      <p className="text-sm text-ink-muted mb-6">
        All Player Character Generator heroes persisted to the shared database.
      </p>
      <ManageSavedPlayersClient />
    </div>
  );
}
