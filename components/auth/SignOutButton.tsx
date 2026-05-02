"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({
  className,
}: {
  className?: string;
}) {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
      className={
        className ??
        "text-sm text-ink-muted hover:text-ink underline transition-colors"
      }
    >
      Sign out
    </button>
  );
}
