import CharacterList from "@/components/characters/CharacterList";

export default function CharactersPage() {
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-2">My Characters</h1>
      <p className="text-sm text-ink-muted mb-6">
        Generate and save TDE 4.1 heroes. Open a character to view or edit the
        full sheet.
      </p>
      <CharacterList />
    </div>
  );
}
