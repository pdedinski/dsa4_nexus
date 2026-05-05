import NoteDetail from "@/components/notes/NoteDetail";

export default async function NoteByIdPage({
  params,
}: {
  params: Promise<{ noteId: string }>;
}) {
  const { noteId } = await params;
  return <NoteDetail noteId={noteId} />;
}
