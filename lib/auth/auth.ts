import { randomUUID } from "crypto";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Google OAuth: register this exact redirect URI (no wildcards):
 *   `${AUTH_URL}/api/auth/callback/google`
 * In Google Cloud Console → APIs & Services → Credentials → your OAuth client → Authorized redirect URIs.
 *
 * `AUTH_URL` must match how users open the app: scheme (http/https), host (`localhost` vs `127.0.0.1`), and port.
 * Add a separate URI for each origin you use (e.g. dev + production).
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return false;

      // OIDC profile should include `sub`; fall back to OAuth account id (same value for Google).
      const googleSub =
        (profile as { sub?: string } | undefined)?.sub ??
        account.providerAccountId;
      if (!googleSub) {
        console.error(
          "[auth][signIn] Missing Google subject (no profile.sub or providerAccountId)"
        );
        return false;
      }

      const superuserEmails = (process.env.SUPERUSER_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      const email = (profile as { email?: string } | undefined)?.email ?? null;
      const displayName =
        (profile as { name?: string }).name ?? email ?? "Unknown";

      try {
        const existing = await db
          .select()
          .from(users)
          .where(eq(users.googleSub, googleSub))
          .limit(1);

        if (existing.length === 0) {
          const isSuperuser =
            email !== null && superuserEmails.includes(email);
          await db.insert(users).values({
            id: randomUUID(),
            googleSub,
            email,
            displayName,
            isAllowed: isSuperuser,
            isSuperuser,
          });
        } else {
          await db
            .update(users)
            .set({
              lastLoginAt: new Date(),
              displayName,
              email,
            })
            .where(eq(users.googleSub, googleSub));
        }
      } catch (err) {
        console.error(
          "[auth][signIn] Database error (migrations applied? DB reachable from this host?):",
          err
        );
        const msg = err instanceof Error ? err.message : String(err);
        const cause =
          err instanceof Error && err.cause instanceof Error
            ? err.cause.message
            : "";
        const combined = `${msg} ${cause}`;
        if (
          combined.includes("pg_hba.conf") ||
          combined.includes("28000")
        ) {
          console.error(
            "[auth][signIn] Postgres client auth failed (code 28000). The client IP in the message is the host running Next.js (often different from your PC when using remote dev). Fix: add that IP in pg_hba.conf, or connect via SSH tunnel / DATABASE_URL to localhost, or run `next dev` on a machine already allowed. See lib/db/POSTGRES.md."
          );
        }
        throw err;
      }

      return true;
    },

    async jwt({ token, account, profile }) {
      // On initial sign-in, load roles from DB
      const googleSub =
        (profile as { sub?: string } | undefined)?.sub ??
        account?.providerAccountId;
      if (account?.provider === "google" && googleSub) {
        const [row] = await db
          .select()
          .from(users)
          .where(eq(users.googleSub, googleSub))
          .limit(1);
        if (row) {
          token.userId = row.id;
          token.isAllowed = row.isAllowed;
          token.isEditor = row.isEditor;
          token.isAdmin = row.isAdmin;
          token.isSuperuser = row.isSuperuser;
          token.selectedCampaignId = row.selectedCampaignId ?? null;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        // Refresh roles from DB on each session access
        const [row] = await db
          .select()
          .from(users)
          .where(eq(users.id, token.userId as string))
          .limit(1);
        if (row) {
          session.user.id = row.id;
          session.user.isAllowed = row.isAllowed;
          session.user.isEditor = row.isEditor;
          session.user.isAdmin = row.isAdmin;
          session.user.isSuperuser = row.isSuperuser;
          session.user.selectedCampaignId = row.selectedCampaignId ?? null;
        }
      }
      return session;
    },
  },
});

// Extend next-auth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      isAllowed: boolean;
      isEditor: boolean;
      isAdmin: boolean;
      isSuperuser: boolean;
      selectedCampaignId: string | null;
    };
  }
}

