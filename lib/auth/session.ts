import { auth } from "./auth";

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session;
}

export async function requireAllowed() {
  const session = await requireSession();
  if (!session) return null;
  if (!session.user.isAllowed && !session.user.isSuperuser) return null;
  return session;
}

export async function requireEditor() {
  const session = await requireAllowed();
  if (!session) return null;
  if (!session.user.isEditor && !session.user.isAdmin && !session.user.isSuperuser)
    return null;
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session) return null;
  if (!session.user.isAdmin && !session.user.isSuperuser) return null;
  return session;
}
