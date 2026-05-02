import CharacterEditClient from "@/components/characters/CharacterEditClient";

export default async function CharacterEditPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const cid = decodeURIComponent(characterId);
  return <CharacterEditClient characterId={cid} />;
}
