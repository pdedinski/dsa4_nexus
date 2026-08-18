import { Suspense } from "react";
import ChargenWizard from "@/components/chargen/ChargenWizard";

export default function PlayerCharacterGeneratorPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="p-6 text-sm text-ink-muted">Loading generator…</div>
        }
      >
        <ChargenWizard />
      </Suspense>
    </div>
  );
}
