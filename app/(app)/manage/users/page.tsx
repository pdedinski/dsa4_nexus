import { requireAdmin } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import ManageUsersClient from "@/components/admin/ManageUsersClient";

export default async function ManageUsersPage() {
  const session = await requireAdmin();
  if (!session) redirect("/codex/core/races");

  return (
    <div className="p-4 md:p-6 max-w-5xl">
      <h1 className="text-2xl font-bold text-ink mb-6">Manage Users</h1>
      <ManageUsersClient
        currentUserId={session.user.id}
        isSuperuser={session.user.isSuperuser}
      />
    </div>
  );
}
