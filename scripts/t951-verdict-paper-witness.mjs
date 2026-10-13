#!/usr/bin/env node
/**
 * t951 — THE VERDICT'S PAPER: the compare family's last unwitnessed sheet
 * gets its first live ride.
 *
 * The t946 unit pins the verdict dialog's print face to the SOURCE (the
 * family hook, the provenance line, the verbless design) — but no browser
 * ever saw it, because the world never carried a completed postprocess
 * with a corrected-FSC table. The t951 deep mint grew that variable (the
 * chain select2d → initialmodel → refine3d → maskcreate → postprocess,
 * the record speaks FSC(0.143) = 7.79 Å off the box floor 2.2×angpix);
 * THIS script rides the face on the mint's own record:
 *
 *   E1  THE DOOR — the postprocess inspector's ShieldCheck appears (the
 *       door's own fetch answers source=postprocess), click-until-effect
 *       opens the dialog; the motioncorr inspector carries NO door (the
 *       door guards itself off the postprocess faces).
 *   E2  THE SCREEN FACE — the ladder (unmasked / official (corrected) /
 *       raw mask (uncorrected) / box edge 7.1 Å), the word chip (one of
 *       the five legal words, its detail carrying the route's official
 *       Å), the B-factor weather (the stub's −62.4 → "strong"), the
 *       bands census, the verbless footer.
 *   E3  THE PAPER (agent-browser pdf, the t946 transport) — the
 *       provenance line ("printed …") reaches the paper, the title signs
 *       the run, the ladder + word + weather + bands + footer all reach
 *       the paper, the inspector's masthead prints NO byte, one sheet.
 *   E4  THE SCREEN KEEPS ITS DOORS — the provenance line display:none on
 *       screen, the close X display:block (the hide is print-scoped),
 *       overX 0.
 *   E5  THE RESTORE — the mint's remove verb (downstream-first deletes,
 *       both-side sweep), the world back to the seed trio, the doctor
 *       CLEAN.
 *
 * Ride laws inherited: born-at-band (t910); click-until-effect on every
 * door (t917); the palette as the deterministic inspector lever with the
 * QUOTED name (t946's spaced-name law); the API plane retries through
 * the dev server's recompile windows (t946's third ride); a >10-min ride
 * runs FOREGROUND with output redirected (the standing law — this ride
 * is minutes, but the redirect habit holds).
 *
 *   node scripts/t951-verdict-paper-witness.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const AB = "agent-browser";
const MANIFEST = path.join(ROOT, "data", "t951-fsc-deep-mint.json");
const RECEIPT = path.join(ROOT, "shots-qa", "t951-verdict-paper-witness.json");
const PP_NAME = "t951 postprocess witness";

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim(); }
  catch (e) { return `ERR:${String(e.message).slice(0, 200)}`; }
};
const evalJs = (expr) => sh(`${AB} eval "${expr.replace(/"/g, '\\"')}"`);
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
const ORIGIN = `-H "Origin: ${BASE}"`;
const api = (method, url, body) => {
  for (let i = 0; i < 6; i++) {
    let out = null;
    try {
      out = execSync(`curl -s -X ${method} ${ORIGIN} -H "Content-Type: application/json" ${body ? `-d '${JSON.stringify(body)}'` : ""} "${BASE}${url}"`, { encoding: "utf8", timeout: 60_000 });
    } catch { sleep(2500); continue; }
    try { return JSON.parse(out); } catch {
      if (out && out.length > 0) return { error: out.slice(0, 200) };
      sleep(2500); continue;
    }
  }
  return { error: "the route never answered through six windows" };
};
const jobsApi = () => api("GET", "/api/jobs").jobs ?? [];
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width === 0 || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return JSON.stringify({ off: true }); const pts = [[r.x + r.width / 2, r.y + r.height / 2]]; for (const ins of [1, 2, 6, 14, 26]) { pts.push([r.x + ins, r.y + ins], [r.x + r.width - ins, r.y + ins], [r.x + ins, r.y + r.height - ins], [r.x + r.width - ins, r.y + r.height - ins], [r.x + r.width / 2, r.y + ins], [r.x + r.width / 2, r.y + r.height - ins], [r.x + ins, r.y + r.height / 2], [r.x + r.width - ins, r.y + r.height / 2]); } for (const [px, py] of pts) { const cx = Math.max(2, Math.min(window.innerWidth - 2, Math.round(px))); const cy = Math.max(2, Math.min(window.innerHeight - 2, Math.round(py))); const hit = document.elementFromPoint(cx, cy); if (hit && el.contains(hit)) return JSON.stringify({ own: true, x: cx, y: cy }); } return JSON.stringify({ own: false }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") { await sleep(400); continue; }
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
const closeAllDialogs = async () => {
  for (let i = 0; i < 4; i++) {
    const n = evalJson(`JSON.stringify({ n: document.querySelectorAll('[role="dialog"]').length })`);
    if ((n?.n ?? 0) === 0) return i;
    sh(`${AB} press Escape`);
    await sleep(450);
  }
  return 4;
};
const openInspectorByPalette = async (name) => {
  await closeAllDialogs();
  sh(`${AB} press Control+k`);
  await sleep(600);
  // the name is QUOTED — a spaced name unquoted is shell-split and the
  // type command types only the first token (the t946 first ride's law)
  sh(`${AB} keyboard type "${name}"`);
  await sleep(800);
  const rows = await poll(
    `JSON.stringify({ n: document.querySelectorAll('[cmdk-item]').length, hit: [...document.querySelectorAll('[cmdk-item]')].some(i => ((i.getAttribute('value') || '') + (i.textContent || '')).includes('${name.slice(0, 30)}')) })`,
    (v) => v.hit === true, 8, 400
  );
  if (rows?.hit !== true) { await closeAllDialogs(); return false; }
  sh(`${AB} press Enter`);
  const opened = await poll(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => (d.textContent || '').includes('${name.slice(0, 30)}')); return JSON.stringify({ open: !!d }); })()`,
    (v) => v.open === true, 20, 500
  );
  return opened?.open === true;
};
const paperOf = async (pdfOut) => {
  const rendered = sh(`${AB} pdf ${pdfOut}`);
  if (!existsSync(pdfOut)) return { ok: false, flat: "", pages: 0, rendered };
  const flat = execSync(`pdftotext ${pdfOut} -`, { encoding: "utf8" }).replace(/\s+/g, " ");
  let pages = 0;
  try {
    const info = execSync(`pdfinfo ${pdfOut}`, { encoding: "utf8" });
    pages = Number((info.match(/Pages:\s+(\d+)/) ?? [])[1] ?? 0);
  } catch { /* pdfinfo missing — the page count pin rides pdftotext alone */ }
  return { ok: true, flat, pages, rendered };
};

// ---- guards: the dev server warm, the mint alive --------------------------
for (let i = 0; i < 40; i++) {
  try {
    if (execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE}/ --max-time 5`, { encoding: "utf8" }).includes("200")) break;
  } catch { /* cold — keep waiting */ }
  await sleep(1500);
}
const list0 = jobsApi();
ok("guard: the world answers", Array.isArray(list0), `${list0.length} jobs`);
let ppJob = list0.find((j) => j.name === PP_NAME && j.status === "completed");
let mintedHere = false;
if (!ppJob) {
  console.log("== the deep mint is not alive — minting it (the mint's own verb) ==");
  const mintOut = sh(`node scripts/t951-fsc-deep-mint.mjs mint`);
  console.log(mintOut.split("\n").filter((l) => l.startsWith("==") || l.startsWith("  manifest")).join("\n"));
  mintedHere = true;
  ppJob = jobsApi().find((j) => j.name === PP_NAME && j.status === "completed");
}
ok("guard: the mint's postprocess alive and completed", !!ppJob, ppJob?.id?.slice(-8));
if (!ppJob) { console.log("FATAL: no postprocess witness — cannot ride"); process.exit(2); }
if (!existsSync(MANIFEST)) { console.log("FATAL: no t951 manifest after the mint attempt"); process.exit(2); }
const mint = JSON.parse(readFileSync(MANIFEST, "utf8"));

// the route's own bytes are the face's expected numbers (measure the law,
// never the author's memory — the t915 lesson)
const fsc = api("GET", `/api/jobs/${ppJob.id}/fsc`);
ok("guard: the fsc route speaks postprocess", fsc.source === "postprocess", `shells=${fsc.shells?.length}`);
const officialA = fsc.postprocessGeneral?.finalResolution != null
  ? fsc.postprocessGeneral.finalResolution.toFixed(1)
  : null;
const angpix = fsc.postprocessGeneral?.angpix ?? null;
const boxEdgeA = angpix != null ? (2 * angpix).toFixed(1) : null;
ok("guard: the route's trio derives the ladder's numbers", officialA != null && boxEdgeA != null,
  `official=${officialA} Å · box edge=${boxEdgeA} Å`);

// the binding's shape is the world's standing law — untouched through the
// arc. The REGISTRY binding is the law's seat (the t916 remove's law): the
// job's own runRemote dies with the job, so it cannot answer after the
// remove — the first ride's lesson.
const regBinding = () => {
  try {
    const reg = JSON.parse(readFileSync(path.join(ROOT, "data", "projects.json"), "utf8"));
    return reg.projects?.[reg.active]?.remote?.connectionId ?? null;
  } catch { return null; }
};
const binding0 = regBinding();

// ---- the browser ride ------------------------------------------------------
await closeAllDialogs();
for (let i = 0; i < 10; i++) {
  try { sh(`${AB} open ${BASE}/`); break; }
  catch { await sleep(3000); }
}
await poll(`JSON.stringify({ cards: document.querySelectorAll('[data-job]').length })`, (g) => g.cards >= 3, 30);

// E1 — THE NEGATIVE FIRST: a non-postprocess inspector carries no door
const mcOpened = await openInspectorByPalette("Motion Correction 1");
ok("E1 the motioncorr inspector opened (the negative's seat)", mcOpened === true);
const noDoor = await poll(
  `JSON.stringify({ n: [...document.querySelectorAll('[role="dialog"] button')].filter(b => (b.getAttribute('aria-label') || '').startsWith('Final verdict — read what the mask bought')).length })`,
  (v) => v.n === 0, 6, 400
);
ok("E1 the door hides off the postprocess faces (the door guards itself)", noDoor?.n === 0, `found ${noDoor?.n}`);
await closeAllDialogs();

// E1 — THE DOOR on the postprocess inspector: click-until-effect
let doorOpen = "NEVER-OPEN";
for (let i = 0; i < 5; i++) {
  const viaPalette = await openInspectorByPalette(PP_NAME);
  if (!viaPalette) console.log("      [palette missed — retrying]");
  const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(x => (x.textContent || '').includes('${PP_NAME.slice(0, 20)}')); return d ? [...d.querySelectorAll('button')].find(x => (x.getAttribute('aria-label') || '').startsWith('Final verdict — read what the mask bought')) : null; })()`);
  const opened = await poll(
    // the family hook RIDES the dialog node itself — a querySelector for
    // the hook inside a role=dialog searches descendants only and never
    // matches (the first ride's lesson: the face is the dialog)
    `JSON.stringify({ open: document.querySelector('[role="dialog"][data-family-read-dialog]') != null })`,
    (v) => v.open === true, 8, 500
  );
  if (opened?.open === true) { doorOpen = `open@try${i + 1} (click ${clicked}${viaPalette ? ", palette" : ""})`; break; }
  await closeAllDialogs();
}
ok("E1 the verdict dialog OPEN (click-until-effect)", String(doorOpen).startsWith("open@"), doorOpen);

// E2 — THE SCREEN FACE
const face = await poll(`(() => { const d = [...document.querySelectorAll('[data-family-read-dialog]')].find(x => (x.textContent || '').includes('Final verdict')); if (!d) return null; return JSON.stringify({ title: (d.querySelector('[data-slot="dialog-title"]')?.textContent || '').trim(), region: d.querySelector('[role="region"]')?.getAttribute('aria-label') || '', text: d.textContent || '' }); })()`, (v) => v && v.text.length > 100, 10, 500);
ok("E2 the face's region carries the family aria", (face?.region ?? "").includes("three curves, three crossings, one box edge"), face?.region ?? "none");
ok("E2 the title signs the run", (face?.title ?? "").includes(`Final verdict — ${PP_NAME}`), face?.title ?? "none");
ok("E2 the ladder's official marker", (face?.text ?? "").includes("official (corrected)"));
ok("E2 the ladder's unmasked marker", (face?.text ?? "").includes("unmasked"));
ok("E2 the ladder's raw-mask marker", (face?.text ?? "").includes("raw mask (uncorrected)"));
ok("E2 the official value speaks the route's word", officialA != null && (face?.text ?? "").includes(`${officialA} Å`), `${officialA} Å`);
ok("E2 the box edge speaks 2×angpix", boxEdgeA != null && (face?.text ?? "").includes(`box edge ${boxEdgeA} Å`), `box edge ${boxEdgeA} Å`);
const LEGAL_WORDS = ["honest", "modest gift", "generous gift", "mask-carried", "beyond the box"];
const chip = (face?.text ?? "").match(/\b(honest|modest gift|generous gift|mask-carried|beyond the box)\b/);
ok("E2 the word chip carries a legal word", !!chip && LEGAL_WORDS.includes(chip[1]), chip?.[1] ?? "none");
const WORD = chip?.[1] ?? "";
ok("E2 the word's detail carries the official Å", WORD !== "" && officialA != null && (face?.text ?? "").includes(officialA));
ok("E2 the B-factor weather speaks (the stub's −62.4 → strong)", (face?.text ?? "").includes("B-factor strong"), (face?.text ?? "").match(/B-factor \w+/)?.[0] ?? "none");
ok("E2 the bands census reaches the screen", (face?.text ?? "").includes("The gift law:"));
ok("E2 the verbless footer (the reading points at the dial)", (face?.text ?? "").includes("The verdict reads; it does not mutate"));
ok("E2 no verb row (the face reads, it does not mutate)", !(face?.text ?? "").includes("Continue"));

// E4 — THE SCREEN KEEPS ITS DOORS (before the paper: the print-scoped hide)
const doors = evalJson(`(() => { const d = [...document.querySelectorAll('[data-family-read-dialog]')].find(x => (x.textContent || '').includes('Final verdict')); if (!d) return null; const doc = d.querySelector('[data-family-read-print-doc]'); const x = d.querySelector('[data-slot="dialog-close"]'); return JSON.stringify({ docHide: doc ? getComputedStyle(doc).display === 'none' : null, xShow: x ? getComputedStyle(x).display !== 'none' : null }); })()`);
ok("E4 the provenance line display:none on screen", doors?.docHide === true);
ok("E4 the close X display:block on screen", doors?.xShow === true);
const overX = evalJson(`JSON.stringify({ overX: document.documentElement.scrollWidth - document.documentElement.clientWidth })`);
ok("E4 the screen keeps overX 0", overX?.overX === 0, String(overX?.overX));

// E3 — THE PAPER
const p1 = await paperOf("/tmp/t951-verdict-print.pdf");
ok("E3 the pdf rendered through the print pipeline", p1.ok, String(p1.rendered).slice(0, 60));
ok("E3 one document, one sheet", p1.pages === 1, `pages=${p1.pages}`);
ok("E3 the provenance line reaches the paper (the paper's clock)", p1.flat.includes("printed "));
ok("E3 the title signs the run on paper", p1.flat.includes(`Final verdict — ${PP_NAME}`));
ok("E3 the ladder reaches the paper", p1.flat.includes("official (corrected)") && p1.flat.includes("raw mask (uncorrected)"));
ok("E3 the box edge reaches the paper", p1.flat.includes(`box edge ${boxEdgeA} Å`));
ok("E3 the word reaches the paper (screen word = paper word)", WORD !== "" && p1.flat.includes(WORD));
ok("E3 the weather reaches the paper", p1.flat.includes("B-factor strong"));
ok("E3 the bands census reaches the paper", p1.flat.includes("The gift law:"));
ok("E3 the verbless footer reaches the paper", p1.flat.includes("The verdict reads; it does not mutate"));
ok("E3 + R5 the inspector's masthead prints no byte", !p1.flat.includes("CryoFlow — job report"));
ok("E3 the face's description reaches the paper (the honesty read)", p1.flat.includes("phase-randomization"));

// E5 — THE RESTORE
await closeAllDialogs();
const removeOut = sh(`node scripts/t951-fsc-deep-mint.mjs remove`);
console.log(removeOut.split("\n").filter((l) => l.startsWith("==") || l.startsWith("  rm") || l.includes("✗")).join("\n"));
ok("E5 the remove GREEN", /== remove GREEN — \d+ ok, 0 fail ==/.test(removeOut));
const after = jobsApi();
ok("E5 the world back to the seed trio", after.length === mint.preJobs, `${after.length} vs ${mint.preJobs}`);
ok("E5 no t951 residue", after.every((j) => !(j.name ?? "").includes("t951")));
ok("E5 the registry binding untouched", regBinding() === binding0, `binding=${regBinding()}`);
const doctor = sh(`unset DATABASE_URL; node scripts/t894-window-start-sweep.mjs 2>&1 | tail -1`);
ok("E5 the doctor CLEAN", /VERDICT: CLEAN/.test(doctor), doctor.slice(0, 80));

// the receipt
try { writeFileSync(RECEIPT, JSON.stringify({
  instrument: "t951-verdict-paper-witness", pass, fail, at: new Date().toISOString(),
  mintedHere, doorOpen, word: WORD, officialA, boxEdgeA, shells: fsc.shells?.length,
  paper: { pages: p1.pages }, mintPreJobs: mint.preJobs,
}, null, 2)); } catch {}
console.log(`\nVERDICT-PAPER-WITNESS t951: ${pass}/${pass + fail} ${fail === 0 ? "GREEN — the family's last unwitnessed sheet witnessed" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
