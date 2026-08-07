import { NextRequest, NextResponse } from "next/server";
import { requireSuperuser } from "@/lib/auth/session";
import {
  CHARGEN_HEROES_SHARED_VISIBILITY_DEFAULT,
  CHARGEN_HEROES_SHARED_VISIBILITY_KEY,
  getChargenHeroesSharedVisibility,
  setAppSettingBool,
} from "@/lib/appSettings";

export async function GET() {
  const session = await requireSuperuser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const chargenHeroesSharedVisibility =
    await getChargenHeroesSharedVisibility();

  return NextResponse.json({
    chargenHeroesSharedVisibility,
  });
}

export async function PATCH(req: NextRequest) {
  const session = await requireSuperuser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { chargenHeroesSharedVisibility?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.chargenHeroesSharedVisibility !== "boolean") {
    return NextResponse.json(
      { error: "chargenHeroesSharedVisibility must be a boolean" },
      { status: 400 }
    );
  }

  try {
    await setAppSettingBool(
      CHARGEN_HEROES_SHARED_VISIBILITY_KEY,
      body.chargenHeroesSharedVisibility,
      session.user.id
    );
  } catch (err) {
    console.error("[manage/app-settings] patch failed", err);
    return NextResponse.json(
      {
        error:
          "Failed to save setting (is app_settings migrated?). Default remains " +
          String(CHARGEN_HEROES_SHARED_VISIBILITY_DEFAULT),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    chargenHeroesSharedVisibility: body.chargenHeroesSharedVisibility,
  });
}
