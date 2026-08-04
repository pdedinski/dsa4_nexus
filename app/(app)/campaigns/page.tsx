import { redirect } from "next/navigation";
import { requireAllowed } from "@/lib/auth/session";
import CampaignsListClient from "@/components/campaigns/CampaignsListClient";

export default async function CampaignsPage() {
  const session = await requireAllowed();
  if (!session) redirect("/sign-in");

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold text-ink">My Campaigns</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Group characters, notes, and images into role-playing campaigns. Use the
        sidebar selector to filter your asset lists.
      </p>
      <CampaignsListClient />
    </div>
  );
}
