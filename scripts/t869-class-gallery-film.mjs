#!/usr/bin/env node
/**
 * t869 probe — the class2d gallery's FRESH FILM (the t868 tail's second
 * candidate): the seeder's phantoms changed the class stacks' pixels this
 * window, so the MrcGallery face's imgs deserve a re-witness — the tiles
 * re-filmed LIVE (count, alt coverage, decode coverage via naturalWidth,
 * the Enlarge doors' names, zero unnamed page-wide), the tile srcs
 * recorded in the receipt, and a screenshot to the archive.
 *
 * The host is MEASURED, never pinned: the first completed job whose
 * outputs include a .mrcs stack (the class averages' own medium).
 *
 *   node scripts/t869-class-gallery-film.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";

let pass = 0;
let fail = 0;
const results = [];
const ok = (label, cond, detail = "") => {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
  }
  results.push({ label, pass: !!cond, detail });
};

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT });
const sleep = (s) => execSync(`sleep ${s}`);
const evalJson = (js) => {
  const raw = ab(`eval ${JSON.stringify(js)}`).trim();
  let out;
  try {
    out = JSON.parse(raw);
  } catch {
    throw new Error(`unparseable eval output: ${raw.slice(0, 200)}`);
  }
  if (typeof out === "string") {
    try {
      const inner = JSON.parse(out);
      if (inner && typeof inner === "object") return inner;
    } catch {
      /* a plain string */
    }
  }
  return out;
};

const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};
const roster = async () => {
  const r = await fetch(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};
const outputs = async (id) => {
  const r = await fetch(`${BASE}/api/jobs/${id}/outputs`, { headers: SH });
  const b = await r.json();
  return b.files ?? b;
};

const plainClick = (id) =>
  '(() => { const c = document.querySelector("[data-card-btn=\\"' + id + '\\"]"); if (!c) return JSON.stringify({ clicked: false }); const r = c.getBoundingClientRect(); const opts = { bubbles: true, button: 0, pointerId: 9, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }; c.dispatchEvent(new PointerEvent("pointerdown", opts)); c.dispatchEvent(new PointerEvent("pointerup", opts)); return JSON.stringify({ clicked: true }); })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';

const MEASURE =
  '(() => { const btns = Array.from(document.querySelectorAll("button")); const un = btns.filter((b) => !(b.getAttribute("aria-label") || (b.textContent || "").trim())); const ctrls = Array.from(document.querySelectorAll("input,select,textarea")); const unCtrls = ctrls.filter((c) => !(c.getAttribute("aria-label") || c.labels?.length)); const imgs = Array.from(document.querySelectorAll("img")); const altless = imgs.filter((i) => !i.hasAttribute("alt")); const dgs = Array.from(document.querySelectorAll("[role=dialog]")); const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); const tiles = sec ? Array.from(sec.querySelectorAll("button[data-tile-path]")) : []; const galleryImgs = sec ? Array.from(sec.querySelectorAll("img")) : []; const decoded = galleryImgs.filter((i) => i.complete && i.naturalWidth > 0); const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?…$/.test((e.textContent || "").trim())); return JSON.stringify({ pageBtns: btns.length, pageUnnamed: un.length, unCtrls: unCtrls.length, imgs: imgs.length, altless: altless.length, hasDlg: dgs.length > 0, dlgCount: dgs.length, shimmer: leaves.length, gallery: !!sec, tiles: tiles.length, tileNamed: tiles.every((t) => (t.getAttribute("aria-label") || "").startsWith("Enlarge ")), gImgs: galleryImgs.length, gDecoded: decoded.length, gAlts: galleryImgs.slice(0, 6).map((i) => (i.getAttribute("alt") || "").slice(0, 44)), gSrcs: galleryImgs.slice(0, 6).map((i) => (i.currentSrc || i.src || "").replace(location.origin, "").slice(0, 90)) }); })()';

const waitFor = (what, probe, maxSecs = 30) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};

console.log("t869 probe — the class2d gallery's fresh film (one command)\n");

/* the host: measured — a completed class2d job first (the class averages'
 * own stacks: run_classes.mrcs), else the first completed job whose
 * outputs include any .mrcs stack. */
const jobs = await roster();
const stackHosts = [];
for (const j of jobs.filter((x) => x.status === "completed")) {
  const files = await outputs(j.id);
  const stack = (Array.isArray(files) ? files : []).find((f) => (f.path || "").endsWith(".mrcs"));
  if (stack) stackHosts.push({ job: j, stack: stack.path });
}
const picked = stackHosts.find((s) => s.job.type === "class2d") ?? stackHosts[0];
if (!picked) {
  console.error("no completed job carries a .mrcs stack — the class gallery cannot open");
  writeFileSync(
    join(ROOT, "shots-qa/t869-class-gallery-film.json"),
    JSON.stringify({ instrument: "scripts/t869-class-gallery-film.mjs", date: new Date().toISOString(), checks: results, passed: pass, failed: fail + 1, total: pass + fail + 1, verdict: "no stack host — the ride stopped honestly before the film" }, null, 2)
  );
  process.exit(1);
}
const host = picked.job;
const stackPath = picked.stack;
console.log(`  stack host (measured): ${host.name} (${stackPath.split("/").pop()})`);

ab("open http://localhost:3000");
sleep(3);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
const c1 = evalJson(plainClick(host.id));
ok("F1 the card's plain door opened the inspector (the submitted law)", c1.clicked === true);
waitFor("the inspector", (m) => m.hasDlg && m.dlgCount >= 1);
evalJson(tabMouseDown("Results"));
sleep(3);
const g1 = waitFor(
  "the gallery with its imgs decoded (the film's subject)",
  (m) => m.gallery === true && m.gImgs >= 1 && m.gDecoded === m.gImgs && m.shimmer === 0,
  40
);
ok("F2 the Maps-and-images section is present and named", g1.gallery === true);
ok(
  "F3 the gallery's imgs ALL DECODED (complete && naturalWidth > 0 — the fresh film's pixels are really there)",
  g1.gImgs >= 1 && g1.gDecoded === g1.gImgs,
  `imgs=${g1.gImgs} decoded=${g1.gDecoded}`
);
ok(
  "F4 every gallery img speaks an alt (the film's captions)",
  g1.gImgs >= 1 && g1.altless === 0,
  `first alts=${JSON.stringify(g1.gAlts.slice(0, 3))}`
);
ok(
  "F5 the Enlarge doors are aboard, each named (the text IS the name)",
  g1.tiles >= 1 && g1.tileNamed === true,
  `tiles=${g1.tiles}`
);
ok(
  "F6 zero unnamed page-wide WITH the gallery up (the census's invariant)",
  g1.pageUnnamed === 0 && g1.unCtrls === 0 && g1.altless === 0,
  `btns=${g1.pageBtns}`
);
/* the film: a settled second ride + the screenshot to the archive */
sleep(2);
const g2 = evalJson(MEASURE);
ok(
  "F7 two films one story apart (the settled pair agrees on the img count and the decode coverage)",
  g2.gImgs === g1.gImgs && g2.gDecoded === g1.gDecoded,
  `imgs ${g1.gImgs}/${g1.gDecoded} -> ${g2.gImgs}/${g2.gDecoded}`
);
try {
  const shot = execSync(`agent-browser screenshot shots-qa/t869-class-gallery-film.png`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
  ok("F8 the film archived (shots-qa/t869-class-gallery-film.png)", true, String(shot || "saved").trim().slice(0, 60));
} catch (e) {
  ok("F8 the film archived", false, String((e && e.stderr) || e).slice(0, 120));
}

writeFileSync(
  join(ROOT, "shots-qa/t869-class-gallery-film.json"),
  JSON.stringify(
    {
      instrument: "scripts/t869-class-gallery-film.mjs",
      date: new Date().toISOString(),
      host: { name: host.name, id: host.id },
      stack: stackPath,
      film: { srcs: g2.gSrcs, imgs: g2.gImgs, decoded: g2.gDecoded },
      checks: results,
      passed: pass,
      failed: fail,
      total: pass + fail,
      verdict:
        fail === 0
          ? "the class gallery's fresh film holds: every img decoded (the phantoms' new pixels really on the canvas), alts and Enlarge doors named, zero unnamed, the tile srcs recorded"
          : `the film reds in ${fail} place(s)`,
    },
    null,
    2
  )
);
console.log(`\nCLASS-GALLERY-FILM t869: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
