import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAllowed } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { characters } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import CharacterSheetView from "@/components/characters/CharacterSheet";
import type { CharacterSheet as Sheet } from "@/lib/character/types";
import { migrateCharacterSheet } from "@/lib/character/sheetMigration";

export default async function CharacterViewPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const session = await requireAllowed();
  if (!session) notFound();

  const { characterId } = await params;
  const cid = decodeURIComponent(characterId).toLowerCase();

  const [row] = await db
    .select()
    .from(characters)
    .where(
      and(eq(characters.userId, session.user.id), eq(characters.characterId, cid))
    )
    .limit(1);

  if (!row) notFound();

  const sheet = migrateCharacterSheet(row.sheet as Sheet);

  return (
    <div className="min-h-full bg-surface-app">
      <div className="border-b border-surface-border px-4 py-2 flex flex-wrap items-center gap-4 text-sm">
        <Link href="/characters" className="text-brand font-medium">
          ← My Characters
        </Link>
        <Link
          href={`/characters/${encodeURIComponent(cid)}/edit`}
          className="text-ink-muted hover:text-ink"
        >
          Edit
        </Link>
        {row.imageUrl ? (
          <a
            href={row.imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand font-medium"
          >
            Character image
          </a>
        ) : null}
      </div>
      <CharacterSheetView sheet={sheet} />
    </div>
  );
}
