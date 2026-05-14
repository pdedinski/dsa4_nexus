import type { CharacterSheet } from "@/lib/character/types";
import type { GenerateCharacterInput } from "@/lib/character/types";
import type { SpellPriority } from "@/lib/character/types";

function networkFriendlyError(cause: unknown): Error {
  if (cause instanceof TypeError || cause instanceof DOMException) {
    const m = cause.message.toLowerCase();
    if (
      m.includes("failed to fetch") ||
      m.includes("networkerror") ||
      m.includes("load failed") ||
      m.includes("network request failed")
    ) {
      return new Error(
        "Could not reach the server—check that Next.js is still running on this machine (dev) or reload the page, then try again.",
      );
    }
  }
  if (cause instanceof Error) return cause;
  return new Error("Generate failed");
}

/**
 * POST /api/characters/generate — shared by initial wizard generate and reroll.
 * Uses robust response parsing so HTML error bodies do not surface as vague fetch errors.
 */
export async function postGenerateSheet(payload: {
  input: GenerateCharacterInput;
  spellPriorities?: Record<string, SpellPriority>;
  debugMode?: boolean;
}): Promise<CharacterSheet> {
  const body = JSON.stringify({
    ...payload.input,
    spellPriorities: payload.spellPriorities ?? payload.input.spellPriorities,
    ...(payload.debugMode ? { debugMode: true } : {}),
  });

  let res: Response;
  try {
    res = await fetch("/api/characters/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body,
    });
  } catch (e) {
    throw networkFriendlyError(e);
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      !res.ok
        ? `Server error (${res.status}). The response was not JSON—check the terminal where Next.js is running.`
        : "Received invalid JSON from the server.",
    );
  }

  const obj =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};

  if (!res.ok) {
    throw new Error(typeof obj.error === "string" ? obj.error : `Generate failed (HTTP ${res.status})`);
  }

  const sheet = obj.sheet;
  if (!sheet || typeof sheet !== "object") {
    throw new Error("Server returned no sheet.");
  }

  return sheet as CharacterSheet;
}
