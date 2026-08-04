"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CampaignSummary = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

type CampaignContextValue = {
  campaigns: CampaignSummary[];
  selectedCampaignId: string | null;
  loading: boolean;
  selectCampaign: (id: string | null) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
  /** Optimistically remove a campaign from local state (e.g. after delete). */
  removeCampaignLocal: (id: string) => void;
  /** Upsert a campaign into local list after create/edit. */
  upsertCampaignLocal: (c: CampaignSummary) => void;
};

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({
  initialSelectedCampaignId,
  children,
}: {
  initialSelectedCampaignId: string | null;
  children: ReactNode;
}) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    initialSelectedCampaignId
  );
  const [loading, setLoading] = useState(true);

  const refreshCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCampaigns((data.campaigns as CampaignSummary[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCampaigns();
  }, [refreshCampaigns]);

  // Keep selection in sync if server session prop changes (rare).
  useEffect(() => {
    setSelectedCampaignId(initialSelectedCampaignId);
  }, [initialSelectedCampaignId]);

  // If selected campaign was deleted elsewhere, clear local selection.
  useEffect(() => {
    if (!selectedCampaignId || loading) return;
    if (!campaigns.some((c) => c.id === selectedCampaignId)) {
      setSelectedCampaignId(null);
    }
  }, [campaigns, selectedCampaignId, loading]);

  const selectCampaign = useCallback(async (id: string | null) => {
    const prev = selectedCampaignId;
    setSelectedCampaignId(id);
    try {
      const res = await fetch("/api/users/me/selected-campaign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId: id }),
      });
      if (!res.ok) {
        setSelectedCampaignId(prev);
      }
    } catch {
      setSelectedCampaignId(prev);
    }
  }, [selectedCampaignId]);

  const removeCampaignLocal = useCallback((id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    setSelectedCampaignId((cur) => (cur === id ? null : cur));
  }, []);

  const upsertCampaignLocal = useCallback((c: CampaignSummary) => {
    setCampaigns((prev) => {
      const idx = prev.findIndex((x) => x.id === c.id);
      if (idx === -1) return [c, ...prev];
      const next = [...prev];
      next[idx] = c;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      campaigns,
      selectedCampaignId,
      loading,
      selectCampaign,
      refreshCampaigns,
      removeCampaignLocal,
      upsertCampaignLocal,
    }),
    [
      campaigns,
      selectedCampaignId,
      loading,
      selectCampaign,
      refreshCampaigns,
      removeCampaignLocal,
      upsertCampaignLocal,
    ]
  );

  return (
    <CampaignContext.Provider value={value}>{children}</CampaignContext.Provider>
  );
}

export function useCampaign(): CampaignContextValue {
  const ctx = useContext(CampaignContext);
  if (!ctx) {
    throw new Error("useCampaign must be used within CampaignProvider");
  }
  return ctx;
}
