import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import SignInButton from "@/components/auth/SignInButton";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user?.id) {
    if (session.user.isAllowed || session.user.isSuperuser) {
      redirect("/codex/core/races");
    } else {
      redirect("/pending");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Branding */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-brand-muted border-2 border-brand flex items-center justify-center">
            <svg
              viewBox="0 0 80 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16"
            >
              <circle cx="40" cy="40" r="38" stroke="#8b1a1a" strokeWidth="2" />
              <path
                d="M40 10 L48 32 L72 32 L53 47 L60 70 L40 55 L20 70 L27 47 L8 32 L32 32 Z"
                fill="#8b1a1a"
                stroke="#c9424d"
                strokeWidth="1"
              />
              <circle cx="40" cy="40" r="6" fill="#e8ddd0" />
            </svg>
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-ink tracking-wide">
              DSA Nexus
            </h1>
            <p className="text-ink-muted text-sm mt-1">
              Das Schwarze Auge · Reference & Editor
            </p>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="w-full bg-surface-card border border-surface-border rounded-xl p-8 flex flex-col items-center gap-6 shadow-2xl">
          <div className="text-center">
            <h2 className="text-ink text-lg font-semibold">Welcome back</h2>
            <p className="text-ink-muted text-sm mt-1">
              Sign in to access the Codex
            </p>
          </div>
          <SignInButton />
          <p className="text-ink-faint text-xs text-center leading-relaxed">
            Access is granted by an administrator.
            <br />
            New accounts are placed in review.
          </p>
        </div>
      </div>
    </div>
  );
}
