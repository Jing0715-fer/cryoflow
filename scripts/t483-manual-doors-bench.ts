/**
 * t483 — the manual's rows open the doors they name.
 *
 * t482 built the manual (HELP_CHAPTERS, five chapters, 22 rows); t483
 * makes it walkable. A row whose first move is to reach a surface now
 * carries that door: GUIDE_DOORS is the registry, chapters map row
 * indices to door ids, and a named row renders as a button that yields
 * focus before the door swings open. The storage map needed a new
 * cross-open route (STORAGE_OPEN_EVENT — the header owns the dialog,
 * the manual only rings the bell), and the palette's OPEN_EVENT is
 * exported for the guide's reverse hop.
 *
 * This bench holds the law BOTH ways:
 *   1. every registered door is named by a manual row (the row's words
 *      must cover the door's names), and
 *   2. every cryoflow:open-* event in the codebase must be referenced
 *      by the guide — a new wing without a manual row fails the bench.
 * Plus the no-lying-rows checks: a rowDoors key must be a valid row
 * index, its value a valid door id, and the row must still name its
 * door in words.
 *
 * Run: bun run scripts/t483-manual-doors-bench.ts
 */

import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/* ------------------------------------------------------------------ */
/* Imports (the component module is pure UI tree — bun imports it fine) */
/* ------------------------------------------------------------------ */

const { HELP_CHAPTERS, GUIDE_DOORS } = await import(
  "../src/components/workflow/help-guide-dialog"
);

/* ------------------------------------------------------------------ */
/* T1 — the door registry's shape                                      */
/* ------------------------------------------------------------------ */

console.log("T1. GUIDE_DOORS — six doors, each with a label, names, an open");

{
  must(GUIDE_DOORS.length === 6, "T1a: the registry carries 6 doors");
  must(
    new Set(GUIDE_DOORS.map((d) => d.id)).size === GUIDE_DOORS.length,
    "T1b: door ids are unique",
  );
  must(
    JSON.stringify(GUIDE_DOORS.map((d) => d.id)) ===
      JSON.stringify([
        "assistant",
        "storage",
        "clusters",
        "palette",
        "shortcuts",
        "report",
      ]),
    "T1c: the doors are assistant / storage / clusters / palette / shortcuts / report",
  );
  must(
    GUIDE_DOORS.every(
      (d) => d.label.length > 3 && d.names.length > 0 && d.names.every((n) => n.length > 2),
    ),
    "T1d: every door has a label and nameable words",
  );
  must(
    GUIDE_DOORS.every((d) => typeof d.open === "function"),
    "T1e: every door can actually open",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the governance: every door is named by a manual row            */
/* ------------------------------------------------------------------ */

console.log("T2. the governance — a door without a manual row fails the bench");

{
  const rowsWithDoors = HELP_CHAPTERS.flatMap((c) =>
    c.rows.map((row, i) => ({
      chapter: c.id,
      row,
      doorId: c.rowDoors?.[i],
    })),
  );

  for (const door of GUIDE_DOORS) {
    const carriers = rowsWithDoors.filter((r) => r.doorId === door.id);
    must(
      carriers.length >= 1,
      `T2·${door.id}: at least one row carries the ${door.id} door`,
    );
    must(
      carriers.every((r) => door.names.every((n) => r.row.includes(n))),
      `T2·${door.id}: every carrying row names the door in words (${door.names.join(", ")})`,
    );
  }

  const doorRows = rowsWithDoors.filter((r) => r.doorId).length;
  must(
    doorRows === 6,
    `T2f: exactly ${6} rows carry doors (the reach-a-surface rows), got ${doorRows}`,
  );
}

/* ------------------------------------------------------------------ */
/* T3 — no lying rows: valid indices, valid ids, full sweep            */
/* ------------------------------------------------------------------ */

console.log("T3. no lying rows — and every open-event in src answers to the manual");

{
  for (const c of HELP_CHAPTERS) {
    if (!c.rowDoors) continue;
    for (const [k, v] of Object.entries(c.rowDoors)) {
      const i = Number(k);
      must(
        Number.isInteger(i) && i >= 0 && i < c.rows.length,
        `T3·${c.id}[${k}]: the door key is a valid row index`,
      );
      must(
        GUIDE_DOORS.some((d) => d.id === v),
        `T3·${c.id}[${k}]: "${v}" is a registered door id`,
      );
    }
  }
  must(
    HELP_CHAPTERS.every((c) => !c.rowDoors || Object.keys(c.rowDoors).length > 0),
    "T3c: an empty rowDoors map is absent, not present-but-empty",
  );

  // the automatic sweep: every cryoflow:open-* event string in src must
  // have a declaring constant, and that constant must be referenced by
  // the guide — a new wing's door event without a manual row lands here.
  const wfDir = path.join(ROOT, "src/components/workflow");
  const files = readdirSync(wfDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
  const events = new Map<string, string>(); // event string -> constant name
  for (const f of files) {
    const text = src(path.relative(ROOT, path.join(wfDir, f)));
    for (const m of text.matchAll(/"cryoflow:open-[a-z-]+"/g)) {
      const ev = m[0].slice(1, -1);
      const decl = new RegExp(`export const (\\w+) = "${ev}"`).exec(text);
      events.set(ev, decl ? decl[1] : "");
    }
  }
  must(
    events.size >= 4,
    `T3d: the sweep found ${events.size} open-events (≥ 4)`,
  );
  const guide = src("src/components/workflow/help-guide-dialog.tsx");
  const orphans: string[] = [];
  for (const [ev, constant] of events) {
    if (!constant || !guide.includes(constant)) orphans.push(`${ev} (${constant || "unnamed"})`);
  }
  must(
    orphans.length === 0,
    orphans.length === 0
      ? "T3e: every open-event in src is referenced by the manual — no wing without a row"
      : `T3e: manual owes rows to: ${orphans.join(", ")}`,
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the wiring: new route, reverse hop, owner listens              */
/* ------------------------------------------------------------------ */

console.log("T4. the wiring — the storage route exists, the palette exports, the guide dispatches");

{
  const header = src("src/components/workflow/header.tsx");
  must(
    header.includes('export const STORAGE_OPEN_EVENT = "cryoflow:open-storage"') &&
      header.includes(`window.addEventListener(STORAGE_OPEN_EVENT, open)`),
    "T4a: the header exports the storage event AND listens for it (owner-listens law)",
  );
  const palette = src("src/components/workflow/command-palette.tsx");
  must(
    palette.includes('export const OPEN_EVENT = "cryoflow:open-palette"'),
    "T4b: the palette's OPEN_EVENT is exported for the guide's reverse hop",
  );
  must(
    guide_src().includes("STORAGE_OPEN_EVENT") &&
      guide_src().includes("REMOTE_CLUSTERS_OPEN_EVENT") &&
      guide_src().includes("OPEN_EVENT") &&
      guide_src().includes("SESSION_REPORT_EVENT"),
    "T4c: the guide references all four event doors",
  );
  must(
    guide_src().includes("setAiAssistantOpen(true)") &&
      guide_src().includes("setShortcutsOpen(true)"),
    "T4d: the guide opens the assistant and shortcuts through their store flags",
  );
  must(
    guide_src().includes("setOpen(false)") &&
      guide_src().includes("door.open()"),
    "T4e: the row's click yields focus first, then opens the door (the palette-taught dance)",
  );
  must(
    existsSync(path.join(ROOT, "src/app/icon.svg")),
    "T4f: the favicon exists — a fresh visit is not greeted by a 404 (t483's QA fix)",
  );
}

function guide_src() {
  return src("src/components/workflow/help-guide-dialog.tsx");
}

/* ------------------------------------------------------------------ */

console.log(`\nt483 manual-doors bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
