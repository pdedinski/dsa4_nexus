import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import SignOutButton from "@/components/auth/SignOutButton";

export default async function PendingPage() {
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.isAllowed || session.user.isSuperuser)
    redirect("/codex/core/races");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-card border border-surface-border flex items-center justify-center">
          <svg
            className="w-8 h-8 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 6v6l4 2M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-ink">Access Pending</h1>
          <p className="text-ink-muted text-sm mt-2 leading-relaxed">
            Your account{" "}
            <span className="text-ink">{session.user.email}</span> is awaiting
            approval from an administrator. You'll be able to access the Nexus
            once enabled.
          </p>
        </div>
        <SignOutButton />
      </div>
    </div>
  );
}
