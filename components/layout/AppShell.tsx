"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import clsx from "clsx";
import Sidebar, { type SidebarUser } from "./Sidebar";
import { CampaignProvider } from "@/components/campaigns/CampaignContext";
import { UnsavedChangesProvider } from "@/components/layout/UnsavedChangesContext";

const MD_QUERY = "(min-width: 768px)";

export default function AppShell({
  user,
  children,
}: {
  user: SidebarUser;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const mq = window.matchMedia(MD_QUERY);
    if (mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  useEffect(() => {
    const mq = window.matchMedia(MD_QUERY);
    const onChange = () => {
      if (mq.matches) setDrawerOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  return (
    <CampaignProvider
      initialSelectedCampaignId={user.selectedCampaignId ?? null}
    >
      <UnsavedChangesProvider>
        <div className="flex h-dvh overflow-hidden bg-surface">
          {drawerOpen && (
            <button
              type="button"
              aria-label="Close menu"
              className="fixed inset-0 z-[90] bg-black/50 md:hidden"
              onClick={closeDrawer}
            />
          )}

          <div
            className={clsx(
              /* Opaque bg + shadow live on this transformed layer so mobile WebKit does not
               * composite the inner aside as see-through over main content. */
              "fixed inset-y-0 left-0 z-[100] flex h-full min-h-0 w-60 shrink-0 flex-col bg-[#110e0a] shadow-[4px_0_24px_rgba(0,0,0,0.55)] transition-transform duration-200 ease-out",
              "md:static md:z-auto md:h-full md:w-auto md:translate-x-0 md:bg-transparent md:shadow-none",
              drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
              !drawerOpen && "pointer-events-none md:pointer-events-auto"
            )}
          >
            <Sidebar user={user} onNavigate={closeDrawer} />
          </div>

          <div className="isolate flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <header className="relative z-10 flex min-h-12 shrink-0 items-center gap-2 border-b border-surface-border bg-surface px-3 py-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] md:hidden">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-surface-card transition-colors"
              >
                <Menu className="h-5 w-5 shrink-0" />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                DSA Nexus
              </span>
            </header>
            <main className="relative z-0 flex min-h-0 flex-1 flex-col overflow-y-auto">
              {children}
            </main>
          </div>
        </div>
      </UnsavedChangesProvider>
    </CampaignProvider>
  );
}
