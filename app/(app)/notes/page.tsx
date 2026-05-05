import NotesList from "@/components/notes/NotesList";

export default function NotesPage() {
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-ink mb-2">My Notes</h1>
      <p className="text-sm text-ink-muted mb-6">
        Personal notes with rich text. Type <kbd className="rounded border border-surface-border px-1">@</kbd> while
        editing to insert a link to one of your characters; click the link in view
        mode to see their sheet.
      </p>
      <NotesList />
    </div>
  );
}
