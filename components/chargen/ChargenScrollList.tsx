import type { ReactNode } from "react";

/**
 * Nested catalog scroller: one inner pane so the page itself does not also
 * scroll on phones. Cap height with dvh so the list, Selected box, and
 * Back/Next stay on-screen.
 */
export const chargenNestedListClass =
  "isolate min-h-0 overflow-y-auto overflow-x-auto overscroll-contain [scrollbar-gutter:stable] max-h-[min(32rem,calc(100dvh-16rem))]";

/** Opaque sticky label — scrolling rows must not bleed through the title. */
export function StickySectionHeader({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`sticky top-0 z-20 bg-[#1a1410] py-2 px-1 text-sm font-semibold text-ink border-b border-surface-border shadow-[0_12px_10px_0_#1a1410] ${className}`}
    >
      {children}
    </h3>
  );
}
