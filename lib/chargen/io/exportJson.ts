import type { HeldModel } from "@/lib/chargen/types";

export function exportHeldJson(held: HeldModel): string {
  return JSON.stringify(held, null, 2);
}

export function downloadHeldJson(held: HeldModel, filename?: string): void {
  const blob = new Blob([exportHeldJson(held)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename ||
    `${(held.name || "hero").replace(/[^\w\-]+/g, "_")}.chargen.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
