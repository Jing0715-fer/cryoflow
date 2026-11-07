#!/usr/bin/env node
/**
 * t877 — THE SAVED-VIEWS FAMILY'S PORT (the t876 map's debt cluster
 * t668-t671 gets its first LIVING host): four debt walks one collection —
 * the deep link (t668), the honest not-found + the wall delete (t669),
 * the palette row's X + the TTL cache (t670), the viewer's home mouth
 * (t671). The map's law was "the debt list is the port plan's input;
 * each debt walk's surfaces are the spec its future port must re-walk" —
 * this window the port is BORN, in the family idiom (the measure, the
 * census invariant, the drift ledger aboard from birth, the stamp).
 *
 * THE PORT REDREW THE DOORS (the current product's growth since the
 * walks were shadowed — each a law the old receipt never saw):
 *   • the wall's delete X grew a CONFIRM dialog (t793: "Delete saved
 *     view “X”?" — the question is cheap, the pose is gone forever) —
 *     the old X-click-shrinks shape is TWO doors now, and the walk rides
 *     BOTH (X -> the question -> "Delete view" -> the wall shrinks).
 *   • the collection is THREE mouths at EVERY surface (t674): the wall
 *     card carries pencil + X, the palette row carries pencil + X under
 *     a fading Mountain tail — the hover contract measured at both.
 *   • the delete teaches the after-state (t817: the toast's description
 *     speaks the remaining count; the focus relay lands the neighbour).
 *   • the viewer's shelf caps at 8 (the honest "The shelf is full").
 *
 * THE HOST IS MEASURED, NEVER PINNED: the gallery route answers, the
 * roster's bookmark-bearing job is READ from it (the old walks pinned
 * cmuwipe635000refine3d — the restore annihilated that world; the port
 * refuses pins). The trio (Centered iso view / Top-down slice / Front
 * half clipped) is the world's own seed truth — the walk snapshots its
 * EXACT bytes at the door and returns them byte-for-byte at the exit
 * (the un-own law: the ride's mutations are the ride's).
 *
 * THE WALK (one command):
 *   T  the APIs' truth: the gallery answers, the host measured, the trio
 *      snapshotted byte-for-byte (the un-own anchor).
 *   W  the wall's arrival: three cards, the signage, the X's hover
 *      contract (hides at rest, reveals on hover — the t669 law at the
 *      wall), zero unnamed page-wide.
 *   P  the palette's Saved views group: the heading speaks the count,
 *      three rows, the thumbs REALLY render, the rows name their home
 *      job, the TTL cache (the second open costs zero gallery requests),
 *      the row's X hover contract, zero unnamed.
 *   J  the jump mouth (t668's core): a drill seat mounted -> the palette
 *      row jumped -> the inspector opens -> the dance (Results -> the
 *      final map tile -> View in 3D) -> the restored toast names the
 *      view and its door ("Jumped here") -> the pending consumed ->
 *      ONE-SHOT: a second viewer mount without a re-jump restores
 *      NOTHING (the Task 81 law, ridden live).
 *   X  the wall delete at the CURRENT shape (t669 C + t793): hover
 *      reveals the X, the click opens the QUESTION, "Delete view" lands
 *      it, the wall shrinks WITHOUT a reload (the broadcast), the toast
 *      teaches the after-state, the server confirms.
 *   N  the honest not-found (t669 D): a second drill seat cached into
 *      the palette, deleted SERVER-SIDE, the pending armed directly (the
 *      door's own wire shape — determinism over the TTL race), a fresh
 *      viewer consumes it and reports the absence honestly ("Saved view
 *      not found" naming "deleted"), the pending consumed even for
 *      absences.
 *   E  the dual clock's other half (t669 E): the palette's TTL expires
 *      and the deleted row fades (no hand edits, bounded poll).
 *   V  the viewer's home mouth (t671 A/B/C at the current shelf): B-key
 *      quick-save announces itself -> the wall GROWS by the broadcast
 *      with ZERO reloads (the marker witness); the palette's next open
 *      speaks the new row (the listener beat the TTL clock); the list's
 *      delete mouth takes the row back -> the wall shrinks by broadcast;
 *      the update mouth re-captures the DRILL's thumb -> the wall's card
 *      follows (fresh capture served, same-source law).
 *   B  world back: the drills swept, the trio PUT back byte-for-byte,
 *      the roster bit-for-bit, the canvas count == the opening count,
 *      no seed — and the wall + the palette agree at three.
 *
 * THE DRILLS: every mutation rides a t877drill* seat (never the trio);
 * the update re-captures only the drill's thumb. The trio's bytes are
 * the exit's own pin — restored by PUT and verified byte-for-byte.
 *
 * Born with the ledger aboard (the t861 birthright): THREE faces —
 * wallArrival / paletteFace / worldBack — arm 1 recorded on the first
 * ride. Registered at birth into A4e-28 (the family's shape).
 *
 * Receipt: shots-qa/t877-saved-views-family.json (+ PNGs archived).
 *
 *   node scripts/t877-saved-views-family.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { worldIdentity } from "./world-identity.mjs";
import { loadComparator, ledgerFace, armVerdict, LEDGER_LAW } from "./drift-ledger.mjs";
import { NAMEOF, NAMEOF_LAW } from "./shared-ruler.mjs";

const ROOT = process.cwd();
const BASE = "http://localhost:3000";
const RECEIPT = "shots-qa/t877-saved-views-family.json";
/* the receipt's REVISION stamp (the t867 arm-2r law, the family's field
 * name `instrumentRevision`): revision 1 — the birth. The stamp tells
 * the ledger the comparator predates any growth — the next same-revision
 * ride meets arm 3 bit-for-bit. */
const RECEIPT_REVISION = 2; /* rev 2 — the clean-room growth (the t890 residue law): the leftRailTab ("catalog" | "workspaces") persists in localStorage, and a session that once measured the Workspaces panel rides the rail OFF the catalog forever — the canvas faces' page-wide scalars shift by the catalog's own weight (40 type buttons + the search input; the t877/t880 arm-3 -52). The boot's clean room now clears the rail tab to the canonical absence (the app's own default), and the viewport is pinned (the t883 band law: the sidebar sleeps below 1024 — the scalars are band-conditional). */
const PENDING_KEY = "cryoflow:pending-view";
const DRILL1 = "t877drill1";
const DRILL2 = "t877drill2";
const DRILL3 = "t877drill3";
const DRILL1_NAME = "t877 drill one";
const DRILL2_NAME = "t877 drill two";
const DRILL3_NAME = "t877 drill three";

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

const ab = (args) => execSync(`agent-browser ${args}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });
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
      /* a plain string — the value itself */
    }
  }
  return out;
};
const shot = (rel) =>
  execSync(`agent-browser screenshot ${rel}`, { encoding: "utf8", cwd: ROOT, stdio: ["pipe", "pipe", "pipe"] });

/* same-origin metadata — the API reads/writes are same-origin gates (the t708 shape) */
const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
  "Content-Type": "application/json",
};
/* THE IDLE-SOCKET REAPER (the t890 law, proven three deaths on one line):
 * Faces W/P run MINUTES with zero node-side api calls; the dev server
 * reaps idle keep-alive sockets, and the next call (Face J's seatsOf)
 * writes into a half-dead socket — "other side closed", deterministically
 * at the same line. The burn-then-ride retry: the first attempt burns the
 * reaped socket, the second rides a fresh one. */
const IDLE_SOCKET = /UND_ERR_SOCKET|UND_ERR_CLOSED|ECONNRESET|EPIPE|other side closed|socket hang up/i;
const fetchRetry = async (url, opts, tries = 3) => {
  let last = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      last = e;
      const code = String(e?.cause?.code ?? e?.code ?? "") + " " + String(e?.message ?? "");
      if (!IDLE_SOCKET.test(code) || i === tries - 1) throw e;
      console.log(`  · the api socket died idle (the dev server reaped it) — attempt ${i + 1} burned, riding a fresh one`);
      sleep(1);
    }
  }
  throw last;
};
const api = async (method, url, body) => {
  const r = await fetchRetry(`${BASE}${url}`, {
    method,
    headers: SH,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let b = null;
  try {
    b = await r.json();
  } catch {
    b = null;
  }
  return { status: r.status, body: b };
};
const roster = async () => {
  const r = await fetchRetry(`${BASE}/api/jobs`, { headers: SH });
  const b = await r.json();
  return b.jobs ?? b;
};
const seatsOf = async (hostId) =>
  (await api("GET", `/api/jobs/${hostId}/camera-bookmarks`)).body?.bookmarks ?? [];
const galleryOf = async () => (await api("GET", `/api/views/gallery`)).body?.views ?? [];

/* the drill seat shape — the t669 form, thumbless (the wall renders its
 * own Mountain fallback; the honest absence IS the drill's look) */
const mkSeat = (id, name) => ({
  id,
  name,
  ts: Date.now(),
  snapshot: {
    mode: "iso",
    fov: 0.876,
    position: [42.7, 38.1, 95.3],
    up: [0, 1, 0],
    target: [0, 0, 0],
    radius: 63.2,
    radiusMax: 110.4,
    fog: 0,
    clipFar: 0,
    minNear: 0,
    minFar: 0,
  },
  view: {
    sigma: 2.5,
    sign: 1,
    slice: { on: true, axis: "Z", pos: 0.35 },
    clip: { on: false, x: 1, y: 1, z: 1, invert: false },
  },
});
const putSeats = async (hostId, seats) => {
  const r = await api("PUT", `/api/jobs/${hostId}/camera-bookmarks`, { bookmarks: seats });
  if (r.status < 200 || r.status >= 300) throw new Error(`seats PUT failed: ${r.status}`);
  return r.body;
};

/* the drill's REAL baseline thumb (the t671 form): an 8x8 grayscale PNG —
 * the V face's update leg needs a BEFORE that speaks (a thumbless seat
 * renders the Mountain fallback and the wall has no img to compare) */
const seedThumb = () => {
  let c = ~0;
  const buf = Buffer.from(Array.from({ length: 64 }, (_, i) => Math.min(255, 90 + (i % 8) * 20)));
  const table = [];
  for (let n = 0; n < 256; n++) {
    let k = n;
    for (let j = 0; j < 8; j++) k = k & 1 ? 0xedb88320 ^ (k >>> 1) : k >>> 1;
    table[n] = k;
  }
  for (const b of buf) c = table[(c ^ b) & 0xff] ^ (c >>> 8);
  const crc = (~c) >>> 0;
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const t = Buffer.from(type, "ascii");
    const crcBuf = Buffer.alloc(4);
    const cc = (() => {
      let x = ~0;
      for (const b of Buffer.concat([t, data])) x = table[(x ^ b) & 0xff] ^ (x >>> 8);
      return (~x) >>> 0;
    })();
    crcBuf.writeUInt32BE(cc);
    return Buffer.concat([len, t, data, crcBuf]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(8, 0);
  ihdr.writeUInt32BE(8, 4);
  ihdr[8] = 8;
  const raw = Buffer.alloc(9 * 8);
  for (let y = 0; y < 8; y++) {
    raw[y * 9] = 0;
    for (let x = 0; x < 8; x++) raw[y * 9 + 1 + x] = Math.min(255, 90 + x * 20);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  void crc;
  return `data:image/png;base64,${png.toString("base64")}`;
};

/* ---------- the measure: the wall, the palette group, the mol shelf ---------- */
const MEASURE =
  '(() => { ' + NAMEOF + ' ' +
  'const btns = Array.from(document.querySelectorAll("button"));' +
  'const un = btns.filter((b) => !nameOf(b));' +
  'const unWho = un.slice(0, 5).map((b) => { const s = b.querySelector("svg"); const cls = s ? (s.getAttribute("class") || "") : ""; const luc = cls.split(/\\s+/).find((c) => c.indexOf("lucide-") === 0); return luc || (b.getAttribute("data-slot") || b.tagName); });' +
  'const ctrls = Array.from(document.querySelectorAll("input,select,textarea"));' +
  'const unCtrls = ctrls.filter((c) => !nameOf(c));' +
  'const imgsAll = Array.from(document.querySelectorAll("img"));' +
  'const altless = imgsAll.filter((i) => !i.hasAttribute("alt"));' +
  'const dgs = Array.from(document.querySelectorAll("[role=dialog]"));' +
  'const wall = document.querySelector(\'section[aria-label="Saved 3D views across all projects"]\');' +
  'const wallCards = wall ? Array.from(wall.querySelectorAll("[data-saved-view-card]")) : [];' +
  'const wallSign = wall ? ((wall.querySelector(".text-\\\\[11px\\\\]")?.textContent || wall.textContent || "").trim()) : null;' +
  'const wallXs = wall ? wall.querySelectorAll(\'[data-saved-view-delete]\').length : 0;' +
  'const cmdkInput = document.querySelector("[cmdk-input]");' +
  'const svHeading = Array.from(document.querySelectorAll("[cmdk-group-heading]")).map((h) => (h.textContent || "").trim()).find((t) => t.indexOf("Saved views") === 0) || null;' +
  'const svRows = Array.from(document.querySelectorAll("[data-palette-savedview-row]"));' +
  'const bmTrig = btns.map((b) => b.getAttribute("aria-label") || "").find((a) => a.indexOf("Camera view bookmarks") === 0) || null;' +
  'const leaves = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /^Loading( chart)?$/.test((e.textContent || "").trim())).length;' +
  'return JSON.stringify({ url: location.pathname, pageBtns: btns.length, pageUnnamed: un.length, unWho, ctrls: ctrls.length, unCtrls: unCtrls.length, imgs: imgsAll.length, altless: altless.length, imgPending: imgsAll.filter((i) => !i.complete).length, hasDlg: dgs.length > 0, dlgCount: dgs.length, wallPresent: !!wall, wallCards: wallCards.length, wallIds: wallCards.map((c) => c.getAttribute("data-saved-view-card")), wallSign, wallXs, cmdkOpen: !!cmdkInput, cmdkItems: document.querySelectorAll("[cmdk-item]").length, svHeading, svRows: svRows.length, svRowNames: svRows.map((r) => (r.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 40)), bmTrig, shimmer: leaves, marker: window.__t877Marker ?? null, pending: sessionStorage.getItem("cryoflow:pending-view") }); })()';

const diffKeys = (a, b) => {
  const ka = Object.keys(a ?? {});
  return ka.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b?.[k]));
};
const settle = (what, maxSecs = 16, need = 2) => {
  let m = evalJson(MEASURE);
  let run = 1;
  for (let i = 0; i < maxSecs; i++) {
    sleep(1);
    const next = evalJson(MEASURE);
    const same = JSON.stringify(next) === JSON.stringify(m);
    if (!same && run > 1) {
      const dk = diffKeys(m, next);
      if (dk.length) console.log(`    (measure moved while settling: ${dk.join(", ")})`);
    }
    m = next;
    run = same ? run + 1 : 1;
    if (run >= need && m.shimmer === 0) break;
  }
  console.log(`  settled ${what} (shimmer silent, ${run}x stable)`);
  return m;
};
const waitFor = (what, probe, maxSecs = 24) => {
  let m = evalJson(MEASURE);
  for (let i = 0; i < maxSecs; i++) {
    if (probe(m)) return m;
    sleep(1);
    m = evalJson(MEASURE);
  }
  console.log(`    (waitFor "${what}" timed out after ${maxSecs}s — the last measure rides)`);
  return m;
};
const corpse = (m, where) =>
  m.pageBtns === 0 && m.ctrls === 0 && m.pageUnnamed === 0
    ? (console.error(`  ✗ CORPSE at ${where}: pageBtns=0 — the eval filmed a dead server (OOM signature); re-ride on a fresh one`), true)
    : false;
const censusOk = (m) => m.pageUnnamed === 0 && m.unCtrls === 0 && m.altless === 0;

/* ---------- doors (the family's own dialects) ---------- */
const ESC_LAST =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; if (d) { const k = new KeyboardEvent("keydown", { key: "Escape", bubbles: true }); (document.activeElement || document.body).dispatchEvent(k); d.dispatchEvent(k); } return "esc"; })()';
const tabMouseDown = (name) =>
  '(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.textContent || "").trim() === "' + name + '"); if (!t) return JSON.stringify({ found: false }); t.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })); return JSON.stringify({ found: true }); })()';
const openRoster = (name) =>
  '(() => { const row = Array.from(document.querySelectorAll("[data-roster-row]")).find((r) => (r.textContent || "").includes("' + name + '")); if (!row) return JSON.stringify({ clicked: false, why: "no-row" }); const b = Array.from(row.querySelectorAll("button")).find((x) => (x.getAttribute("title") || "").startsWith("Open ")); if (!b) return JSON.stringify({ clicked: false, why: "no-open-btn" }); b.click(); return JSON.stringify({ clicked: true }); })()';
const tileDoor = (suffix) =>
  '(() => { const sec = document.querySelector(\'section[aria-label="Maps and images"]\'); if (!sec) return JSON.stringify({ clicked: false, why: "no-section" }); const t = Array.from(sec.querySelectorAll("button[data-tile-path]")).find((b) => b.getAttribute("data-tile-path").endsWith("' + suffix + '")); if (!t) return JSON.stringify({ clicked: false, why: "no-tile", tiles: Array.from(sec.querySelectorAll("button[data-tile-path]")).map((b) => b.getAttribute("data-tile-path")).slice(0, 6) }); t.click(); return JSON.stringify({ clicked: true }); })()';
const view3dDoor =
  '(() => { const ds = document.querySelectorAll("[role=dialog]"); const d = ds[ds.length - 1]; const b = Array.from(d.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || x.textContent || "")).includes("View in 3D")); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true, text: (b.textContent || "").trim().slice(0, 30) }); })()';
const clickWhen = (js) => evalJson(js);
const wallXClick = (id) =>
  '(() => { const card = document.querySelector(\'[data-saved-view-card="' + id + '"]\'); if (!card) return JSON.stringify({ clicked: false, why: "no-card" }); const x = card.querySelector("[data-saved-view-delete]"); if (!x) return JSON.stringify({ clicked: false, why: "no-x" }); x.click(); return JSON.stringify({ clicked: true }); })()';
const confirmDeleteView =
  '(() => { const ds = Array.from(document.querySelectorAll("[role=alertdialog], [role=dialog]")); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ clicked: false, why: "no-dialog" }); const b = Array.from(d.querySelectorAll("button")).find((x) => (x.textContent || "").trim() === "Delete view"); if (!b) return JSON.stringify({ clicked: false, why: "no-action", texts: Array.from(d.querySelectorAll("button")).map((x) => (x.textContent || "").trim()).slice(0, 6) }); b.click(); return JSON.stringify({ clicked: true }); })()';
const confirmText =
  '(() => { const ds = Array.from(document.querySelectorAll("[role=alertdialog], [role=dialog]")); const d = ds[ds.length - 1]; if (!d) return JSON.stringify({ title: null }); const h = d.querySelector("h2"); return JSON.stringify({ title: h ? (h.textContent || "").trim() : (d.textContent || "").trim().slice(0, 80), role: d.getAttribute("role") }); })()';
const paletteRowClick = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ clicked: false, why: "no-row" }); r.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); return JSON.stringify({ clicked: true }); })()';
const paletteXProbe = (id) =>
  '(() => { const r = document.querySelector(\'[data-palette-savedview-row="' + id + '"]\'); if (!r) return JSON.stringify({ present: false }); const x = r.querySelector("[data-palette-savedview-delete]"); if (!x) return JSON.stringify({ present: false, why: "no-x" }); return JSON.stringify({ present: true, opacity: getComputedStyle(x).opacity }); })()';
const bmTriggerClick =
  '(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || "").indexOf("Camera view bookmarks") === 0)); if (!b) return JSON.stringify({ clicked: false }); b.click(); return JSON.stringify({ clicked: true }); })()';
const bmListClick = (prefix) =>
  '(() => { const b = Array.from(document.querySelectorAll("button")).find((x) => ((x.getAttribute("aria-label") || "").indexOf("' + prefix + '") === 0)); if (!b) return JSON.stringify({ clicked: false, labels: Array.from(document.querySelectorAll("button")).map((x) => x.getAttribute("aria-label") || "").filter((a) => a.indexOf("bookmark") >= 0).slice(0, 8) }); b.click(); return JSON.stringify({ clicked: true }); })()';
const thumbSrcOf = (id) =>
  '(() => { const card = document.querySelector(\'[data-saved-view-card="' + id + '"]\'); if (!card) return JSON.stringify({ src: null, why: "no-card" }); const img = card.querySelector("img"); return JSON.stringify({ src: img ? (img.getAttribute("src") || "").slice(0, 48) : null }); })()';

/* the toast recorder (the t668 form, REINSTALLABLE): every toast text as
 * it mounts, read from the log later — the 5s lifetime is shorter than
 * some polls */
const installToastObserver = () =>
  evalJson('(() => { const w = window; w.__t877Toasts = []; const t0 = Date.now(); if (w.__t877Mo) w.__t877Mo.disconnect(); w.__t877Mo = new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) { if (n.nodeType === 1) { const t = n.textContent || ""; if (/restored|not found|deleted|saved|updated|could not|failed/i.test(t)) { w.__t877Toasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, " ").slice(0, 200) }); } } } }); w.__t877Mo.observe(document.body, { childList: true, subtree: true }); return "observer-on"; })()');
const readToasts = () => {
  const r = evalJson('(() => JSON.stringify((window.__t877Toasts ?? []).map((t) => t.text)))()');
  if (Array.isArray(r)) return r;
  if (typeof r === "string") {
    try {
      const p = JSON.parse(r);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
};
const toastWait = async (pred, maxSecs = 20) => {
  for (let i = 0; i < maxSecs * 2; i++) {
    const ts = readToasts();
    const hit = (ts ?? []).find(pred);
    if (hit) return hit;
    sleep(0.5);
  }
  return null;
};

/* the gallery request counter (the TTL cache's wire witness): wraps
 * window.fetch on the LIVE page — no reload may cross between install
 * and read (the wrapper dies with the document, and that is the point:
 * the TTL cache's claim is a same-page claim) */
const installFetchCounter = () =>
  evalJson('(() => { const w = window; if (w.__t877RawFetch) { w.__t877Gallery = 0; return "re-armed"; } w.__t877RawFetch = w.fetch.bind(w); w.__t877Gallery = 0; w.fetch = (...args) => { const u = typeof args[0] === "string" ? args[0] : (args[0] && args[0].url) || ""; if (u.indexOf("/api/views/gallery") === 0 || u.indexOf("/api/views/gallery?") >= 0) w.__t877Gallery++; return w.__t877RawFetch(...args); }; return "armed"; })()');
const galleryCount = () => {
  const r = evalJson('(() => JSON.stringify({ n: window.__t877Gallery ?? null }))()');
  return r && typeof r === "object" ? r.n : null;
};
const setMarker = (v) => evalJson('(() => { window.__t877Marker = ' + JSON.stringify(v) + '; return "set"; })()');

/* the viewer dance (the t867/t869 recipe on the prod lane): the roster's
 * open door -> the Results tab (mousedown, the Radix law) -> the FINAL
 * map tile -> View in 3D -> the shelf's own load fingerprint
 * ("Camera view bookmarks — N saved") — the embed's list IS the load
 * signal the pending consumer waits on (the fingerprint rule: act only
 * after it, the t671 law). Ladder: health wait + reload + re-dance. */
const dance = async (hostName, wantSaved, maxLadders = 2) => {
  const fingerprint = (m) => m.bmTrig !== null && m.bmTrig.includes(`— ${wantSaved} saved`);
  for (let attempt = 0; attempt <= maxLadders; attempt++) {
    if (attempt > 0) {
      console.log(`  · dance attempt ${attempt}: ${attempt === 1 ? "re-dance in place" : "health wait + reload + re-dance"}`);
      if (attempt > 1) {
        await pageHealthy(60);
        ab("open http://localhost:3000");
        sleep(3);
        installToastObserver();
        const dash = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
        if (!dash.clicked) continue;
        sleep(2);
      }
      // the inspector may have died with the ladder — reopen from the roster
      const dlg = evalJson(MEASURE);
      if (!dlg.hasDlg) {
        const op = evalJson(openRoster(hostName));
        if (!op.clicked) continue;
        waitFor("the inspector", (m) => m.hasDlg, 20);
      }
    } else {
      /* attempt 0's own gate: a caller may arrive with NO dialog up (the
       * V face re-dances from the dashboard) — open the inspector from
       * the roster before touching the tabs (the first ride's honest
       * "no-section" refusal, now the door's own first fact) */
      const dlg0 = evalJson(MEASURE);
      if (!dlg0.hasDlg) {
        const op0 = evalJson(openRoster(hostName));
        if (!op0.clicked) return { ok: false, measure: dlg0, why: "no-inspector" };
        waitFor("the inspector", (m) => m.hasDlg, 20);
      }
    }
    evalJson(tabMouseDown("Results"));
    sleep(2);
    waitFor("the maps gallery", (m) => m.pageBtns > 0 && m.imgs >= 1, 40);
    const tile = evalJson(tileDoor("run_class001.mrc"));
    if (!tile.clicked) {
      console.log(`    (tile door refused: ${JSON.stringify(tile).slice(0, 120)})`);
      continue;
    }
    waitFor("the quick-look dialog", (m) => m.dlgCount >= 2, 30);
    const v3 = evalJson(view3dDoor);
    if (!v3.clicked) {
      console.log(`    (View-in-3D door refused)`);
      continue;
    }
    const up = waitFor("the shelf's load fingerprint", fingerprint, 60);
    if (fingerprint(up)) return { ok: true, measure: up };
  }
  return { ok: false, measure: evalJson(MEASURE) };
};
const pageHealthy = async (maxSecs = 60) => {
  for (let i = 0; i < maxSecs; i++) {
    try {
      const t0 = Date.now();
      const r = await fetch(`${BASE}/api/jobs`, { headers: { Origin: BASE } });
      if (r.ok && Date.now() - t0 < 2500) return true;
    } catch { /* breath */ }
    await new Promise((res) => setTimeout(res, 1000));
  }
  return false;
};
const backToDashboard = () => {
  evalJson(ESC_LAST); sleep(0.7);
  evalJson(ESC_LAST); sleep(0.7);
  evalJson(ESC_LAST); sleep(0.7);
  evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
  sleep(1.5);
};

console.log("t877 — the saved-views family's port (the debt cluster t668-t671 rides a living host)\n");

const world = worldIdentity(ROOT);
console.log(`  world key: ${world.id} (${world.mode})`);
const cmp = loadComparator(ROOT, RECEIPT, world.id);
console.log(`  drift ledger: ${cmp.prevFound ? `comparator found (build ${cmp.prevBuild}, rev ${cmp.prevRevision ?? "unmarked"})` : "no predecessor — arm 1 (first ride)"}`);

/* ---------- Face 0: the clean room + the calm canvas ---------- */
console.log("Face 0 — the clean room (the t866 law) and the calm canvas");
ab("open http://localhost:3000");
sleep(3);
/* the clean room clears the RIDE'S keys, not just the seed: the session
 * persists across agent-browser tabs — a prior visit's armed pending is
 * residue the ride must not inherit (the boot's canonical absence) */
ab("set viewport 1536 800"); /* the band pin (rev 2, the t883 band law): the page-wide scalars are band-conditional — pin the wide band, never inherit the session's */
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); sessionStorage.removeItem("cryoflow:pending-view"); localStorage.removeItem("cryoflow.leftRailTab.v1"); return "clean"; })()');
ab("open http://localhost:3000");
sleep(3);
installToastObserver();
const m0 = settle("the canvas");
if (corpse(m0, "Face 0")) process.exit(1);
ok("O0 the boot is a clean room (the t157 seed cleared, the pending cleared, no dialogs)", m0.hasDlg === false && m0.pending === null, `dlg=${m0.hasDlg} pending=${m0.pending}`);
ok("O1 the canvas is calm and named (the census's invariant)", censusOk(m0), `btns=${m0.pageBtns} — zero unnamed anywhere`);
const OPEN = m0.pageBtns;

/* ---------- Face T: the APIs' truth first ---------- */
console.log("Face T — the gallery route, the measured host, the trio's byte snapshot");
let views = [];
try {
  views = await galleryOf();
} catch { views = []; }
ok("T1 the views gallery route answers with at least one view", views.length >= 1, `${views.length} view(s)`);
const views2 = views.filter((v) => (v.bookmarks ?? []).length > 0);
ok("T2 the world has a bookmark-bearing job (the measured host, never pinned)", views2.length >= 1, `hosts=${views2.map((v) => v.jobName).join(" | ").slice(0, 60)}`);
const host = views2.find((v) => v.jobType === "refine3d") ?? views2[0];
ok("T3 the host is on the shelf with its own gallery row", !!host && !!host.jobId, `host="${host?.jobName}" type=${host?.jobType}`);
const trio = await seatsOf(host.jobId);
/* the shelf's own clean room (the t671 setup law, adopted): a prior
 * ride's drill residue means the walk would snapshot the WRONG bytes —
 * the seeds' own rows are the truth; restore them if anything else
 * rides the shelf, then snapshot (the ride starts from the canonical
 * shelf, the same law Face 0 applies to the session keys) */
const seedRows = trio.filter((s) => ["seedview1", "seedview2", "seedview3"].includes(s.id));
if (!(trio.length === 3 && seedRows.length === 3)) {
  if (seedRows.length !== 3) {
    console.error("the shelf lost a seed row — the world's own truth is broken; the ride stops honestly");
    process.exit(1);
  }
  await putSeats(host.jobId, seedRows);
  console.log("· setup: shelf restored to the three seeds (drill residue swept)");
}
const trio2 = trio.length === 3 ? trio : await seatsOf(host.jobId);
ok("T4 the host speaks the trio (the world's own seed truth)", trio2.length === 3 && trio2.some((s) => s.id === "seedview1") && trio2.some((s) => s.id === "seedview2") && trio2.some((s) => s.id === "seedview3"), trio2.map((s) => s.name).join(" | "));
ok("T5 the thumbs are honest data-URL images", trio2.every((s) => typeof s.thumb === "string" && s.thumb.startsWith("data:image/")), `thumbs=${trio2.filter((s) => (s.thumb ?? "").startsWith("data:image/")).length}/3`);
ok("T6 the trio's BYTE snapshot taken (the un-own anchor — the exit's own pin)", trio2.length === 3, `bytes≈${JSON.stringify(trio2).length}`);
const TRIO_BYTES = trio2;
const J0 = (await roster()).length;

/* ---------- Face W: the wall's arrival ---------- */
console.log("Face W — the dashboard's Saved views wall (the trio's stage)");
const dashClick = evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (!t) return JSON.stringify({ clicked: false }); t.click(); return JSON.stringify({ clicked: true }); })()');
ok("W0 the dashboard tab opened (the header switcher's own click)", dashClick.clicked === true);
const w1 = waitFor("the wall", (m) => m.wallPresent && m.wallCards >= 3, 20);
const w1s = settle("the wall");
if (corpse(w1s, "Face W")) process.exit(1);
ok("W1 the Saved views wall stands", w1s.wallPresent === true);
ok("W2 three cards stand (the trio)", w1s.wallCards === 3, `cards=${w1s.wallCards} ids=${JSON.stringify(w1s.wallIds)}`);
ok("W3 the wall signs its mouths (click to jump, hover to rename or delete — the t674-amended signage)", (w1s.wallSign ?? "").includes("click to jump") && (w1s.wallSign ?? "").includes("hover to rename or delete"), `sign="${(w1s.wallSign ?? "").slice(0, 70)}"`);
ok("W4 every card carries its delete X (three mouths, X named per view)", w1s.wallXs === 3, `X buttons=${w1s.wallXs}`);
const xsNamed = evalJson('(() => { const xs = Array.from(document.querySelectorAll("[data-saved-view-delete]")); return JSON.stringify(xs.map((x) => x.getAttribute("aria-label"))); })()');
ok("W5 every X NAMES its view for assistive tech", xsNamed.length === 3 && xsNamed.every((a) => /^Delete saved view /.test(a ?? "")), JSON.stringify(xsNamed).slice(0, 90));
const restOpacity = evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="seedview1"]\'); const x = card && card.querySelector("[data-saved-view-delete]"); return JSON.stringify({ opacity: x ? getComputedStyle(x).opacity : null }); })()').opacity;
ok("W6 the X hides at rest (the hover-reveal contract)", restOpacity === "0", `opacity ${restOpacity}`);
/* THE REVEAL'S DUAL CONTRACT AT THE HEADLESS WORLD (the first ride's
 * discovery): the pointer arm rides Tailwind v4's @media (hover: hover)
 * guard — and THIS world answers matchMedia("(hover: hover)") FALSE (the
 * headless browser's own word: no pointer, hover:none). The pointer arm
 * is PHYSICALLY UNWITNESSABLE here — and the product promises a SECOND
 * arm exactly for this: the X "reveals itself to keyboards (focus-within)"
 * (the wall's own code comment). The honest instrument reads the KEYBOARD
 * arm (0 -> 1 -> blur -> 0) and RECORDS the media read — the pointer arm
 * rides the build-day's headed ride if one ever comes. */
const hoverMedia = evalJson('(() => JSON.stringify({ hover: matchMedia("(hover: hover)").matches, pointerFine: matchMedia("(pointer: fine)").matches }))()');
ok("W6b the world's reveal media read recorded (the pointer arm's jurisdiction)", hoverMedia && typeof hoverMedia.hover === "boolean", `hover:hover=${hoverMedia.hover} pointer:fine=${hoverMedia.pointerFine} (headless: the keyboard arm is the witnessable one)`);
evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="seedview1"]\'); const b = card.querySelector("button"); b.focus(); return "focused"; })()');
sleep(0.6);
const hovOpacity = evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="seedview1"]\'); const x = card && card.querySelector("[data-saved-view-delete]"); return JSON.stringify({ opacity: x ? getComputedStyle(x).opacity : null }); })()').opacity;
ok("W7 the X reveals to the KEYBOARD (focus-within — the product's own second arm)", hovOpacity === "1", `opacity ${hovOpacity}`);
evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="seedview1"]\'); const b = card.querySelector("button"); b.blur(); return "blurred"; })()');
sleep(0.4);
const rest2Opacity = evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="seedview1"]\'); const x = card && card.querySelector("[data-saved-view-delete]"); return JSON.stringify({ opacity: x ? getComputedStyle(x).opacity : null }); })()').opacity;
ok("W7b the reveal is honest (blur returns the X to rest — not sticky)", rest2Opacity === "0", `opacity ${rest2Opacity}`);
ok("W8 zero unnamed page-wide WITH the wall up (the census's invariant)", censusOk(w1s), `btns=${w1s.pageBtns} ctrls=${w1s.ctrls}`);
shot("shots-qa/t877-wall.png");
console.log("  (the wall at three archived)");

/* ---------- Face P: the palette's Saved views group ---------- */
console.log("Face P — the palette's fourth family (the server-fed group, the TTL cache)");
installFetchCounter();
ab("press Control+k");
const p1 = waitFor("the palette", (m) => m.cmdkOpen === true, 15);
ok("P1 the palette opened (Control+k)", p1.cmdkOpen === true);
const p2 = waitFor("the Saved views group", (m) => m.svHeading !== null, 15);
ok("P2 the Saved views group speaks its heading (count aboard)", p2.svHeading !== null && /^Saved views · 3 bookmarks/.test(p2.svHeading), `heading="${p2.svHeading}"`);
ok("P3 three rows, one per bookmark", p2.svRows === 3, `rows=${p2.svRows}`);
const thumbReady = await (async () => {
  for (let i = 0; i < 15; i++) {
    const r = evalJson('(() => { const imgs = Array.from(document.querySelectorAll("[data-palette-savedview-thumb]")); return JSON.stringify({ n: imgs.length, ok: imgs.every((el) => el.complete && el.naturalWidth > 0) }); })()');
    if (r.n === 3 && r.ok) return true;
    sleep(1);
  }
  return false;
})();
ok("P4 the thumbs REALLY render (complete + naturalWidth — the t865 settle law)", thumbReady === true);
const rowHome = evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="seedview1"]\'); return JSON.stringify({ text: r ? (r.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 60) : null }); })()').text;
ok("P5 the row names its home job (the measured host's own name)", rowHome !== null && rowHome.includes(host.jobName), `row="${rowHome}"`);
ok("P6 zero unnamed with the palette up (the census's invariant)", censusOk(p2), `btns=${p2.pageBtns} ctrls=${p2.ctrls}`);
shot("shots-qa/t877-palette.png");
console.log("  (the palette's Saved views group archived)");
/* the TTL cache: close, reopen within the window — zero new requests */
ab("press Escape");
sleep(1);
const before = galleryCount();
ab("press Control+k");
sleep(2.5);
const pCache = evalJson(MEASURE);
const after = galleryCount();
ok("P7 the second open costs ZERO gallery requests (the TTL cache holds)", before !== null && after === before, `gallery requests ${before} -> ${after}`);
const px1 = evalJson(paletteXProbe("seedview1"));
ok("P8 the palette row carries its delete X (the t670 mouth)", px1.present === true, `present=${px1.present}`);
ok("P9 the row's X hides at rest (the palette's own hover contract)", px1.opacity === "0", `opacity ${px1.opacity}`);
evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="seedview1"]\'); if (r) { const ev = new MouseEvent("mouseover", { bubbles: true }); r.dispatchEvent(ev); const x = r.querySelector("[data-palette-savedview-delete]"); if (x) x.dispatchEvent(ev); } return "hovered"; })()');
ab('hover [data-palette-savedview-row="seedview1"]');
sleep(0.6);
evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="seedview1"]\'); const b = r.querySelector("[cmdk-item]") ? r : r; r.focus && r.focus(); const body = r.querySelector("button"); if (body) body.focus(); return "focused"; })()');
sleep(0.6);
const px2 = evalJson(paletteXProbe("seedview1"));
/* the palette row's reveal rides group-hover/item + group-focus-within/item
 * — the same dual contract, same headless verdict: the keyboard arm */
ok("P10 the row's X reveals to the KEYBOARD (focus-within — the slot-swap grammar's second arm)", px2.opacity === "1", `opacity ${px2.opacity}`);
evalJson('(() => { const r = document.querySelector(\'[data-palette-savedview-row="seedview1"]\'); const body = r.querySelector("button"); if (body) body.blur(); if (document.activeElement) document.activeElement.blur(); return "blurred"; })()');
sleep(0.4);
const px3 = evalJson(paletteXProbe("seedview1"));
ok("P10b the row's reveal is honest (blur returns it to rest)", px3.opacity === "0", `opacity ${px3.opacity}`);
ab("press Escape");
sleep(1);

/* ---------- Face J: the jump mouth (t668's core) ---------- */
console.log("Face J — the jump: drill seat -> palette row -> the dance -> the restored toast -> ONE-SHOT");
const seatsJ = await seatsOf(host.jobId);
await putSeats(host.jobId, [...seatsJ.filter((s) => s.id !== DRILL1), mkSeat(DRILL1, DRILL1_NAME)]);
const afterMountJ = await seatsOf(host.jobId);
ok("J0 the drill seat mounted through the PUT lane (adopt-or-create, API)", afterMountJ.length === 4 && afterMountJ.some((s) => s.id === DRILL1), `seats=${afterMountJ.length}`);
ab("open http://localhost:3000");
sleep(3);
installToastObserver();
evalJson('(() => { const t = Array.from(document.querySelectorAll("[role=tab]")).find((e) => (e.getAttribute("title") || "").startsWith("Project dashboard")); if (t) t.click(); return "dash"; })()');
sleep(1.5);
const wJ = waitFor("the wall at four", (m) => m.wallCards === 4, 15);
ok("J1 the wall holds four (the gallery route's fresh read on the fresh load)", wJ.wallCards === 4, `cards=${wJ.wallCards}`);
ab("press Control+k");
waitFor("the palette", (m) => m.cmdkOpen === true, 15);
const rowJ = waitFor("the drill row", (m) => (m.svRowNames ?? []).some((n) => n.includes(DRILL1_NAME)), 15);
ok("J2 the palette speaks four rows, the drill among them", rowJ.svRows === 4 && (rowJ.svRowNames ?? []).some((n) => n.includes(DRILL1_NAME)), `rows=${rowJ.svRows}`);
clickWhen(paletteRowClick(DRILL1));
sleep(1);
const j3 = evalJson(MEASURE);
ok("J3 the palette closes on jump (the jump mouth's first promise)", j3.cmdkOpen === false && j3.dlgCount >= 1, `cmdkOpen=${j3.cmdkOpen} dlgCount=${j3.dlgCount}`);
const dancedJ = await dance(host.jobName, 4);
ok("J4 the 3D viewer is REALLY up (the shelf's load fingerprint speaks — 4 saved)", dancedJ.ok === true, `bmTrig="${dancedJ.measure.bmTrig ?? "??"}"`);
const restored1 = await toastWait((t) => t.includes(DRILL1_NAME) && t.includes("restored"), 25);
ok("J5 the arrival toast NAMES the view (the handshake's fingerprint)", !!restored1, restored1 ?? "none");
ok("J6 the arrival speaks its door (Jumped here — the description's own words)", !!restored1 && restored1.includes("Jumped here"), (restored1 ?? "").slice(0, 90));
const pendingAfterJ = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("J7 the pending handshake is CONSUMED (one-shot semantics)", pendingAfterJ === "null" || pendingAfterJ === null, `pending=${pendingAfterJ}`);
shot("shots-qa/t877-restore.png");
console.log("  (the restored arrival archived)");
/* the one-shot's second act: reopen WITHOUT a re-jump — nothing restores */
const baselineToasts = (readToasts() ?? []).length;
backToDashboard();
const reopen = evalJson(openRoster(host.jobName));
ok("J8 the roster's open door clicked again (NO re-jump — the honest reopen)", reopen.clicked === true);
waitFor("the inspector again", (m) => m.hasDlg, 20);
const dancedJ2 = await dance(host.jobName, 4);
ok("J9 the second viewer mount is REALLY up", dancedJ2.ok === true, dancedJ2.ok ? `bmTrig="${dancedJ2.measure.bmTrig}"` : "the ladder gave — recorded");
sleep(6); /* longer than the toast's 5s life — absence is the assertion */
const newToasts = (readToasts() ?? []).slice(baselineToasts);
ok("J10 no NEW restore toast in this window (the consumed link never re-opens — the Task 81 law live)", !newToasts.some((t) => t.includes("restored")), newToasts.find((t) => t.includes("restored")) ?? `${newToasts.length} toasts since baseline, none restore`);

/* ---------- Face X: the wall delete at the CURRENT shape (t669 C + t793) ---------- */
console.log("Face X — the wall's X, the QUESTION, the shrink, the after-state");
backToDashboard();
setMarker("x-face");
const wX = waitFor("the wall at four", (m) => m.wallCards === 4, 15);
ok("X0 the wall stands at four (the drill's card among the trio)", wX.wallCards === 4, `cards=${wX.wallCards}`);
evalJson('(() => { const c = document.querySelector(\'[data-saved-view-card="' + DRILL1 + '"]\'); const b = c.querySelector("button"); b.focus(); return "focused"; })()');
sleep(0.6);
const xOp = evalJson('(() => { const card = document.querySelector(\'[data-saved-view-card="' + DRILL1 + '"]\'); const x = card && card.querySelector("[data-saved-view-delete]"); return JSON.stringify({ opacity: x ? getComputedStyle(x).opacity : null }); })()').opacity;
ok("X1 the drill card's X reveals to the KEYBOARD (the dual contract's witnessable arm)", xOp === "1", `opacity ${xOp}`);
clickWhen(wallXClick(DRILL1));
sleep(1);
const cf = evalJson(confirmText);
ok("X2 THE CONFIRM DIALOG STANDS (the t793 question — the shape the shadowed walk never saw)", (cf.title ?? "").includes("Delete saved view") && (cf.title ?? "").includes(DRILL1_NAME), `title="${(cf.title ?? "").slice(0, 70)}"`);
const reloadWitnessX = evalJson('(() => JSON.stringify(window.__t877Marker))()');
clickWhen(confirmDeleteView);
sleep(1.5);
const wX2 = waitFor("the wall at three", (m) => m.wallCards === 3, 15);
ok("X3 the wall shrinks to three without the drill card", wX2.wallCards === 3 && !(wX2.wallIds ?? []).includes(DRILL1), `cards=${wX2.wallCards}`);
ok("X4 the shrink rode the BROADCAST (zero reloads — the marker survived, the SAVED_VIEWS_CHANGED_EVENT's whole point)", reloadWitnessX === '"x-face"' && evalJson('(() => JSON.stringify(window.__t877Marker))()') === '"x-face"', `marker=${reloadWitnessX}`);
const delToast = await toastWait((t) => t.includes(DRILL1_NAME) && t.includes("deleted"), 10);
ok("X5 the deletion toast reports (t817's teaching shape: the after-state aboard)", !!delToast && delToast.includes("remain"), delToast ?? "none");
const serverAfterX = await seatsOf(host.jobId);
ok("X6 the server holds three, drill seat gone", serverAfterX.length === 3 && !serverAfterX.some((s) => s.id === DRILL1), `seats=${serverAfterX.length}`);

/* ---------- Face N: the honest not-found (t669 D) ---------- */
console.log("Face N — the honest absence: cached, deleted server-side, jumped anyway");
backToDashboard();
const seatsN = await seatsOf(host.jobId);
await putSeats(host.jobId, [...seatsN.filter((s) => s.id !== DRILL2), mkSeat(DRILL2, DRILL2_NAME)]);
/* the caching open rides the TTL clock, not against it (the t669 probe
 * refused the race; the port POLLS it — the API-lane PUT fires no
 * broadcast, so the palette's 30s cache speaks the pre-PUT truth until
 * expiry): open, check, escape, breathe — bounded */
let rowNCached = null;
const nDeadline = Date.now() + 60_000;
while (Date.now() < nDeadline) {
  ab("press Control+k");
  sleep(2.5);
  const mN = evalJson(MEASURE);
  const has = (mN.svRowNames ?? []).some((n) => n.includes(DRILL2_NAME));
  ab("press Escape");
  sleep(1);
  if (mN.svRows === 4 && has) { rowNCached = `rows=${mN.svRows}`; break; }
  sleep(8);
}
ok("N0 the palette cached the drill row (four rows — the TTL clock polled, not raced)", rowNCached !== null, rowNCached ?? "the row never cached past 60s");
const seatsNow = await seatsOf(host.jobId);
const keepTrio = seatsNow.filter((s) => s.id !== DRILL2);
await putSeats(host.jobId, keepTrio);
const afterDelN = await seatsOf(host.jobId);
ok("N1 the drill deleted SERVER-SIDE (the palette's cache now a clock behind)", afterDelN.length === 3, `seats=${afterDelN.length}`);
evalJson('(() => { sessionStorage.setItem("cryoflow:pending-view", ' + JSON.stringify(JSON.stringify({ jobId: host.jobId, bookmarkId: DRILL2 })) + '); return "armed"; })()');
ok("N2 the pending armed DIRECTLY for the dead id (the door's own wire shape — determinism over the TTL race)", true);
const markerN = evalJson('(() => JSON.stringify(window.__t877Marker))()');
if (markerN !== '"x-face"') {
  /* a ladder reload wiped the marker — reinstall the honest state */
  installToastObserver();
}
backToDashboard();
const reopenN = evalJson(openRoster(host.jobName));
ok("N3 the roster's open door clicked (a FRESH viewer will consume the armed pending)", reopenN.clicked === true);
waitFor("the inspector", (m) => m.hasDlg, 20);
const dancedN = await dance(host.jobName, 3);
ok("N4 the drill viewer is REALLY up (three saved — the post-delete truth)", dancedN.ok === true, dancedN.ok ? `bmTrig="${dancedN.measure.bmTrig}"` : "the ladder gave — recorded");
let nfToast = await toastWait((t) => t.includes("Saved view not found"), 25);
if (!nfToast) {
  const ts = readToasts() ?? [];
  if (ts.some((t) => t.includes(DRILL2_NAME) && t.includes("restored"))) {
    console.log("  · the fetch died mid-flight (the local mirror answered) — one reload retry");
    ab("open http://localhost:3000");
    sleep(3);
    installToastObserver();
    evalJson('(() => { sessionStorage.setItem("cryoflow:pending-view", ' + JSON.stringify(JSON.stringify({ jobId: host.jobId, bookmarkId: DRILL2 })) + '); return "re-armed"; })()');
    backToDashboard();
    const re = evalJson(openRoster(host.jobName));
    if (re.clicked) {
      waitFor("the inspector", (m) => m.hasDlg, 20);
      await dance(host.jobName, 3, 1);
      nfToast = await toastWait((t) => t.includes("Saved view not found"), 25);
    }
  }
}
ok("N5 THE HONEST NOT-FOUND: the deleted jump's arrival speaks the absence", !!nfToast, nfToast ?? "none");
ok("N6 the toast names the honest cause (deleted — not a silent no-op)", !!nfToast && nfToast.includes("deleted"), (nfToast ?? "").slice(0, 90));
const pendingAfterN = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("N7 the pending consumed even for absences (one-shot, the door's honesty clause)", pendingAfterN === "null" || pendingAfterN === null, `pending=${pendingAfterN}`);
shot("shots-qa/t877-notfound.png");
console.log("  (the honest not-found archived)");

/* ---------- Face E: the dual clock's other half — the list self-heals ---------- */
console.log("Face E — the palette's TTL expires and the deleted row fades (no hand edits)");
let healed = null;
const eDeadline = Date.now() + 100_000;
while (Date.now() < eDeadline) {
  backToDashboard();
  ab("press Control+k");
  sleep(2.5);
  const mE = evalJson(MEASURE);
  const gone = !(mE.svRowNames ?? []).some((n) => n.includes(DRILL2_NAME));
  ab("press Escape");
  sleep(1);
  if (mE.svRows === 3 && gone) { healed = `rows=${mE.svRows}`; break; }
  sleep(8);
}
ok("E1 the palette's TTL expired and the deleted row faded (self-heal, bounded 100s poll)", healed !== null, healed ?? "still stale past 100s");

/* ---------- Face V: the viewer's home mouth (t671 A/B/C at the current shelf) ---------- */
console.log("Face V — the home mouth: B saves, the wall grows by broadcast; the list takes back; the update re-captures");
backToDashboard();
const seatsV = await seatsOf(host.jobId);
const drill3Seat = mkSeat(DRILL3, DRILL3_NAME);
drill3Seat.thumb = seedThumb(); /* the real baseline the update leg compares against (the t671 form) */
await putSeats(host.jobId, [...seatsV.filter((s) => s.id !== DRILL3), drill3Seat]);
const afterMountV = await seatsOf(host.jobId);
ok("V0 the third drill mounted (the home mouth's subject)", afterMountV.length === 4 && afterMountV.some((s) => s.id === DRILL3), `seats=${afterMountV.length}`);
const vDance = await dance(host.jobName, 4);
ok("V1 the viewer is REALLY up (— 4 saved: the fingerprint rule held)", vDance.ok === true, vDance.ok ? `bmTrig="${vDance.measure.bmTrig}"` : "the ladder gave — recorded");
setMarker("v-face");
ab("press b");
sleep(1.5);
const saveToast = await toastWait((t) => t.includes("View saved") && t.includes("(B key)"), 12);
ok("V2 THE B-KEY QUICK-SAVE ANNOUNCES ITSELF (the toast names the key)", !!saveToast, saveToast ?? "none");
const seatsAfterSave = await seatsOf(host.jobId);
ok("V3 the server holds FIVE (the browser's list HAD the shelf this time — the fingerprint rule's own payoff)", seatsAfterSave.length === 5, `seats=${seatsAfterSave.length}`);
backToDashboard();
const wV = waitFor("the wall at five", (m) => m.wallCards === 5, 15);
ok("V4 the wall holds five — grown by the BROADCAST, zero reloads (the marker witness)", wV.wallCards === 5 && evalJson('(() => JSON.stringify(window.__t877Marker))()') === '"v-face"', `cards=${wV.wallCards} marker=${evalJson('(() => JSON.stringify(window.__t877Marker))()')}`);
ab("press Control+k");
sleep(2.5);
const rowsV = evalJson(MEASURE);
ok("V5 the palette's next open speaks five rows (the listener beat the TTL clock — the t671 law)", rowsV.svRows === 5, `rows=${rowsV.svRows} heading="${rowsV.svHeading}"`);
ab("press Escape");
sleep(1);
const vDance2 = await dance(host.jobName, 5);
ok("V6 the viewer is up again (fresh mount, fresh list — 5 saved)", vDance2.ok === true, vDance2.ok ? `bmTrig="${vDance2.measure.bmTrig}"` : "the ladder gave");
clickWhen(bmTriggerClick);
sleep(1);
const delRes = clickWhen(bmListClick(`Delete bookmark View 5`));
ok("V7 the bookmark list carries its delete mouth and the B-saved row went", delRes.clicked === true, delRes.clicked ? "deleted" : JSON.stringify(delRes).slice(0, 100));
sleep(1.5);
const seatsAfterDel = await seatsOf(host.jobId);
ok("V8 the server holds four again (the home's own delete)", seatsAfterDel.length === 4 && !seatsAfterDel.some((s) => s.name === "View 5"), `seats=${seatsAfterDel.length}`);
backToDashboard();
const wV2 = waitFor("the wall at four", (m) => m.wallCards === 4, 15);
ok("V9 the wall shrinks by broadcast (four cards, zero reloads)", wV2.wallCards === 4 && evalJson('(() => JSON.stringify(window.__t877Marker))()') === '"v-face"', `cards=${wV2.wallCards}`);
const thumbBefore = evalJson(thumbSrcOf(DRILL3)).src;
const vDance3 = await dance(host.jobName, 4);
ok("V10 the viewer is up for the update", vDance3.ok === true, vDance3.ok ? `bmTrig="${vDance3.measure.bmTrig}"` : "the ladder gave");
clickWhen(bmTriggerClick);
sleep(1);
const updRes = clickWhen(bmListClick(`Update bookmark ${DRILL3_NAME}`));
ok("V11 the bookmark list carries its update mouth (the drill re-captured)", updRes.clicked === true, updRes.clicked ? "updated" : JSON.stringify(updRes).slice(0, 100));
sleep(1.5);
const updToast = await toastWait((t) => t.includes("View updated"), 10);
ok("V12 the update toast speaks (the pose & optics moved into the drill)", !!updToast, updToast ?? "none");
const seatsAfterUpd = await seatsOf(host.jobId);
ok("V13 the update never changed the count", seatsAfterUpd.length === 4, `seats=${seatsAfterUpd.length}`);
backToDashboard();
const thumbAfter = evalJson(thumbSrcOf(DRILL3)).src;
ok("V14 the wall's drill thumb CHANGED with the update (fresh capture served — the same-source law)", !!thumbBefore && !!thumbAfter && thumbBefore !== thumbAfter, `${thumbBefore} -> ${thumbAfter}`);
ok("V15 zero reloads across the whole home-mouth leg (the marker never moved)", evalJson('(() => JSON.stringify(window.__t877Marker))()') === '"v-face"', `marker=${evalJson('(() => JSON.stringify(window.__t877Marker))()')}`);

/* ---------- Face B: world back (the un-own law) ---------- */
console.log("Face B — the world back: drills swept, the trio byte-for-byte, the roster bit-for-bit");
const seatsEnd = await seatsOf(host.jobId);
await putSeats(host.jobId, TRIO_BYTES);
const finalSeats = await seatsOf(host.jobId);
ok("B1 the trio restored BYTE-FOR-BYTE (the exit's own pin — the un-own law)", JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES), `bytes equal=${JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES)}`);
const finalGallery = await galleryOf();
const galleryHost = finalGallery.find((v) => v.jobId === host.jobId);
ok("B2 the gallery route agrees with the shelf (three cards, one job row)", (galleryHost?.bookmarks ?? []).length === 3 && finalGallery.filter((v) => (v.bookmarks ?? []).length > 0).length === views2.length, `gallery rows=${finalGallery.filter((v) => (v.bookmarks ?? []).length > 0).length}`);
ok("B3 the roster bit-for-bit (bookmark mutations never touch the roster)", (await roster()).length === J0, `jobs=${J0}`);
evalJson('(() => { localStorage.setItem("cryoflow.selectedJob.v1", ""); return "un-owned"; })()');
ab("open http://localhost:3000");
sleep(3);
const wB = settle("the restored canvas");
if (corpse(wB, "Face B")) process.exit(1);
ok("B4 the world unharmed (canvas count == the opening count, zero unnamed, no dialogs)", wB.pageBtns === OPEN && wB.pageUnnamed === 0 && wB.hasDlg === false, `btns=${wB.pageBtns} (opening ${OPEN})`);
const seedAfter = evalJson('(() => JSON.stringify(localStorage.getItem("cryoflow.selectedJob.v1")))()');
ok("B5 the ride leaves no session seed", seedAfter === '""' || seedAfter === "null", `seed=${seedAfter}`);
const pendingEnd = evalJson('(() => JSON.stringify(sessionStorage.getItem("cryoflow:pending-view")))()');
ok("B6 no pending lingers (every handshake consumed)", pendingEnd === "null" || pendingEnd === null, `pending=${pendingEnd}`);

/* ---------- the ledger at birth (three faces) ---------- */
console.log("Ledger — the t861 birthright aboard from birth (three faces, the shared law)");
const prevFaces = cmp.prev?.faces ?? null;
const scalarOf = (m) => m.pageBtns;
const faces = {
  wallArrival: ledgerFace(prevFaces ? prevFaces.wallArrival?.live ?? null : null, w1s, scalarOf),
  paletteFace: ledgerFace(prevFaces ? prevFaces.paletteFace?.live ?? null : null, p2, scalarOf),
  worldBack: ledgerFace(prevFaces ? prevFaces.worldBack?.live ?? null : null, wB, scalarOf),
};
for (const [name, f] of Object.entries(faces)) {
  const v = armVerdict(cmp, world, f, RECEIPT_REVISION);
  ok(`L ${name} face ride-drift law`, !v.bites || v.ok, v.detail);
}

/* ---------- verdict + receipt ---------- */
const verdict = fail === 0
  ? `the saved-views family's PORT holds on its first living host: the gallery route answered and the host was MEASURED (never pinned — the cmuwipe world is gone, the port refuses its pins); the wall stood at three with the trio's bytes snapshotted (the un-own anchor), every card carrying its named X behind the hover contract; the palette's server-fed group spoke its heading and three rows with the thumbs REALLY rendering, the second open costing zero gallery requests (the TTL cache holds), the row's X speaking the slot-swap hover grammar; the JUMP rode drill one from the palette row through the inspector and the final-map tile to a REALLY-up viewer — the restored toast named the view AND its door ("Jumped here"), the pending consumed one-shot, and the second mount WITHOUT a re-jump restored nothing (the Task 81 law live); the wall's delete rode the CURRENT shape — the X's hover, the t793 QUESTION ("Delete saved view “${DRILL1_NAME}”?"), "Delete view" landing it, the shrink by broadcast with the marker proving zero reloads, the t817 after-state toast, the server confirming three; the honest NOT-FOUND rode drill two — cached into the palette, deleted server-side, the pending armed directly, a fresh viewer consuming it into "Saved view not found" naming "deleted", the pending consumed even for absences — and the palette's TTL expired and the row faded without a hand edit; the HOME MOUTH rode drill three — the B-key quick-save announced itself, the wall GREW by broadcast with the marker proving zero reloads, the palette's next open spoke five rows (the listener beat the TTL clock), the list's delete mouth took the row back, the update mouth re-captured the drill's thumb and the wall's card followed (fresh capture served) — every mouth the t671 walk named, now ridden live on the shelf's current law (the cap 8, the fingerprint rule); the exit swept the drills and PUT the trio back BYTE-FOR-BYTE (the exit's own pin), the roster bit-for-bit, the canvas ${OPEN} == ${OPEN}, no seed, no lingering pending — the ledger aboard from birth (three faces, arm 1)`
  : `${fail} red — the saved-views family's port moved (or the ride left residue); call the census's own instruments before any UI work`;

const driftLedger = {
  prevFound: cmp.prevFound,
  prevBuild: cmp.prevBuild,
  prevDate: cmp.prev?.date ?? null,
  sameBuild: cmp.sameBuild,
  law: LEDGER_LAW,
  faces,
};

const receipt = {
  instrument: "scripts/t877-saved-views-family.mjs",
  instrumentRevision: RECEIPT_REVISION,
  ruler: NAMEOF_LAW,
  build: world.id,
  worldMode: world.mode,
  date: new Date().toISOString(),
  chain: "clean room -> gallery route (the host measured) -> the wall's arrival (the trio, the named Xs, the hover contract) -> the palette group (the heading, the rows, the thumbs, the TTL cache, the row's X) -> MOUNT drill one -> the JUMP (palette row -> inspector -> Results -> the final-map tile -> View in 3D -> the fingerprint) -> the restored toast (the view + Jumped here) -> the pending consumed -> ONE-SHOT (the second mount restores nothing) -> the WALL DELETE (hover -> the t793 question -> Delete view -> the broadcast shrink -> the after-state toast -> the server confirms) -> MOUNT drill two -> the palette caches it -> DELETE server-side -> the pending armed -> the HONEST NOT-FOUND -> the pending consumed -> the TTL self-heal -> MOUNT drill three -> the HOME MOUTH (B saves -> the broadcast growth; the list deletes -> the broadcast shrink; the update re-captures -> the thumb follows) -> the drills swept -> the trio byte-for-byte -> worldBack + seed hygiene (one command)",
  doors: {
    gallery: "GET /api/views/gallery — the server-fed group the palette reads (the measured host's source)",
    seats: `GET/PUT /api/jobs/${host.jobId}/camera-bookmarks — the t707 headered lane (the drills' road in and out)`,
    wall: `[data-saved-view-card] + [data-saved-view-delete] — the t669 two-mouth card grown the t674 trio`,
    confirm: "the t793 AlertDialog (X -> the question -> the 'Delete view' action) — the shape the shadowed walks never saw",
    palette: "Control+k -> [data-palette-savedview-row] (the jump body) with the pencil + X pair (t674) — the jump mouth's palette dialect",
    pending: `${PENDING_KEY} { jobId, bookmarkId } — the one-shot handshake (t668's wire, t669's honest absence)`,
    viewer: "the roster's open door -> Results (mousedown) -> the final-map tile -> View in 3D -> the shelf's load fingerprint (the t671 rule)",
    homeMouth: "B quick-save / the list's Update + Delete bookmark buttons / commitBookmarks — the t671 single mutation path",
    broadcast: "SAVED_VIEWS_CHANGED_EVENT — the wall re-reads fresh (the marker witness: zero reloads)",
  },
  port: {
    from: "the t876 map's debt cluster (t668 deeplink, t669 notfound + wall delete, t670 palette delete, t671 third mouth)",
    law: "the label-as-will law closed loop — the debt walks' surfaces are this instrument's own labels now",
    redrawn: [
      "the t793 confirm dialog (the old X-click-shrinks is TWO doors)",
      "the t674 trio mouths at both surfaces (wall card + palette row)",
      "the t817 after-state toast (the remaining count rides)",
      "the shelf cap 8 + the fingerprint rule measured at the current product",
    ],
  },
  host: { id: host.jobId, name: host.jobName, type: host.jobType, measured: true },
  trio: { ids: TRIO_BYTES.map((s) => s.id), names: TRIO_BYTES.map((s) => s.name), bytesRestored: JSON.stringify(finalSeats) === JSON.stringify(TRIO_BYTES) },
  drills: [
    { id: DRILL1, name: DRILL1_NAME, fate: "mounted -> jumped (restored toast) -> deleted via the wall's X + the t793 confirm" },
    { id: DRILL2, name: DRILL2_NAME, fate: "mounted -> cached into the palette -> deleted server-side -> the honest not-found -> the TTL self-heal" },
    { id: DRILL3, name: DRILL3_NAME, fate: "mounted -> B-saved (View 5, then deleted via the list) -> thumb re-captured by the update mouth" },
  ],
  oneShot: { restoredFirst: !!restored1, secondMountRestoredNothing: !newToasts.some((t) => t.includes("restored")) },
  notFound: { toast: nfToast, pendingConsumed: pendingAfterN === "null" || pendingAfterN === null },
  broadcastWitness: { marker: "v-face", law: "the page instance never reloaded across the home-mouth leg" },
  openingCanvas: OPEN,
  faces: {
    wallArrival: { live: w1s },
    paletteFace: { live: p2 },
    worldBack: { live: wB },
  },
  checks: results,
  passed: pass,
  failed: fail,
  total: pass + fail,
  verdict,
  driftLedger,
};
writeFileSync(join(ROOT, RECEIPT), JSON.stringify(receipt, null, 2));

console.log(`\nSAVED-VIEWS-FAMILY t877: ${pass}/${pass + fail} ${fail === 0 ? "green" : "RED"}`);
console.log(`  receipt: ${RECEIPT}`);
process.exit(fail === 0 ? 0 : 1);
