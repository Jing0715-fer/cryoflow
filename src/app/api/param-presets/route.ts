import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { sanitizePresetShelf } from "@/lib/param-preset-sanitize";

export const dynamic = "force-dynamic";

/* ------------------------------------------------------------------ */
/* User param presets shelf — the server mirror of the t713 lib        */
/* ------------------------------------------------------------------ */
// lib/user-param-presets.ts keeps presets in localStorage (instant,
// per browser); this route is the camera-bookmark-pattern second layer:
// one fixed row (PresetShelf, id = "user-param-presets") holding the
// WHOLE collection, so a snapshot saved here follows the user across
// browsers and devices. The wire shape is the lib's own shape — the
// mirror speaks the same dialect, it is not a second truth.
//
// t715 — both handlers carry the isLocalRequest door (t709 law: every
// new route is born doored). The GET's value to a blind probe is the
// user's tuned-parameter vocabulary; the PUT's value is a write slot
// on that vocabulary. Same policy as the saved-state pair: one door,
// every handler.
//
// EMPTY-SHELF SEMANTICS — the row is KEPT on an empty PUT (unlike
// BookmarkSession, which deletes its row): the row's existence is the
// "synced" flag the client's reconcile reads. A fresh server that never
// saw a shelf reports synced:false ("nothing to adopt — your local list
// is the truth"), while an emptied-on-another-browser shelf reports
// synced:true with an empty list ("the deletion is the truth — adopt
// it"). Deleting the row on empty would erase that distinction and
// resurrect deleted presets on the next reconcile.

const SHELF_ID = "user-param-presets";

export async function GET(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to the preset shelf is not allowed" },
      { status: 403 },
    );
  }
  try {
    const row = await db.presetShelf.findUnique({ where: { id: SHELF_ID } });
    if (!row) return NextResponse.json({ presets: [], synced: false });
    let presets: ReturnType<typeof sanitizePresetShelf> = [];
    try {
      presets = sanitizePresetShelf(JSON.parse(row.data));
    } catch {
      presets = []; // corrupt row reads as empty — the next PUT rewrites it
    }
    return NextResponse.json({ presets, synced: true });
  } catch {
    return NextResponse.json({ presets: [], synced: false, error: "read failed" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to the preset shelf is not allowed" },
      { status: 403 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const presets = sanitizePresetShelf((body as { presets?: unknown } | null)?.presets);
  try {
    await db.presetShelf.upsert({
      where: { id: SHELF_ID },
      update: { data: JSON.stringify(presets) },
      create: { id: SHELF_ID, data: JSON.stringify(presets) },
    });
    return NextResponse.json({ ok: true, count: presets.length });
  } catch {
    return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }
}
