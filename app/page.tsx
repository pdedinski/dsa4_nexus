import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  if (session.user.isAllowed || session.user.isSuperuser) redirect("/codex");
  redirect("/pending");
}
