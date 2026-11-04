#!/usr/bin/env node
/**
 * t909 — the keyboard verbs' LIVE witness: the t908 unit pinned the laws
 * where they live (source-asserted); this instrument watches the block
 * OBEY them in a running page.
 *
 * THE DOOR HAD TO BE MINTED — and it had to FOLLOW the inspector. Two
 * world facts shaped the ride:
 *
 *   1. The denoised maps are 2D micrographs (dims [64,64,1]) and the
 *      oblique block's frame builder REFUSES any dim ≤ 1 (`dims.some(d
 *      => !(d>1)) → null` — a plane through a 2D image is an honest
 *      void). One synthetic 3D volume (28³ real MRC, the
 *      demo-chain-resurrect header law) named `t909-volume_denoised.mrc`
 *      opens the door: the `_denoised.mrc` classification opens the row,
 *      the header's nz=28 opens the BLOCK.
 *   2. The canvas cards STACK and their z-order SHIFTS under the live
 *      poll — the world carries TWELVE topazdenoise witness cards
 *      (t894 ×1, t898 ×3, t899 ×8), a hit-test-clean probe says "own"
 *      and by click time another card is on top. So the mint does not
 *      presume the card: the ride clicks ANY hit-test-clean card, reads
 *      the inspector's own workdir line (the absolute path the header
 *      displays next to the copy button), and MINTS INTO THAT WORKDIR —
 *      then Refresh outputs makes the gallery honest. The card that
 *      opens is the card that rides.
 *
 * The mint is removed and its absence VERIFIED in the crash-safe finally
 * (the t902 seeding discipline: the door closes behind the witness, file
 * lists restored byte-for-byte).
 *
 * Then the verbs, one window wire (cryoflow:oblique-verb), the block's
 * own faces as the jury:
 *
 *   W4  born ASLEEP (data-oblique-state=off)
 *   K1  jump refused asleep           (the ,/. law — no spooky jumps)
 *   K2  offset refused asleep         (an invisible plane must not move)
 *   K3  adopt wakes BY CAMERA         (state on + ⤸ provenance + violet
 *                                       flash within FOLLOW_FLASH_MS=650)
 *   K4  jump awake → ⌖, the SAME      (the ⌖ faces the plane the camera
 *       θ·φ the ⤸ chip speaks          adopted — one frame, never stale)
 *   K5  offset fine  = +2             (the slider's own 2%)
 *   K6  offset coarse = +10           (shift : " = the coarser 10%)
 *   K7  offset coarse −10             (dir rides; coarse is the step law)
 *   K8/K9 the clamps at ±100         (the slider's own [−100,100])
 *   K10 back to 0 exactly            (10 coarse steps, arithmetic honest)
 *   K11 cut → the ✂ chip             (the embed's mirror LIVE: the chip
 *                                      speaks the block's θ/φ/offset)
 *   K12 the standing door renders    (img[src*="plane=oblique"] — the
 *                                      minted volume renders the cut)
 *   K13 the × retires, the block     (the ACK follows the block's face;
 *       stays alive                   a scrub after the retire still moves)
 *
 * Usage: node scripts/t909-keyboard-verbs-witness.mjs  (dev server :3000)
 */
import { execSync } from "node:child_process";
import { writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const ORIGIN = "http://localhost:3000";
const AB = "agent-browser";
const RECEIPT = "shots-qa/t909-keyboard-verbs-witness.json";
const MAP = "t909-volume_denoised.mrc"; // the minted 28³ volume — removed in the finally
const VERB = "cryoflow:oblique-verb"; // OBLIQUE_VERB_EVENT — map-ortho-panel.tsx:145
const BLOCK = '[data-canvas-ui="ortho-oblique"]';
const PROV = '[data-canvas-ui="ortho-oblique-prov"]';
const SLIDER = '[aria-label="Signed offset of the plane along its normal"]';
const CHIP = '[data-testid="clip-oblique-chip"]';

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`);
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) =>
  execSync(cmd, { encoding: "utf8", timeout: 120_000, cwd: ROOT }).trim();
const api = (path) =>
  JSON.parse(sh(`curl -s -H "Origin: ${ORIGIN}" "${BASE}${path}"`));
// the t899 parse-twice law: the CLI's eval output is a JSON-quoted string;
// one parse yields the page's own output (itself JSON), the second the value
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim();
const evalJson = (expr) => {
  let out = evalJs(expr);
  try {
    // the CLI can prepend a log line under rapid-fire calls — parse from
    // the first quote onward (the payload is always a JSON-quoted string)
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") {
      try { return JSON.parse(once); } catch { return once; }
    }
    return once;
  } catch {
    return out;
  }
};
// coordinate click with the scroll-UNTIL-VISIBLE walk (the qa64 realClick
// pattern, hardened twice: one 250px nudge left the tile at y=1320 in a
// 577-innerHeight viewport — the mouse event landed nowhere; and the
// image dialog's View-in-3D container is an ANONYMOUS overflow-y-auto
// (no testid, no id) — the CDP scroll can't address it, so the walk
// scrollIntoViews the element itself and re-probes before clicking)
const realClick = async (findExpr) => {
  const locate = `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); const vis = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth; return JSON.stringify({ vis, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`;
  for (let i = 0; i < 12; i++) {
    const pos = evalJson(locate);
    if (!pos || pos === "null") return "NO-ELEMENT";
    if (pos.vis) {
      sh(`${AB} mouse move ${pos.x} ${pos.y}`);
      sh(`${AB} mouse down`);
      sh(`${AB} mouse up`);
      return `clicked@${pos.x},${pos.y}`;
    }
    // named container first (the CDP scroll), then the honest fallback:
    // scrollIntoView on the element itself (Radix scroll-locks the BODY,
    // never the dialog's own overflow containers)
    const named = evalJson(`(() => { const el = (${findExpr}); if (!el) return null; let p = el.parentElement, c = null; while (p) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight) { c = p; break; } p = p.parentElement; } if (!c) return null; const tid = c.getAttribute('data-testid'); return JSON.stringify({ sel: tid ? '[data-testid=' + tid + ']' : (c.id ? '#' + c.id : null), down: el.getBoundingClientRect().top > c.getBoundingClientRect().top }); })()`);
    if (named?.sel) {
      sh(`${AB} scroll ${named.down === false ? "up" : "down"} 400 -s "${named.sel}"`);
    } else {
      evalJs(`(() => { const el = (${findExpr}); if (el) el.scrollIntoView({ block: 'center', behavior: 'instant' }); return 'siv'; })()`);
    }
    await sleep(220);
  }
  return "NEVER-VISIBLE";
};
// the verb dispatcher — ONE wire, the embed's own language
const verb = (detail) =>
  evalJs(`window.dispatchEvent(new CustomEvent(${JSON.stringify(VERB)}, { detail: ${JSON.stringify(detail)} })); 'sent'`);
// the block's state read — one eval, the whole face. Two DOM traps the
// live ride taught: (1) the aria-label lands on the Radix Slider ROOT
// (a span with NO aria-valuenow) — the THUMB is [role=slider] and only
// it speaks the value; (2) class selectors match WHOLE tokens — the
// tile's `transition-[border-color,box-shadow]` token can never be
// matched by a `.transition-\[border-color` prefix — an attribute
// contains-selector is the honest match.
const blockFace = () => {
  const f = evalJson(`(() => { const b = document.querySelector(${JSON.stringify(BLOCK)}); if (!b) return null; const tile = b.querySelector('[class*="transition-[border-color"]'); const prov = b.querySelector(${JSON.stringify(PROV)}); const sl = document.querySelector('[role="slider"]' + ${JSON.stringify(SLIDER)}); const img = b.querySelector('img'); return JSON.stringify({ state: b.getAttribute('data-oblique-state'), flash: !!tile && /border-violet-500\\/70/.test(tile.className), prov: prov ? prov.textContent.trim() : null, offset: sl ? sl.getAttribute('aria-valuenow') : null, obImg: img ? (img.getAttribute('src') || '').slice(0, 120) : null }); })()`);
  if (f && typeof f === "object") return f;
  // one retry — a transient CLI blip under the render storm must not
  // cost an arm its evidence (the raw junk, if it persists, is the
  // page's own error and the arm will fail on it honestly)
  return evalJson(`(() => { const b = document.querySelector(${JSON.stringify(BLOCK)}); if (!b) return null; const tile = b.querySelector('[class*="transition-[border-color"]'); const prov = b.querySelector(${JSON.stringify(PROV)}); const sl = document.querySelector('[role="slider"]' + ${JSON.stringify(SLIDER)}); const img = b.querySelector('img'); return JSON.stringify({ state: b.getAttribute('data-oblique-state'), flash: !!tile && /border-violet-500\\/70/.test(tile.className), prov: prov ? prov.textContent.trim() : null, offset: sl ? sl.getAttribute('aria-valuenow') : null, obImg: img ? (img.getAttribute('src') || '').slice(0, 120) : null }); })()`);
};

/* ------------------------------------------------------------------ */
/* the mint kit — ONE volume, bytes built once, moved to wherever the   */
/* inspector opens; the trail owns every workdir it touched             */
/* ------------------------------------------------------------------ */
const N = 28;
const mintBuf = (() => {
  const floats = new Float32Array(N * N * N);
  for (let z = 0; z < N; z++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const d2 = (x - (N - 1) / 2) ** 2 + (y - (N - 1) / 2) ** 2 + (z - (N - 1) / 2) ** 2;
        floats[z * N * N + y * N + x] = Math.fround(Math.exp(-d2 / (2 * 36)) + 0.02);
      }
  const header = Buffer.alloc(1024);
  header.writeInt32LE(N, 0); header.writeInt32LE(N, 4); header.writeInt32LE(N, 8);
  header.writeInt32LE(2, 12); // MODE float32
  header.writeInt32LE(0, 16); header.writeInt32LE(0, 20); header.writeInt32LE(0, 24);
  header.writeInt32LE(N, 28); header.writeInt32LE(N, 32); header.writeInt32LE(N, 36);
  header.writeFloatLE(N, 40); header.writeFloatLE(N, 44); header.writeFloatLE(N, 48);
  header.writeFloatLE(90, 52); header.writeFloatLE(90, 56); header.writeFloatLE(90, 60);
  header.writeInt32LE(1, 64); header.writeInt32LE(2, 68); header.writeInt32LE(3, 72);
  header.writeFloatLE(0, 76); header.writeFloatLE(1, 80); header.writeFloatLE(0.05, 84);
  header.writeInt32LE(1, 88); // ISPG 1 = volume
  header.writeInt32LE(0, 92);
  header.write("MAP ", 208, "ascii");
  header.writeInt32LE(0x00004144, 212);
  header.writeFloatLE(0.1, 216);
  header.writeInt32LE(1, 220);
  header.write("t909 keyboard verbs witness synthetic volume", 224, "utf8");
  return Buffer.concat([header, Buffer.from(floats.buffer)]);
})();
// the trail: every { workdir, file, pre } this instrument minted into —
// the crash-safe finally walks it backwards, removing and VERIFYING
const mintTrail = []; // { workdir, pre }
let mintedAt = null; // the absolute path currently holding the mint

const mintInto = (workdir) => {
  const target = join(workdir, MAP);
  if (mintedAt === target && existsSync(target)) return target;
  if (mintedAt && mintedAt !== target) {
    try { rmSync(mintedAt, { force: true }); } catch {}
    mintedAt = null;
  }
  if (!mintTrail.some((t) => t.workdir === workdir)) {
    mintTrail.push({ workdir, pre: readdirSync(workdir).sort().join(",") });
  }
  writeFileSync(target, mintBuf);
  mintedAt = target;
  return target;
};

let browserUp = false;
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  console.log("\n  cleanup (crash-safe finally)…");
  if (browserUp) {
    try { sh(`${AB} press Escape`); } catch {}
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(600);
    try { sh(`${AB} close`); browserUp = false; console.log("  cleanup: browser closed"); } catch {}
  }
  // the trail, backwards: remove the mint, VERIFY the absence, compare
  // each touched workdir's list to its pre-state (byte-for-byte)
  for (let i = mintTrail.length - 1; i >= 0; i--) {
    const t = mintTrail[i];
    const f = join(t.workdir, MAP);
    try { rmSync(f, { force: true }); } catch {}
    const gone = !existsSync(f);
    let listOk = false;
    try { listOk = readdirSync(t.workdir).sort().join(",") === t.pre; } catch {}
    console.log(`  cleanup: ${t.workdir.split("/").pop()} — mint ${gone ? "removed and VERIFIED absent" : "STILL PRESENT"}, list ${listOk ? "== pre-state" : "DIFFERS"}`);
  }
}

/* ------------------------------------------------------------------ */
/* P — the mint's own receipt (node-side, before any browser)           */
/* ------------------------------------------------------------------ */
console.log("\n  P — the mint kit…");
ok("P0 the mint is a real MRC volume (MAP word, ISPG 1, 28³ float32)", mintBuf.length === 1024 + N * N * N * 4 && mintBuf.slice(208, 212).toString("ascii") === "MAP " && mintBuf.readInt32LE(88) === 1, `${mintBuf.length}B`);
ok("P0a the name opens the classification row (_denoised.mrc)", /_denoised\.mrc$/.test(MAP), MAP);

/* ------------------------------------------------------------------ */
/* W — the ride: card (any clean one) → inspector → mint follows →      */
/*     refresh → tile → 3D dialog                                       */
/* ------------------------------------------------------------------ */
let jobWorkdir = null; // the ABSOLUTE workdir the inspector displays
try {
  sh(`${AB} open ${BASE}/`);
  browserUp = true;
  await sleep(3000);

  // W0 — click ANY hit-test-clean card; the inspector's workdir line
  // names the job that actually opened (the stack shifts under the poll;
  // the card that opens is the card that rides). Accept only a
  // topazdenoise workdir (the mint's classification lives there).
  for (let round = 0; round < 8 && !jobWorkdir; round++) {
    const cands = evalJson(`(() => { const out = []; for (const card of document.querySelectorAll('[data-job]')) { const btn = card.querySelector('[role="button"][tabindex]'); if (!btn) continue; const r = btn.getBoundingClientRect(); if (r.width === 0) continue; const cx = Math.round(r.x + r.width / 2), cy = Math.round(r.y + r.height / 2); const hit = document.elementFromPoint(cx, cy); if (hit && btn.contains(hit)) out.push({ cx, cy }); } return JSON.stringify(out.slice(0, 3)); })()`);
    if (!Array.isArray(cands) || cands.length === 0) { await sleep(1200); continue; }
    const pick = cands[round % cands.length];
    sh(`${AB} mouse move ${pick.cx} ${pick.cy}`);
    sh(`${AB} mouse down`);
    sh(`${AB} mouse up`);
    await sleep(2800);
    const wd = evalJson(`(() => { const d = document.querySelector('[role="dialog"]'); if (!d) return null; const el = [...d.querySelectorAll('span,code,div')].find(e => /data\\/relion\\/.+topazdenoise_/.test(e.textContent || '') && (e.textContent || '').length < 200); return el ? el.textContent.trim() : null; })()`);
    if (wd && /topazdenoise_/.test(wd)) {
      jobWorkdir = wd;
      ok(`W0 the inspector opened (round ${round + 1}) and names its workdir`, true, wd.split("/").pop());
    } else {
      // wrong family or no dialog — peel politely, try another card
      try { sh(`${AB} press Escape`); } catch {}
      await sleep(900);
    }
  }
  ok("W0a a topazdenoise inspector is open", !!jobWorkdir, jobWorkdir ?? "no clean card opened one in 8 rounds");
  if (!jobWorkdir) throw new Error("no topazdenoise inspector — the ride is void");

  // W0b — the mint follows the inspector; Refresh outputs makes the
  // gallery honest about the new file
  mintInto(jobWorkdir);
  const refresh = await realClick(`document.querySelector('[aria-label="Refresh outputs"]')`);
  ok("W0b the mint moved in + Refresh outputs clicked", String(refresh).startsWith("clicked@") || refresh === "NO-ELEMENT", `refresh=${refresh} (NO-ELEMENT tolerable — the dialog's own open may have re-fetched)`);

  // W1 — the volume's tile in the maps gallery
  let tileClick = "NO-ELEMENT";
  for (let i = 0; i < 10 && tileClick === "NO-ELEMENT"; i++) {
    tileClick = await realClick(`document.querySelector('[data-tile-path="${MAP}"]')`);
    if (tileClick === "NO-ELEMENT") await sleep(1000);
  }
  ok("W1 the volume tile clicked (image dialog opens)", String(tileClick).startsWith("clicked@"), tileClick);
  await sleep(2200); // the central slice renders

  // W2 — View in 3D (Mol*) — the teal relay into the viewer dialog
  let v3d = "NO-ELEMENT";
  for (let i = 0; i < 10 && v3d === "NO-ELEMENT"; i++) {
    v3d = await realClick(`[...document.querySelectorAll('button')].find((b) => /View in 3D \\(Mol\\*\\)/.test(b.textContent || ''))`);
    if (v3d === "NO-ELEMENT") await sleep(1000);
  }
  ok("W2 View in 3D (Mol*) clicked", String(v3d).startsWith("clicked@"), v3d);

  // W2a — the strip is born COLLAPSED (map-ortho-panel.tsx:815
  // `useState(false)`): the tiles and the oblique block render only
  // inside `open && !isStack && dims` — expand it, then the block exists
  let strip = "NO-ELEMENT";
  for (let i = 0; i < 8 && strip === "NO-ELEMENT"; i++) {
    strip = await realClick(`document.querySelector('[data-canvas-ui="ortho-panel"] button[aria-expanded]')`);
    if (strip === "NO-ELEMENT") await sleep(1000);
  }
  ok("W2a the slice strip expanded (the panel's own toggle)", String(strip).startsWith("clicked@"), strip);

  // W3/W4 — the block mounts ASLEEP (dims [28,28,28] pass the frame law)
  let face = null;
  for (let i = 0; i < 20 && !face; i++) {
    await sleep(1500);
    face = await blockFace();
  }
  ok("W3 the oblique block mounted", !!face, face ? JSON.stringify(face).slice(0, 140) : "no [data-canvas-ui=ortho-oblique] in 30s");
  ok("W4 the block is born ASLEEP (data-oblique-state=off)", face?.state === "off", `state=${face?.state}`);
  if (!face) throw new Error("the block never mounted — the ride is void, the K arms would all lie");
  // molstar readiness needs no preamble: the K3 poll IS the wait — the
  // embed answers the camera request only when canvas3d.camera exists,
  // and every dispatch before that is an honest no-op.

  /* ---------------------------------------------------------------- */
  /* K — the verbs, one wire, the block's own faces as the jury        */
  /* ---------------------------------------------------------------- */
  console.log("\n  K — the verbs ride…");

  // K1 — jump refused asleep
  await verb({ verb: "jump" });
  await sleep(400);
  let f1 = await blockFace();
  ok("K1 jump REFUSED asleep (the ,/. law)", f1?.state === "off" && !f1?.prov, `state=${f1?.state} prov=${f1?.prov}`);

  // K2 — offset refused asleep
  await verb({ verb: "offset", dir: 1 });
  await sleep(400);
  let f2 = await blockFace();
  ok("K2 offset REFUSED asleep (an invisible plane must not move)", f2?.state === "off" && f2?.offset === null, `state=${f2?.state} offset=${f2?.offset}`);

  // K3 — adopt wakes BY CAMERA (the poll IS the molstar readiness wait:
  // the embed answers only when canvas3d.camera exists; each dispatch
  // before that is an honest no-op. The 250ms read lands INSIDE the
  // 650ms flash window — the violet border is still lit when the face
  // is read; at 700ms the flash would already be gone)
  let adopted = null;
  for (let i = 0; i < 40 && !(adopted && adopted.state === "on"); i++) {
    await verb({ verb: "adopt" });
    await sleep(250);
    adopted = await blockFace();
  }
  ok("K3 adopt WAKES BY CAMERA (state on)", adopted?.state === "on", `state=${adopted?.state} after the poll`);
  ok("K3a the ⤸ provenance speaks the adopted angles", !!adopted?.prov && adopted.prov.startsWith("⤸"), `prov="${adopted?.prov}"`);
  ok("K3b the tile flashed violet (FOLLOW_FLASH_MS window)", adopted?.flash === true, "border-violet-500/70 seen");

  // K4 — jump awake: ⌖ with the SAME θ·φ the ⤸ chip spoke
  const angles = adopted?.prov?.replace("⤸", "").trim();
  await verb({ verb: "jump" });
  await sleep(400);
  let f4 = await blockFace();
  ok("K4 jump AWAKE → ⌖, the adopted frame's own angles", !!f4?.prov && f4.prov.startsWith("⌖") && f4.prov.includes(angles ?? "⟨never⟩"), `prov="${f4?.prov}" ⤸ said "${angles}"`);

  // K5 — the fine step: the slider's own 2%
  const base = Number(f4?.offset ?? 0);
  await verb({ verb: "offset", dir: 1 });
  await sleep(350);
  let f5 = await blockFace();
  ok("K5 offset fine = +2 (the slider's own 2%)", Number(f5?.offset) === base + 2, `${base} → ${f5?.offset}`);

  // K6 — the coarse step: shift : " = the coarser 10%
  await verb({ verb: "offset", dir: 1, coarse: true });
  await sleep(350);
  let f6 = await blockFace();
  ok("K6 offset coarse = +10 (shift is the COARSER step)", Number(f6?.offset) === base + 12, `${base + 2} → ${f6?.offset}`);

  // K7 — dir rides, coarse is the step law
  await verb({ verb: "offset", dir: -1, coarse: true });
  await sleep(350);
  let f7 = await blockFace();
  ok("K7 offset coarse − = −10", Number(f7?.offset) === base + 2, `${base + 12} → ${f7?.offset}`);

  // K8 — the +100 clamp: hammer past the ceiling
  for (let i = 0; i < 12; i++) { await verb({ verb: "offset", dir: 1, coarse: true }); await sleep(120); }
  await sleep(350);
  let f8 = await blockFace();
  ok("K8 the +100 clamp holds (the slider's own ceiling)", Number(f8?.offset) === 100, `→ ${f8?.offset}`);

  // K9 — the −100 clamp: hammer past the floor
  for (let i = 0; i < 22; i++) { await verb({ verb: "offset", dir: -1, coarse: true }); await sleep(120); }
  await sleep(350);
  let f9 = await blockFace();
  ok("K9 the −100 clamp holds (the slider's own floor)", Number(f9?.offset) === -100, `→ ${f9?.offset}`);

  // K10 — back to 0 exactly: 10 coarse steps, the arithmetic honest
  for (let i = 0; i < 10; i++) { await verb({ verb: "offset", dir: 1, coarse: true }); await sleep(120); }
  await sleep(350);
  let f10 = await blockFace();
  ok("K10 back to 0 exactly", Number(f10?.offset) === 0, `→ ${f10?.offset}`);
  ok("K10a the reads were real (offset never null while awake)", f5?.offset != null && f10?.offset != null, `f5=${f5?.offset} f10=${f10?.offset}`);

  // K11 — the ✂ verb: the cut out, the embed's mirror LIVE
  await verb({ verb: "cut" });
  await sleep(600);
  let chip = null;
  for (let i = 0; i < 10 && !chip; i++) {
    chip = evalJson(`(() => { const c = document.querySelector(${JSON.stringify(CHIP)}); if (!c) return null; const r = c.querySelector('[data-testid=clip-oblique-readout]'); return JSON.stringify({ on: c.getAttribute('data-clip-oblique'), readout: r ? r.textContent.trim() : null }); })()`);
    if (!chip) await sleep(600);
  }
  ok("K11 cut → the ✂ chip rides (the mirror is LIVE)", !!chip && chip.on === "on", chip ? `readout="${chip.readout}"` : "no clip-oblique-chip in 6s");
  ok("K11a the chip's readout speaks the block's plane (θ/φ + depth)", !!chip?.readout && /θ .*° · φ .*°/.test(chip.readout), chip?.readout ?? "");

  // K12 — the standing door renders the cut (the minted volume, the plane)
  let obImg = null;
  for (let i = 0; i < 24 && !obImg; i++) {
    const f = await blockFace();
    if (f?.obImg && f.obImg.includes("plane=oblique")) obImg = f.obImg;
    else await sleep(800);
  }
  ok("K12 the standing door renders the oblique cut (img src plane=oblique)", !!obImg, obImg ?? "no oblique img in ~19s");

  // K13 — the × retires; the block stays alive; a scrub still moves
  const clearClick = await realClick(`document.querySelector('[data-testid="clip-oblique-clear"]')`);
  ok("K13a the × clicked", String(clearClick).startsWith("clicked@"), clearClick);
  await sleep(600);
  let chipGone = null;
  for (let i = 0; i < 8 && chipGone === null; i++) {
    const still = evalJson(`(() => JSON.stringify({ chip: !!document.querySelector(${JSON.stringify(CHIP)}) }))()`);
    if (still?.chip === false) chipGone = true;
    else await sleep(500);
  }
  ok("K13b the × retires the cut (the chip vanishes)", chipGone === true);
  const pre13 = await blockFace();
  await verb({ verb: "offset", dir: 1 });
  await sleep(350);
  const post13 = await blockFace();
  ok("K13c the block stays alive after the retire (a scrub still moves)", Number(post13?.offset) === Number(pre13?.offset ?? 0) + 2 && post13?.state === "on", `${pre13?.offset} → ${post13?.offset}, state=${post13?.state}`);
  await verb({ verb: "offset", dir: -1 }); // polite return
} catch (e) {
  fail++;
  console.log(`  ✗ the ride threw: ${e.message?.slice(0, 200)}`);
} finally {
  await cleanup();
}

/* ------------------------------------------------------------------ */
/* P3 — the world restored (the trail walked, the lists byte-for-byte) */
/* ------------------------------------------------------------------ */
console.log("\n  P3 — the world's restore leg…");
let trailOk = true;
for (const t of mintTrail) {
  const f = join(t.workdir, MAP);
  if (existsSync(f)) trailOk = false;
  try {
    if (readdirSync(t.workdir).sort().join(",") !== t.pre) trailOk = false;
  } catch { trailOk = false; }
}
ok("P3 every workdir the mint touched is byte-for-byte pre-state", trailOk, `${mintTrail.length} workdir${mintTrail.length === 1 ? "" : "s"} on the trail`);
let afterRows = -1;
try {
  // the workdir line names topazdenoise_<id-tail>; resolve the FULL id
  // through the jobs list (the tail is not an id — the API would 404)
  const tail = jobWorkdir?.match(/topazdenoise_([a-z0-9]+)$/)?.[1];
  const jobs = api(`/api/jobs`);
  const list = Array.isArray(jobs) ? jobs : (jobs?.jobs ?? []);
  const job = list.find((j) => tail && j.id.endsWith(tail));
  const idx = api(`/api/jobs/${job?.id ?? "unknown"}/outputs`);
  afterRows = (idx?.files ?? []).filter((f) => /_denoised\.mrc$/i.test(f.name || "")).length;
} catch {}
ok("P3a the outputs index honestly closed (the 2D siblings remain)", afterRows >= 2, `${afterRows} denoised rows after the ride (no 28³ row among them — P3's file law owns that)`);

const receipt = {
  instrument: "t909-keyboard-verbs-witness",
  workdir: jobWorkdir,
  map: MAP,
  verbWire: VERB,
  pass,
  fail,
  at: new Date().toISOString(),
};
try { writeFileSync(`${ROOT}/${RECEIPT}`, JSON.stringify(receipt, null, 2)); } catch {}
console.log(`\nKEYBOARD-VERBS-WITNESS t909: ${pass}/${pass + fail} ${fail === 0 ? "green — the laws hold in a living page" : "RED"}`);
process.exit(fail === 0 ? 0 : 1);
