/** Turn snake_case / kebab-case tokens into Title Case labels for UI (not i18n keys). */
export function humanizeSnake(s: string): string {
  if (!s) return "";
  return s
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
