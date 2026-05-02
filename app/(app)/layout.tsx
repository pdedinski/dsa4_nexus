import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (!session.user.isAllowed && !session.user.isSuperuser) redirect("/pending");

  return <AppShell user={session.user}>{children}</AppShell>;
}
