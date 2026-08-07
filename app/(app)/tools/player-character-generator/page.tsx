import { Suspense } from "react";
import ChargenWizard from "@/components/chargen/ChargenWizard";

export default function PlayerCharacterGeneratorPage() {
  return (
    <div className="h-full">
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
