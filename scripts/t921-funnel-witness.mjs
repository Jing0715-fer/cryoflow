#!/usr/bin/env node
/**
 * t921 — the particle funnel's first LIVE ride on a minted chain (the
 * candidate carried twice into the next-window entries; the t461/t462
 * faces have lived on benches and in the t772/t804 audits, but the
 * funnel has never been opened against a REAL chain's receipts).
 *
 * The world (this window): a fresh re-seeded skeleton (3 idle jobs) —
 * the import was completed through the product's own run door against
 * the mock-cluster's real mic files (6 micrographs imported), then the
 * t916 chain minted through the REAL doors with the remote body EXPLICIT
 * (the resurrect lane; the mint's guards now resolve the Mock Cluster BY
 * NAME — conn-mv3y5x8f was one world's binding, not a law):
 *
 *   import (6 micrographs) → autopick (102 picks across 6 micrographs)
 *     → extract (60 particles) → class2d (60 particles, 4 classes)
 *     → select2d (never run — the amber row speaks "status: idle")
 *
 * THE WALK'S OWN TEETH: the mint wires import→autopick AND import→extract
 * (the chain's two inputs), so the up-walk at extract picks the LOWEST
 * canonical rank — import — and AUTOPICK LANDS IN THE CENSUS. The funnel
 * on this chain reads import → extract → class2d → select2d with the
 * picks stage speaking beside the line: the walk follows edges, not
 * wishes, and the witness asserts exactly that shape.
 *
 *   A   the route's ledger vs the lib's own mouth — /api/jobs/<id>/funnel
 *       compared FIELD-FOR-FIELD with funnelLedgerOf recomputed
 *       in-process (jiti import of the REAL brain) on the same jobs+edges:
 *       any drift between the route and the lib is a finding. Then the
 *       key numbers: 6 micrographs in, 60 particles out classified, the
 *       transform edge ("60 particles from 6 micrographs" — a unit change
 *       never a fake percentage), the carry edge ("all 60 carried
 *       through"), the amber select2d ("status: idle"), the census
 *       (autopick), no closing, FUNNEL_NOTE verbatim.
 *   R   the door brain's four laws, from the lib itself on the route's
 *       rows: the crown (deepest finished verb), the unfinished selection,
 *       the crowded selection, the no-receipts void — each line verbatim.
 *   D   the canvas door's live face: enabled with the crown title ("the
 *       deepest finished verb on the canvas"), the click fetches (the
 *       toolbar must not pay for a ledger nobody asked for), the dialog
 *       opens: the region's name, the headline, three bars (role=img with
 *       verbatim aria-labels), the dashed amber row, the two delta lines,
 *       the "4 classes" chip, NO per-mic chip (autopick is OFF the
 *       mainline — a chip would mean the walk drifted), the
 *       closing-absence line, the census line with its pours dots
 *       (funnel-pours-autopilot — funnel-pours-autopick, the SEVENTEENTH
 *       address's seventeenth reader), the scale's confession, the
 *       verbless footer, both export buttons.
 *   I   the inspector door — TWO DOORS, ONE ROOM: the class2d inspector's
 *       funnel entry (one GET per mount) counts the same 4 stages and
 *       opens the same dialog.
 *   S   SELECTION IS THE QUESTION, live: shift-click the idle select2d →
 *       the door DISABLES with the unfinished line; add the class2d → the
 *       crowded line; clear both → the crown returns; shift-click the
 *       class2d alone → "the verb you selected" and the same chain opens.
 *       The shift toggle is driven by synthetic PointerEvents the app is
 *       explicitly hardened for (capturePointer swallows the NotFoundError
 *       of a synthetic pointerId — the lib's own doc says automation).
 *   T   the ledger travels: the Copy button's dialect (flip to
 *       Copied/Copy failed within the beat, back to Copy ledger after the
 *       1600ms reset — the mechanic, honestly), and the CONTENT from the
 *       lib's own mouth: funnelLedgerText's grammar (the edge speaks
 *       first, indented) and funnelLedgerCsv's grid (edge_verb column,
 *       blank where the receipt said nothing countable).
 *   N   320 born-at-band: the funnel fits the narrow door, no overflow.
 *   W   the world guard: the funnel reads, it does not mutate.
 *
 *   node scripts/t921-funnel-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createJiti } from "jiti";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const T916 = path.join(ROOT, "data", "t916-class2d-mint.json");
const RECEIPT = "shots-qa/t921-funnel-witness.json";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 180_000, cwd: ROOT }).trim();
const evalJs = (expr) => execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.off) return "OFF-VIEWPORT";
    if (pos.own) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' }); return 'siv'; })()`);
    await sleep(500);
  }
  return "NEVER-VISIBLE";
};
const poll = async (expr, gate, times = 24, ms = 500) => {
  for (let i = 0; i < times; i++) {
    const v = evalJson(expr);
    if (v && gate(v)) return v;
    await sleep(ms);
  }
  return null;
};
const settleCensus = async () => {
  let last = null;
  for (let i = 0; i < 24; i++) {
    const census = evalJson(`JSON.stringify([...document.querySelectorAll('[data-job]')].map(c => { const b = c.querySelector('[role="button"][tabindex]') || c; const r = b.getBoundingClientRect(); return (c.getAttribute('data-job') ?? '') + ':' + Math.round(r.x) + ',' + Math.round(r.y); }).sort())`);
    if (census && census === last) break;
    last = census;
    await sleep(500);
  }
};
const shiftClick = async (name) => {
  // the selection toggle: pointerdown+up with shiftKey — dispatched on the
  // card's [role=button] click surface: the pointer HANDLERS live on the
  // inner card div, not the outer [data-job] wrapper — an event dispatched
  // on the wrapper never flows DOWN to them, but the surface bubbles
  // through the handler div. The app's own hardening (capturePointer's
  // NotFoundError swallow) makes the synthetic pointerId safe; the toggle
  // commits on pointerup.
  return evalJson(`(() => { const card = [...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}')); const surf = card?.querySelector('[role="button"][tabindex]'); if (!surf) return JSON.stringify({ err: 'no surface' }); surf.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = surf.getBoundingClientRect(); const opts = { bubbles: true, cancelable: true, composed: true, pointerId: 424242, pointerType: 'mouse', isPrimary: true, clientX: Math.round(r.x + r.width / 2), clientY: Math.round(r.y + r.height / 2), button: 0, buttons: 1, shiftKey: true }; surf.dispatchEvent(new PointerEvent('pointerdown', opts)); surf.dispatchEvent(new PointerEvent('pointerup', opts)); return JSON.stringify({ done: true }); })()`);
};
const openInspector = async (name) => {
  const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
  ok(`card "${name}" clicked (own at the actual point)`, String(clicked).startsWith("clicked@"), String(clicked));
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true
  );
  ok(`inspector open for "${name}"`, opened?.open === true);
  return opened;
};

// ---- the world --------------------------------------------------------------
if (!existsSync(T916)) { console.log("FATAL: no t916 manifest — mint the chain first (scripts/t916-class2d-mint.mjs mint)"); process.exit(2); }
const m916 = JSON.parse(readFileSync(T916, "utf8"));
const C2D = m916.class2d;   // the crown: "t916 class2d witness"
const SEL = m916.select2d;  // "t916 select witness" — idle, the amber row
const PICK = m916.pick;     // "t916 pick witness" — the census's autopick
const ROOTJ = m916.root;    // the world's import (6 micrographs)
const EX = m916.extract;    // "t916 extract witness"

const shApi = (url) => execSync(`curl -s -H "Origin: ${BASE}" "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });

// the REAL lib — the same brain the route and the dialog run
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });
const pf = await jiti.import(pathToFileURL(path.join(ROOT, "src/lib/particle-funnel.ts")).href);

console.log("== band A: the route's ledger vs the lib's own mouth ==");
const jobsAll = JSON.parse(shApi("/api/jobs")).jobs;
const edgesAll = JSON.parse(shApi("/api/edges")).edges;
const jobs0 = jobsAll.length;
const payload = JSON.parse(shApi(`/api/jobs/${C2D.id}/funnel`));
const replica = pf.funnelLedgerOf({ jobs: jobsAll, edges: edgesAll, enteredId: C2D.id });

// field-for-field: the route and the recomputed brain must agree
const stripRows = (rows) => rows.map((r) => [r.jobId, r.type, r.count, r.unit, r.classes, r.kind, r.width, r.perMic, r.delta?.line ?? null, r.delta?.kind ?? null, r.subnote ?? null]);
ok("A the route's ledger IS the lib's brain (field-for-field)", JSON.stringify(stripRows(payload.rows)) === JSON.stringify(stripRows(replica.rows)), "rows compared");
ok("A the census agrees", JSON.stringify(payload.offMainline) === JSON.stringify(replica.offMainline), JSON.stringify(payload.offMainline?.map((j) => j.name) ?? []));
ok("A the headline agrees", payload.headline === replica.headline, payload.headline);
ok("A the closing agrees (both null — no postprocess)", payload.closing === null && replica.closing === null);

// the walk's shape: import → extract → class2d → select2d, autopick in the census
ok("A four rows, the walk's order (import → extract → class2d → select2d)", JSON.stringify(payload.rows.map((r) => r.type)) === JSON.stringify(["import", "extract", "class2d", "select2d"]), JSON.stringify(payload.rows.map((r) => r.type)));
ok("A the counts speak the receipts (6 micrographs, 60, 60, none)", JSON.stringify(payload.rows.map((r) => r.count)) === JSON.stringify([6, 60, 60, null]), JSON.stringify(payload.rows.map((r) => r.count)));
ok("A the units speak the stages (micrographs, particles, particles, none)", JSON.stringify(payload.rows.map((r) => r.unit)) === JSON.stringify(["micrographs", "particles", "particles", null]), JSON.stringify(payload.rows.map((r) => r.unit)));
ok("A the transform edge speaks the unit change, never a fake percentage", payload.rows[1]?.delta?.line === "60 particles from 6 micrographs" && payload.rows[1]?.delta?.kind === "transform", payload.rows[1]?.delta?.line ?? "null");
ok("A the carry edge speaks the whole carry", payload.rows[2]?.delta?.line === "all 60 carried through" && payload.rows[2]?.delta?.kind === "carry", payload.rows[2]?.delta?.line ?? "null");
ok("A the amber row: select2d idle, no delta of its own", payload.rows[3]?.kind === "amber" && payload.rows[3]?.subnote === "status: idle" && payload.rows[3]?.delta === null, payload.rows[3]?.subnote ?? "?");
ok("A the class2d row carries its class census + the parsed quiet note", payload.rows[2]?.classes === 4 && payload.rows[2]?.subnote === "top: class 3 at 25%", `${payload.rows[2]?.classes} classes · ${payload.rows[2]?.subnote}`);
ok("A the headline arc verbatim", payload.headline === "6 micrographs went in · 60 particles came out classified", payload.headline);
ok("A the census names the skipped picks stage (the walk's own tooth)", payload.offMainline?.length === 1 && payload.offMainline[0]?.type === "autopick" && payload.offMainline[0]?.name === PICK.name, JSON.stringify(payload.offMainline?.map((j) => `${j.name} (${j.type})`)));
ok("A NO per-mic chip on any row (autopick is off the mainline — a chip would mean the walk drifted)", payload.rows.every((r) => r.perMic == null));
ok("A the scale's confession travels verbatim", payload.note === pf.FUNNEL_NOTE && (payload.note ?? "").startsWith("Bars are square-root scaled"));
ok("A the route's jobId names the entered verb", payload.jobId === C2D.id);

/* ---- band R: the door brain's four laws, from the lib itself ---- */
console.log("== band R: the door brain's four laws (the lib on the route's rows) ==");
const crown = pf.funnelDoorCandidate(jobsAll, []);
ok("R the crown: the deepest finished funnel verb is the class2d", crown.kind === "ready" && crown.job?.id === C2D.id && crown.picked === "crown", crown.kind === "ready" ? `${crown.job?.name} (${crown.picked})` : crown.kind);
const unfinished = pf.funnelDoorCandidate(jobsAll, [SEL.id]);
ok("R the unfinished selection blocks honestly (the lib's own line)", unfinished.kind === "blocked" && unfinished.reason === "selection-unfinished" && unfinished.line === pf.FUNNEL_DOOR_BLOCK_LINES["selection-unfinished"], unfinished.line ?? unfinished.kind);
const crowded = pf.funnelDoorCandidate(jobsAll, [C2D.id, EX.id]);
ok("R the crowded selection blocks honestly", crowded.kind === "blocked" && crowded.reason === "selection-crowded" && crowded.line === pf.FUNNEL_DOOR_BLOCK_LINES["selection-crowded"], crowded.line ?? crowded.kind);
const void_ = pf.funnelDoorCandidate(jobsAll.filter((j) => !pf.FUNNEL_ENTRY_TYPES.has(j.type)), []);
ok("R no receipts, no door (the void's line)", void_.kind === "blocked" && void_.reason === "no-receipts" && void_.line === pf.FUNNEL_DOOR_BLOCK_LINES["no-receipts"], void_.line ?? void_.kind);

/* ==================== band D: the canvas door's live face ================= */
const doorUntilOpen = async () => {
  // the eaten-click law (t919 #2): the toolbar re-renders under the live
  // poll — the door is clicked until the funnel DIALOG ITSELF says open.
  for (let i = 0; i < 3; i++) {
    const clicked = await realClick(`document.querySelector('[data-canvas-ui="funnel-toggle"]')`);
    if (String(clicked).startsWith("clicked@")) {
      const opened = await poll(`(() => { const d = ${funnelDlg}; return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 10, 500);
      if (opened?.open === true) return `open@try${i + 1}`;
    }
    await sleep(700);
  }
  return "NEVER-OPEN";
};
const doorState = () => evalJson(`(() => { const b = document.querySelector('[data-canvas-ui="funnel-toggle"]'); return JSON.stringify({ disabled: b?.disabled ?? null, title: b?.getAttribute('title') ?? null, aria: b?.getAttribute('aria-label') ?? null }); })()`);

console.log("== band D: the canvas door (fetch-on-click, the whole face) ==");
sh(`${AB} set viewport 1280 900`);
sh(`${AB} open ${BASE}/`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobs0 - 1, 30);
await settleCensus();
const door = await poll(
  `(() => { const b = document.querySelector('[data-canvas-ui="funnel-toggle"]'); return JSON.stringify({ present: !!b, disabled: b?.disabled ?? null, aria: b?.getAttribute('aria-label') ?? null, title: b?.getAttribute('title') ?? null }); })()`,
  (v) => v.present === true, 20, 600
);
ok("D the funnel button present in the toolbar (beside the minimap and find toggles)", door?.present === true);
ok("D the door ENABLED with no selection (the crown speaks)", door?.disabled === false);
ok("D the aria names the chain through the class2d", (door?.aria ?? "") === `Particle funnel — read where the particles went, through ${C2D.name}`, door?.aria ?? "");
ok("D the title confesses its choice: the deepest finished verb on the canvas", (door?.title ?? "").includes(`Opens the chain that runs through ${C2D.name}`) && (door?.title ?? "").includes("the deepest finished verb on the canvas"), (door?.title ?? "").slice(-80));
const doorClick = await realClick(`document.querySelector('[data-canvas-ui="funnel-toggle"]')`);
ok("D the door clicked (own at the actual point)", String(doorClick).startsWith("clicked@"), String(doorClick));
const funnelDlg = `[...document.querySelectorAll('[role="dialog"]')].find(d => (d.querySelector('h2')?.textContent || '').startsWith('Particle funnel —'))`;
const dlgOpen = await poll(`(() => { const d = ${funnelDlg}; return JSON.stringify({ open: !!d, title: d?.querySelector('h2')?.textContent ?? null }); })()`, (v) => v.open === true, 20, 600);
ok("D the dialog OPEN (the fetch was the click's own)", dlgOpen?.open === true, dlgOpen?.title ?? "");
ok("D the dialog's title names the host verb", dlgOpen?.title === `Particle funnel — ${C2D.name}`, dlgOpen?.title ?? "");

const region = `[...document.querySelectorAll('[role="region"]')].find(r => (r.getAttribute('aria-label') || '').startsWith('Particle funnel reading'))`;
const face = await poll(
  `(() => { const r = ${region}; if (!r) return JSON.stringify({}); const t = r.textContent || ''; return JSON.stringify({ headline: r.querySelector('.text-xs.font-medium')?.textContent ?? null, bars: [...r.querySelectorAll('[role="img"]')].map(b => b.getAttribute('aria-label')), amber: t.includes('status: idle'), deltas: ['60 particles from 6 micrographs', 'all 60 carried through'].map(line => !![...r.querySelectorAll('div')].find(d => (d.textContent || '').trim() === line)), classesChip: [...r.querySelectorAll('span')].some(s => (s.textContent || '').trim() === '4 classes'), perMic: t.includes('/mic'), closingAbsence: t.includes("No postprocess ends this chain yet — the funnel's last number is where the ledger currently stops."), census: t.includes('Off this mainline, the same chain also fed:') && t.includes('${PICK.name}') && t.includes('(autopick)') && t.includes('The walk follows one line at each branch — these ran beside it.'), pours: !!r.querySelector('[data-testid="funnel-pours-autopick"]'), note: t.includes('Bars are square-root scaled'), verbless: t.includes('The funnel reads the receipts; it does not mutate.'), csv: !!r.parentElement.querySelector('[data-testid="funnel-export-csv"]'), copy: !!r.parentElement.querySelector('[data-testid="funnel-copy-ledger"]') }); })()`,
  (v) => (v.bars ?? []).length === 3, 20, 600
);
ok("D the region's name speaks the reading", !!face?.headline);
ok("D the headline arc rendered", face?.headline === "6 micrographs went in · 60 particles came out classified", face?.headline ?? "null");
ok("D THREE bars with verbatim aria-labels (import 6 micrographs, extract 60, class2d 60)", JSON.stringify(face?.bars ?? []) === JSON.stringify([`${ROOTJ.name}: 6 micrographs`, `${EX.name}: 60 particles`, `${C2D.name}: 60 particles`]), JSON.stringify(face?.bars ?? []));
ok("D the amber row speaks status: idle (the never-run verb is never dropped)", face?.amber === true);
ok("D BOTH delta lines rendered verbatim (transform + carry)", (face?.deltas ?? []).every(Boolean) && (face?.deltas ?? []).length === 2, JSON.stringify(face?.deltas ?? []));
ok("D the '4 classes' chip on the class2d row", face?.classesChip === true);
ok("D NO per-mic chip anywhere (the walk's shape, witnessed in the DOM)", face?.perMic === false);
ok("D the closing-absence line verbatim (no postprocess ends this chain)", face?.closingAbsence === true);
ok("D the census line: the skipped autopick named, the walk's sentence verbatim", face?.census === true);
ok("D the census's pours dots ride the type word (funnel-pours-autopick)", face?.pours === true);
ok("D the scale's confession present", face?.note === true);
ok("D the verbless footer present", face?.verbless === true);
ok("D both export doors present (CSV + Copy ledger)", face?.csv === true && face?.copy === true);
sh(`${AB} press Escape`); await sleep(600);

/* ================= band I: the inspector door — two doors, one room ====== */
console.log("== band I: the inspector's funnel entry (one GET per mount) ==");
await settleCensus();
await openInspector(C2D.name);
const inspDoor = await poll(
  `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${C2D.name}')); const b = [...(d?.querySelectorAll('button') ?? [])].find(x => (x.getAttribute('aria-label') || '').startsWith('Particle funnel — read where the particles went across')); return JSON.stringify({ aria: b?.getAttribute('aria-label') ?? null }); })()`,
  (v) => v.aria, 20, 600
);
ok("I the inspector door counts the same 4 stages", inspDoor?.aria === `Particle funnel — read where the particles went across 4 stages`, inspDoor?.aria ?? "ABSENT");
const inspClick = await realClick(`[...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${C2D.name}'))?.querySelector('button[aria-label^="Particle funnel — read where the particles went across"]')`);
ok("I the inspector door clicked", String(inspClick).startsWith("clicked@"), String(inspClick));
const dlgI = await poll(`(() => { const d = ${funnelDlg}; return JSON.stringify({ open: !!d, title: d?.querySelector('h2')?.textContent ?? null }); })()`, (v) => v.open === true, 20, 600);
ok("I the SAME dialog opens (two doors, one room)", dlgI?.open === true && dlgI?.title === `Particle funnel — ${C2D.name}`, dlgI?.title ?? "");
sh(`${AB} press Escape`); await sleep(600);

/* ============ band S: SELECTION IS THE QUESTION — the live laws =========== */
console.log("== band S: the door's selection laws, driven live ===");
sh(`${AB} press Escape`); await sleep(500);
let stackS = 0;
for (let i = 0; i < 3; i++) {
  stackS = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`)?.n ?? -1;
  if (stackS === 0) break;
  sh(`${AB} press Escape`); await sleep(600);
}
ok("S the stack reset before the selection ride", stackS === 0, `dialogs=${stackS}`);
await settleCensus();
// 1. shift-click the idle select2d → unfinished, the door disabled
await shiftClick(SEL.name);
await sleep(500);
const doorS1 = doorState();
ok("S shift-click the idle select2d → the door DISABLES (never swaps another run's funnel)", doorS1?.disabled === true, doorS1?.title ?? "");
ok("S the disabled door SPEAKS the unfinished line", doorS1?.title === pf.FUNNEL_DOOR_BLOCK_LINES["selection-unfinished"], doorS1?.title ?? "");
// 2. add the class2d → crowded
await shiftClick(C2D.name);
await sleep(500);
const doorS2 = doorState();
ok("S two fingers on the canvas → the crowded line", doorS2?.disabled === true && doorS2?.title === pf.FUNNEL_DOOR_BLOCK_LINES["selection-crowded"], doorS2?.title ?? "");
// 3. clear both → the crown returns
await shiftClick(SEL.name); await sleep(400);
await shiftClick(C2D.name); await sleep(500);
const doorS3 = doorState();
ok("S the toggles cleared → the crown face returns (deterministic, same chain)", doorS3?.disabled === false && (doorS3?.title ?? "").includes("the deepest finished verb"), (doorS3?.title ?? "").slice(-60));
// 4. shift-click the class2d ALONE → the verb you selected
await shiftClick(C2D.name); await sleep(500);
const doorS4 = doorState();
ok("S one selected verb wins over the crown — ENABLED, 'the verb you selected'", doorS4?.disabled === false && (doorS4?.title ?? "").includes("the verb you selected"), (doorS4?.title ?? "").slice(-60));
ok("S the aria stays the chain's own (through the class2d)", doorS4?.aria === `Particle funnel — read where the particles went, through ${C2D.name}`, doorS4?.aria ?? "");
const selEffect = await doorUntilOpen();
ok("S the SAME chain opens from the selection (the selection is the question)", String(selEffect).startsWith("open@"), String(selEffect));
sh(`${AB} press Escape`); await sleep(500);
await shiftClick(C2D.name); await sleep(400); // clear the selection — the world back as found

/* ================= band T: the ledger travels ============================ */
console.log("== band T: the ledger travels (the copy's mechanic + the lib's grammar) ===");
// the dialog must be OPEN for the copy's mechanic — the S band's cleanup
// may have left the canvas bare; the door re-opens it until-effect
const preT = await poll(`(() => { const d = ${funnelDlg}; return JSON.stringify({ open: !!d }); })()`, (v) => v.open === true, 2, 300);
if (preT?.open !== true) {
  const tOpen = await doorUntilOpen();
  ok("T the funnel dialog re-opened for the copy ride", String(tOpen).startsWith("open@"), String(tOpen));
}
const copyBtn = await realClick(`${funnelDlg}?.querySelector('[data-testid="funnel-copy-ledger"]')`);
ok("T the Copy ledger button clicked", String(copyBtn).startsWith("clicked@"), String(copyBtn));
const flip = await poll(
  `(() => { const b = ${funnelDlg}?.querySelector('[data-testid="funnel-copy-ledger"]'); return JSON.stringify({ label: b?.textContent?.trim() ?? null }); })()`,
  (v) => v.label === "Copied" || v.label === "Copy failed", 8, 300
);
ok("T the copy dialect flips within the beat (Copied or Copy failed — never a stuck button)", flip?.label === "Copied" || flip?.label === "Copy failed", flip?.label ?? "STUCK");
const reset = await poll(
  `(() => { const b = ${funnelDlg}?.querySelector('[data-testid="funnel-copy-ledger"]'); return JSON.stringify({ label: b?.textContent?.trim() ?? null }); })()`,
  (v) => v.label === "Copy ledger", 12, 500
);
ok("T the 1600ms reset returns the button to Copy ledger", reset?.label === "Copy ledger", reset?.label ?? "");

// the content — the lib's own mouth, on the route's payload
const text = pf.funnelLedgerText(payload, C2D.name);
ok("T the text opens with the host-named header + the headline arc", text.startsWith(`Particle funnel — ${C2D.name}\n6 micrographs went in · 60 particles came out classified\n`), text.split("\n")[0]);
ok("T the edge speaks FIRST, indented, feeding the row below it", text.includes("\n  60 particles from 6 micrographs\nt916 extract witness [extract]: 60 particles") && text.includes("\n  all 60 carried through\nt916 class2d witness [class2d]: 60 particles · 4 classes"));
ok("T the amber row travels as its status (never guessed)", text.includes(`t916 select witness [select2d]: status: idle`));
ok("T the closing-absence + the census + both confessions travel", text.includes("No postprocess ends this chain yet") && text.includes(`Off this mainline, the same chain also fed: ${PICK.name} [autopick]`) && text.includes("The funnel reads the receipts; it does not mutate — a different chain comes from re-running a verb."));
const csv = pf.funnelLedgerCsv(payload);
const csvLines = (csv ?? "").split("\n");
ok("T the CSV: one row per station, the stage column speaks the walk's order", csvLines.length === 5 && csvLines[1]?.startsWith("1,") && csvLines[4]?.startsWith("4,"), `${csvLines.length - 1} stations`);
const csvCells = csvLines.map((l) => l.split(","));
ok("T the CSV's edge_verb column: blank / transform / carry / blank", (csvCells[1]?.[9] ?? "x") === "" && csvCells[2]?.[9] === "transform" && csvCells[3]?.[9] === "carry" && (csvCells[4]?.[9] ?? "x") === "");
ok("T the CSV blanks the amber count (never a zero — blank is 'never counted')", (csvCells[4]?.[6] ?? "x") === "" && csvCells[4]?.[4] === "amber");
ok("T the CSV filename law: the chain's host rides the slug", pf.funnelLedgerCsvFilename(C2D.name).startsWith("particle-funnel-t916-class2d-witness-"), pf.funnelLedgerCsvFilename(C2D.name).slice(0, 44));
sh(`${AB} press Escape`); await sleep(500);

/* ================= band N: 320 born-at-band ============================== */
console.log("== band N: the funnel at the narrow door ==");
sh(`${AB} set viewport 320 800`);
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= jobs0 - 1, 30);
await settleCensus();
const doorN = await realClick(`document.querySelector('[data-canvas-ui="funnel-toggle"]')`);
ok("N the door clicked at 320", String(doorN).startsWith("clicked@"), String(doorN));
const dlgN = await poll(
  `(() => { const d = ${funnelDlg}; if (!d) return JSON.stringify({}); const r = d.getBoundingClientRect(); return JSON.stringify({ open: !!d, inW: r.left >= -1 && r.right <= document.documentElement.clientWidth + 1, w: Math.round(r.width) }); })()`,
  (v) => v.open === true, 20, 600
);
ok("N the funnel fits the narrow door", dlgN?.inW === true, `w=${dlgN?.w}`);
const overN = evalJson(`JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
ok("N no horizontal overflow at 320", (overN?.overX ?? 0) <= 0, `overX=${overN?.overX}`);
sh(`${AB} press Escape`); await sleep(400);

/* ---- band W: the world guard ---- */
sh(`${AB} set viewport 1280 900`);
const jobsAfter = JSON.parse(shApi("/api/jobs")).jobs.length;
ok("WORLD the funnel reads the receipts; it does not mutate", jobsAfter === jobs0, `${jobsAfter} vs ${jobs0}`);

mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(path.join(ROOT, RECEIPT), JSON.stringify({
  at: new Date().toISOString(),
  pass, fail,
  world: { jobs: jobs0, crown: C2D.name, walk: payload.rows.map((r) => `${r.type}:${r.count ?? "amber"}`), census: payload.offMainline.map((j) => j.type) },
}, null, 2));
console.log(`== t921 ${fail === 0 ? "GREEN" : "RED"} — ${pass} ok, ${fail} fail == (receipt: ${RECEIPT})`);
process.exit(fail === 0 ? 0 : 1);
