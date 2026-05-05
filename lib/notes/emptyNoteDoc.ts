/** TipTap ProseMirror JSON for an empty note (matches PostgreSQL default in 0005_notes). */
export function emptyNoteDoc(): Record<string, unknown> {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [] }],
  };
}

export function isTipTapDoc(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { type?: string }).type === "doc"
  );
}
