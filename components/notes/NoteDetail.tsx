"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NoteEditor from "./NoteEditor";
import CharacterStatModal from "./CharacterStatModal";
import type {
  CharacterRowBrief,
  CharacterMentionCtx,
} from "./createCharacterMentionExtension";
import type {
  NoteRowBrief,
  NoteMentionCtx,
} from "./createNoteMentionExtension";
import { emptyNoteDoc, isTipTapDoc } from "@/lib/notes/emptyNoteDoc";

export default function NoteDetail({ noteId }: { noteId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pickCharacter, setPickCharacter] = useState<string | null>(null);

  const [characters, setCharacters] = useState<CharacterRowBrief[]>([]);
  const [notesForMentions, setNotesForMentions] = useState<NoteRowBrief[]>([]);

  const ctxRef = useRef<CharacterMentionCtx>({
    characters: [],
    onCharacterClick: undefined,
  });

  const noteMentionCtxRef = useRef<NoteMentionCtx>({
    notes: [],
    excludeNoteId: undefined,
    onNoteClick: undefined,
  });

  const openCharacter = useCallback((characterId: string) => {
    setPickCharacter(characterId);
  }, []);

  const openNote = useCallback(
    (linkedNoteId: string) => {
      router.push(`/notes/${linkedNoteId}`);
    },
    [router]
  );

  ctxRef.current.characters = characters;
  ctxRef.current.onCharacterClick = openCharacter;

  noteMentionCtxRef.current.notes = notesForMentions;
  noteMentionCtxRef.current.excludeNoteId = noteId;
  noteMentionCtxRef.current.onNoteClick = openNote;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/characters?sort=name");
      const data = await res.json();
      if (cancelled) return;
      const list = (data.characters ?? []) as CharacterRowBrief[];
      setCharacters(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/notes");
      const data = await res.json();
      if (cancelled) return;
      const raw = (data.notes ?? []) as Array<{
        id: string;
        title: string;
      }>;
      setNotesForMentions(
        raw.map((n) => ({ id: n.id, title: typeof n.title === "string" ? n.title : "" }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadNote = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load note");
      setLoading(false);
      return;
    }
    const raw = data.content as unknown;
    const doc = isTipTapDoc(raw) ? (raw as Record<string, unknown>) : emptyNoteDoc();
    setTitle(typeof data.title === "string" ? data.title : "");
    setContent(doc);
    setLoading(false);
  }, [noteId]);

  useEffect(() => {
    void loadNote();
  }, [loadNote]);

  async function save() {
    if (!content) return;
    setSaving(true);
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
      return;
    }
    setIsEditing(false);
    void loadNote();
  }

  async function removeNote() {
    if (!confirm("Delete this note permanently?")) return;
    const res = await fetch(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Delete failed");
      return;
    }
    router.push("/notes");
    router.refresh();
  }

  if (loading || !content) {
    return (
      <div className="text-sm text-ink-muted p-4">
        {error ?? "Loading note…"}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/notes"
          className="text-sm text-ink-muted hover:text-ink underline"
        >
          ← All notes
        </Link>
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-semibold uppercase text-ink-muted mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={!isEditing}
            className="w-full rounded-lg border border-surface-border bg-[#110e0a] px-3 py-2 text-ink text-lg font-semibold disabled:opacity-80"
            placeholder="Untitled note"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                disabled={saving}
                onClick={() => void save()}
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-surface-border px-4 py-2 text-sm text-ink hover:bg-surface-card"
                disabled={saving}
                onClick={() => {
                  setIsEditing(false);
                  void loadNote();
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rounded-lg bg-brand-muted px-4 py-2 text-sm font-medium text-ink"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg border border-red-900/50 px-4 py-2 text-sm text-red-400 hover:bg-red-950/30"
                onClick={() => void removeNote()}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-ink-faint mb-3">
        Tip: type <kbd className="rounded border border-surface-border px-1">@</kbd> to
        mention a saved character (opens sheet in view mode). Type{" "}
        <kbd className="rounded border border-surface-border px-1">#</kbd> to link another
        note (opens it when clicked in view mode).
      </p>

      <NoteEditor
        key={noteId}
        ctxRef={ctxRef}
        noteMentionCtxRef={noteMentionCtxRef}
        contentJson={content}
        editable={isEditing}
        onChange={setContent}
      />

      <CharacterStatModal
        characterId={pickCharacter}
        onClose={() => setPickCharacter(null)}
      />
    </div>
  );
}
