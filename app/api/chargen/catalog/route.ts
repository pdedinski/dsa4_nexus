import { NextRequest, NextResponse } from "next/server";
import { requireAllowed } from "@/lib/auth/session";
import { loadAllCatalogs, loadCatalog } from "@/lib/chargen/data/loadCatalog";
import {
  CHARGEN_CATALOG_CATEGORIES,
  type ChargenCatalogCategory,
} from "@/lib/chargen/types";

export async function GET(req: NextRequest) {
  const session = await requireAllowed();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const category = req.nextUrl.searchParams.get("category");
  if (category) {
    if (
      !CHARGEN_CATALOG_CATEGORIES.includes(category as ChargenCatalogCategory)
    ) {
      return NextResponse.json({ error: "Unknown category" }, { status: 400 });
    }
    const result = await loadCatalog(category as ChargenCatalogCategory);
    return NextResponse.json(result);
  }

  const all = await loadAllCatalogs();
  return NextResponse.json(all);
}
