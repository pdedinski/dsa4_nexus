import { redirect } from "next/navigation";
import { requireAllowed } from "@/lib/auth/session";
import CampaignEditClient from "@/components/campaigns/CampaignEditClient";

type Props = { params: Promise<{ campaignId: string }> };

export default async function CampaignEditPage({ params }: Props) {
  const session = await requireAllowed();
  if (!session) redirect("/sign-in");

  const { campaignId } = await params;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-6 text-2xl font-bold text-ink">Edit campaign</h1>
      <CampaignEditClient campaignId={decodeURIComponent(campaignId)} />
    </div>
  );
}
