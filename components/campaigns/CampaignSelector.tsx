"use client";

import { useCampaign } from "./CampaignContext";

export default function CampaignSelector() {
  const { campaigns, selectedCampaignId, selectCampaign, loading } =
    useCampaign();

  return (
    <div className="px-2 pb-2">
      <label
        htmlFor="sidebar-campaign-select"
        className="block text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-1"
      >
        Campaign
      </label>
      <select
        id="sidebar-campaign-select"
        className="w-full rounded-md border border-surface-border bg-[#2c251f] px-2 py-1.5 text-sm text-ink scheme-dark disabled:opacity-60"
        value={selectedCampaignId ?? ""}
        disabled={loading && campaigns.length === 0}
        onChange={(e) => {
          const v = e.target.value;
          void selectCampaign(v === "" ? null : v);
        }}
      >
        <option value="">No campaign</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
