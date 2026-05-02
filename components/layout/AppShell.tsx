"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import clsx from "clsx";
import Sidebar, { type SidebarUser } from "./Sidebar";

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
    <div className="flex h-dvh overflow-hidden bg-surface">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={closeDrawer}
        />
      )}

      <div
        className={clsx(
          "z-50 h-full shrink-0 transition-transform duration-200 ease-out",
          "fixed inset-y-0 left-0 md:static md:z-auto md:translate-x-0",
          drawerOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          !drawerOpen && "pointer-events-none md:pointer-events-auto"
        )}
      >
        <Sidebar user={user} onNavigate={closeDrawer} />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-surface-border bg-surface px-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-ink hover:bg-surface-card transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-ink">DSA Nexus</span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
