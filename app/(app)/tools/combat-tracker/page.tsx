import CombatTrackerClient from "@/components/tools/CombatTrackerClient";

export const metadata = {
  title: "Combat Tracker — DSA Nexus",
};

export default function CombatTrackerPage() {
  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <h1 className="mb-2 text-2xl font-bold text-ink">Combat Tracker</h1>
      <p className="mb-6 text-sm text-ink-muted">
        Track initiative order, vitality, and turns for a single encounter.
      </p>
      <CombatTrackerClient />
    </div>
  );
}
