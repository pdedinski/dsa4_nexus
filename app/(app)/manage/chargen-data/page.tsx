import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import ManageChargenDataClient from "@/components/admin/ManageChargenDataClient";

export default async function ManageChargenDataPage() {
  const session = await requireAdmin();
  if (!session) redirect("/tools/player-character-generator");

  return (
    <div className="max-w-5xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold text-ink">Chargen Data</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Add custom races, cultures, professions, equipment, talents, spells,
        advantages/disadvantages, and special abilities for the Player Character
        Generator. Entries are stored in the{" "}
        <code className="text-xs">chargen_data</code> schema and merge with
        built-in catalogs.
      </p>
      <ManageChargenDataClient />
    </div>
  );
}
