import { NextRequest, NextResponse } from "next/server";
import { resolveFile } from "@/lib/codex/resolver";
import { getTalentCodexLocation } from "@/lib/talents/catalog";

async function entryResponse(
  category: string,
  fileKey: string,
  entryId: string
) {
  const resolved = await resolveFile(category, fileKey);
  const entry = resolved.entries.find((e) => e.id === entryId);
  if (!entry) return null;
  return {
    category,
    fileKey,
    entryId,
    payload: entry.payload,
    versionLabel: entry.versionLabel ?? null,
  };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const talentId = sp.get("talentId");
  const spellId = sp.get("spellId");
  const traitId = sp.get("traitId");
  const saId = sp.get("saId");
  const equipmentId = sp.get("equipmentId");
  const category = sp.get("category");
  const fileKey = sp.get("fileKey");
  const entryId = sp.get("entryId");

  if (talentId) {
    const loc = getTalentCodexLocation(talentId);
    if (!loc) {
      return NextResponse.json({ error: "Unknown talent" }, { status: 404 });
    }
    const body = await entryResponse(loc.category, loc.fileKey, talentId);
    if (!body)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(body);
  }

  if (spellId) {
    const body = await entryResponse("magic", "spells", spellId);
    if (!body)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(body);
  }

  if (traitId) {
    for (const fk of ["advantages", "disadvantages"] as const) {
      const body = await entryResponse("character", fk, traitId);
      if (body) return NextResponse.json(body);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (saId) {
    const body = await entryResponse("character", "special_abilities", saId);
    if (!body)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(body);
  }

  if (equipmentId) {
    for (const fk of ["weapons", "armor", "general_equipment"] as const) {
      const body = await entryResponse("equipment", fk, equipmentId);
      if (body) return NextResponse.json(body);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!category || !fileKey || !entryId) {
    return NextResponse.json(
      {
        error:
          "Provide talentId, spellId, traitId, saId, equipmentId, or category+fileKey+entryId",
      },
      { status: 400 }
    );
  }

  const body = await entryResponse(category, fileKey, entryId);
  if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(body);
}
