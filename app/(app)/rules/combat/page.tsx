import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import combatData from "@/data/combat/combat_maneuvers.json";
import CombatRulesClient from "./CombatRulesClient";

export const metadata = {
  title: "Combat Rules — DSA Nexus",
};

export default async function CombatRulesPage() {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");

  return <CombatRulesClient data={combatData} />;
}
