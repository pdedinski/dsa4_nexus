"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

const DEFAULT_MESSAGE =
  "You have an unfinished character. Leaving will discard unsaved changes.";

type UnsavedChangesContextValue = {
  blocked: boolean;
  setBlocked: (blocked: boolean, message?: string) => void;
  /** Returns true if navigation may proceed immediately; false if a confirm is shown. */
  requestLeave: (href: string) => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null
);

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }
  return ctx;
}

/** Safe for Sidebar Links: when provider is missing, never block. */
export function useUnsavedChangesOptional() {
  return useContext(UnsavedChangesContext);
}

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [blocked, setBlockedState] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const blockedRef = useRef(false);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const setBlocked = useCallback((next: boolean, nextMessage?: string) => {
    blockedRef.current = next;
    setBlockedState(next);
    if (nextMessage !== undefined) setMessage(nextMessage);
    if (!next) setPendingHref(null);
  }, []);

  const requestLeave = useCallback((href: string) => {
    if (!blockedRef.current) return true;
    // Same path (e.g. current tools link) — allow
    const pathOnly = href.split("?")[0]?.split("#")[0] ?? href;
    if (pathOnly === pathnameRef.current) return true;
    setPendingHref(href);
    return false;
  }, []);

  // Tab close / refresh
  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocked]);

  // Browser Back best-effort: keep a sentinel when blocked so Back triggers popstate
  useEffect(() => {
    if (!blocked) return;
    const onPopState = () => {
      if (!blockedRef.current) return;
      // Re-push current URL so we stay put until the user confirms
      window.history.pushState(null, "", window.location.href);
      setPendingHref("__back__");
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [blocked]);

  const onCancelLeave = useCallback(() => {
    setPendingHref(null);
  }, []);

  const onConfirmLeave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    blockedRef.current = false;
    setBlockedState(false);
    if (!href || href === "__back__") {
      // Sentinel push on block + re-push on popstate: step past both.
      window.history.go(-2);
      return;
    }
    router.push(href);
  }, [pendingHref, router]);

  const value = useMemo(
    () => ({ blocked, setBlocked, requestLeave }),
    [blocked, setBlocked, requestLeave]
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pendingHref !== null}
        title="Leave character generator?"
        message={message}
        confirmLabel="Leave"
        cancelLabel="Stay"
        danger
        onConfirm={onConfirmLeave}
        onCancel={onCancelLeave}
      />
    </UnsavedChangesContext.Provider>
  );
}
