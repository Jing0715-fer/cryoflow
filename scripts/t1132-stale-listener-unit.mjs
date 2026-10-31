/**
 * t1132-stale-listener-unit — the 77th census seat: the stale-listener law
 * made REPO-WIDE (the t1131 cure's generalization, the sweep promoted to a
 * standing instrument).
 *
 * The law (t1131, live-caught on the t661 clip wire): a window/document
 * addEventListener registered inside an EMPTY-deps useEffect and reaching
 * an intent applier DIRECTLY freezes the first-render closure forever —
 * the applier's captured state (the `phase` gate) is unreachable, while
 * Fast Refresh re-subscriptions feed "it works" false positives. The cure
 * is the family's ref: `xxxIntentRef.current(...)`.
 *
 * This seat scans every []-deps effect in src/** and classifies every
 * listener registration:
 *   OK-REF      the handler reaches state through `.current` (the law)
 *   OK-AUDITED  the handler body is hash-pinned in this seat's audit table
 *               (26 sites, each opened and human-judged this window:
 *               setState setters, store .getState() actions, module-scope
 *               pure fns, DOM-arg-only bodies)
 *   VIOLATION   anything else — an un-audited direct handler. RED means:
 *               judge it, route it through a ref if it captures render
 *               state, then enroll its hash with the reason named.
 *
 * Pins:
 *   A  the world's shape: 37 listener registrations in []-deps effects
 *   B  11 OK-REF carriers, spot-named (slice/clip/sheet intent refs — the
 *      t1131 cure riding its family)
 *   C  all 26 audited bodies unchanged (hash pins — an edit re-opens the
 *      audit honestly instead of silently drifting)
 *   D  teeth on a synthetic fixture: a direct-applier []-deps listener is
 *      caught; its ref-routed twin is OK-REF (the scanner can actually
 *      catch the disease it polices)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import url from "node:url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

let pass = 0, fail = 0;
const ok = (cond, label) => {
  if (cond) { pass++; console.log(`  ok ${label}`); }
  else { fail++; console.log(`  RED ${label}`); }
};

/* ---------------- the scanner ---------------- */

function findMatching(src, openIdx, openCh, closeCh) {
  let depth = 0, i = openIdx, inS = null;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (inS) {
      if (c === "\\") { i += 2; continue; }
      if (c === inS) inS = null;
    } else if (c === "'" || c === '"' || c === "`") inS = c;
    else if (c === openCh) depth++;
    else if (c === closeCh) { depth--; if (depth === 0) return i; }
    i++;
  }
  return -1;
}

const STABLE_VERB =
  /^(set[A-Z]\w*|router|console|window|document|navigator|e|ev|event|stopPropagation|preventDefault|localStorage|sessionStorage|requestAnimationFrame|clearTimeout|clearInterval|setTimeout|setInterval|cancelAnimationFrame|AbortController|fetch|JSON|Math|Number|String|Boolean|Array|Object|Date|performance|crypto|atob|btoa)$/;

function blankStrings(body) {
  // length-preserving — string content is masked but offsets stay honest
  return body.replace(/`(?:[^`\\]|\\.)*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, (m) =>
    m[0] + "~".repeat(Math.max(0, m.length - 2)) + m[m.length - 1]
  );
}

function resolveNamed(name, effectBody) {
  const esc = name.replace(/\$/g, "\\$");
  const pats = [
    new RegExp(`const\\s+${esc}\\s*(?::[^=]+)?=\\s*`),
    new RegExp(`function\\s+${esc}\\s*\\([^)]*\\)\\s*\\{`),
    new RegExp(`let\\s+${esc}\\s*(?::[^=]+)?=\\s*`),
  ];
  for (const pat of pats) {
    const m = pat.exec(effectBody);
    if (!m) continue;
    const from = m.index + m[0].length;
    const rest = effectBody.slice(from);
    const arrow = /^(?:async\s*)?(?:\([^)]*\)|[\w$]+)\s*(?::[^=]*)?=>\s*/.exec(rest);
    if (arrow) {
      const after = rest.slice(arrow[0].length).trimStart();
      if (after.startsWith("{")) {
        const bOpen = effectBody.indexOf("{", from + arrow[0].length);
        const bClose = findMatching(effectBody, bOpen, "{", "}");
        if (bClose > 0) return effectBody.slice(bOpen + 1, bClose);
      }
      return after;
    }
    if (rest.trimStart().startsWith("{")) {
      const bOpen = effectBody.indexOf("{", from);
      const bClose = findMatching(effectBody, bOpen, "{", "}");
      if (bClose > 0) return effectBody.slice(bOpen + 1, bClose);
    }
  }
  return null;
}

function scanSource(src, relFile) {
  const hits = [];
  for (const m of src.matchAll(/useEffect\s*\(/g)) {
    const openIdx = m.index + m[0].length - 1;
    const closeIdx = findMatching(src, openIdx, "(", ")");
    if (closeIdx < 0) continue;
    const body = src.slice(openIdx + 1, closeIdx);
    if (!/(?:^|[{,]\s*|\)\s*,\s*)\[\s*\]\s*;?\s*$/.test(body.trim())) continue;
    const bodyNostr = blankStrings(body);
    for (const a of bodyNostr.matchAll(/(window|document)\s*\.\s*addEventListener\s*\(/g)) {
      const aOpenRel = a.index + a[0].length - 1; // index within body
      const aCloseRel = findMatching(bodyNostr, aOpenRel, "(", ")");
      if (aCloseRel < 0) continue;
      // event/handler text from the ORIGINAL body (same offsets, real strings)
      const argsReal = body.slice(aOpenRel + 1, aCloseRel);
      const line = src.slice(0, openIdx + 1 + aOpenRel).split("\n").length;
      const parts = [];
      let depth = 0, cur = "", inS = null;
      for (let i = 0; i < argsReal.length; i++) {
        const c = argsReal[i];
        if (inS) { cur += c; if (c === inS) inS = null; continue; }
        if (c === "'" || c === '"' || c === "`") { inS = c; cur += c; continue; }
        if (c === "(" || c === "[" || c === "{") { depth++; cur += c; continue; }
        if (c === ")" || c === "]" || c === "}") { depth--; cur += c; continue; }
        if (c === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue; }
        cur += c;
      }
      parts.push(cur.trim());
      const eventName = (parts[0] ?? "").replace(/^["'`]|["'`]$/g, "");
      const handler = parts[1] ?? "";
      if (!handler) continue;
      hits.push({ file: relFile, line, eventName, handler, effectBody: bodyNostr });
    }
  }
  return hits;
}

function handlerBody(hit) {
  const h = hit.handler.trim();
  const arrow = /^(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>\s*/.exec(h);
  if (arrow) {
    const rest = h.slice(arrow[0].length).trimStart();
    if (rest.startsWith("{")) {
      const bClose = findMatching(h, h.indexOf("{"), "{", "}");
      return bClose > 0 ? h.slice(h.indexOf("{") + 1, bClose) : rest;
    }
    return rest;
  }
  const name = h.split("(")[0].split(".")[0].trim();
  return resolveNamed(name, hit.effectBody) ?? h;
}

function classify(hit) {
  const body = handlerBody(hit);
  if (/\.\s*current/.test(body)) return { cls: "OK-REF", body };
  const calls = [];
  for (const c of body.matchAll(/\b([a-zA-Z_$][\w$]*)\s*\(/g)) {
    if (STABLE_VERB.test(c[1])) continue;
    if (/^(useRef|useCallback|useEffect|useMemo|useState)$/.test(c[1])) continue;
    calls.push(c[1]);
  }
  return { cls: calls.length ? "SUSPECT" : "OK-STABLE", body, calls: [...new Set(calls)] };
}

const normBody = (b) =>
  b.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ").replace(/\s+/g, " ").trim();
const bodyHash = (b) =>
  crypto.createHash("sha1").update(normBody(b)).digest("hex").slice(0, 12);

/* ---------------- collect the world ---------------- */

function collect() {
  const hits = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if ((f.name.endsWith(".tsx") || f.name.endsWith(".ts")) && !f.name.endsWith(".d.ts")) {
        const rel = path.relative(SRC, p).split(path.sep).join("/");
        hits.push(...scanSource(fs.readFileSync(p, "utf8"), rel));
      }
    }
  };
  walk(SRC);
  return hits;
}

/* ---------------- the audit table (26 sites, judged 2026-11-01) ----------------
 * key = `${file} :: ${event} :: ${handler}` → [{hash, why}]. Two effects in
 * map-ortho-panel share file+event+handler (two adopt mouths) — the array
 * carries both, each hash distinct. An edited body changes its hash and the
 * seat REDs: the audit re-opens honestly instead of drifting silently.
 */
const AUDITED = {
  "components/ai/assistant-panel.tsx :: resize :: onResize": [
    { why: "setState functional updater + file-scope pure clampGeo/defaultGeo" },
  ],
  "components/workflow/app-shell.tsx :: visibilitychange :: onVis": [
    { why: "useState setter + useWorkflowStore.getState().pollTick()" },
  ],
  "components/workflow/app-shell.tsx :: keydown :: onKeyDown": [
    { why: "Escape ladder — store getState() actions + DOM queries only" },
    { why: "Shift+D view flip — store getState() actions + DOM queries only" },
  ],
  "components/workflow/app-shell.tsx :: BULK_DELETE_EVENT :: onBulkDeleteRequest": [
    { why: "store getState() + useState setter" },
  ],
  "components/workflow/canvas-find-bar.tsx :: keydown :: onKey": [
    { why: "store getState().openFind()" },
  ],
  "components/workflow/command-palette.tsx :: USER_PARAM_PRESETS_EVENT :: onPresetsChanged": [
    { why: "useState setter + module-scope loadUserParamPresets()" },
  ],
  "components/workflow/command-palette.tsx :: SAVED_VIEWS_CHANGED_EVENT :: onSavedViewsChanged": [
    { why: "file-scope function refreshSavedViewsCache()" },
  ],
  "components/workflow/command-palette.tsx :: keydown :: onKeyDown": [
    { why: "setOpen((v) => !v) — useState setter" },
  ],
  "components/workflow/command-palette.tsx :: OPEN_EVENT :: onOpenRequest": [
    { why: "setOpen(true) — useState setter" },
  ],
  "components/workflow/drop-import.tsx :: dragover :: swallow": [
    { why: "e.preventDefault() only (the t92 navigation guard)" },
  ],
  "components/workflow/drop-import.tsx :: drop :: swallow": [
    { why: "e.preventDefault() only (the t92 navigation guard)" },
  ],
  "components/workflow/header.tsx :: SESSION_REPORT_EVENT :: open": [
    { why: "setReportOpen(true) — useState setter" },
  ],
  "components/workflow/header.tsx :: STORAGE_OPEN_EVENT :: open": [
    { why: "setStorageOpen(true) — useState setter" },
  ],
  "components/workflow/header.tsx :: SYSTEM_DIAGNOSTICS_EVENT :: open": [
    { why: "setDiagOpen(true) — useState setter" },
  ],
  "components/workflow/remote-cluster-dialog.tsx :: REMOTE_CLUSTERS_OPEN_EVENT :: openit": [
    { why: "setOpen(true) — useState setter" },
  ],
  "components/workflow/results/map-ortho-panel.tsx :: OBLIQUE_CLIP_EVENT :: onClip": [
    { why: "panel-side adopt() — setState setters only (setObliqueCut)" },
    { why: "plate-side adopt() — setState setters only (setPlateOblique)" },
  ],
  "components/workflow/results/map-ortho-panel.tsx :: OBLIQUE_CLIP_STATE_EVENT :: onAck": [
    { why: "panel-side adopt() — setState setters only" },
    { why: "plate-side adopt() — setState setters only" },
  ],
  "components/workflow/results/map-ortho-panel.tsx :: ORTHO_SIGMA_STATE_EVENT :: onSigmaState": [
    { why: "setIsoSigma — useState setter" },
  ],
  "components/workflow/results/map-ortho-panel.tsx :: ORTHO_CAMERA_STATE_EVENT :: onCameraState": [
    { why: "setters + file-scope pure cameraDirToAngles" },
  ],
  "components/workflow/results/molstar-embed.tsx :: OBLIQUE_VIEW_EVENT :: onObliqueView": [
    { why: "applyViewPreset reads ONLY pluginRef.current — de-facto ref-safe" },
  ],
  "components/workflow/user-preset-shelf.tsx :: USER_PARAM_PRESETS_EVENT :: refresh": [
    { why: "useState setter + module-scope load/reconcile fns" },
  ],
  "lib/use-finish-knock.ts :: visibilitychange :: onVis": [
    { why: "clearKnocks — module store function (the module-observable family)" },
  ],
  "lib/use-tab-census.ts :: visibilitychange :: onVis": [
    { why: "setHidden — useState setter" },
  ],
};

/* ---------------- run ---------------- */

console.log("== t1132 stale-listener unit — the law repo-wide ==");

const hits = collect();
console.log(`  swept ${hits.length} listener registrations in []-deps effects`);
ok(hits.length === 37, `A1 the sweep finds the standing 37 registrations (found ${hits.length})`);

const classified = hits.map((h) => ({ ...h, ...classify(h) }));
const refs = classified.filter((h) => h.cls === "OK-REF");

ok(refs.length === 11, `B1 11 OK-REF carriers (found ${refs.length})`);
const byEvent = (file, ev) =>
  classified.filter((h) => h.file === file && h.eventName === ev);
const mol = "components/workflow/results/molstar-embed.tsx";
ok(byEvent(mol, "OBLIQUE_CLIP_EVENT").every((h) => h.cls === "OK-REF"),
  "B2 OBLIQUE_CLIP_EVENT rides the ref (the t1131 cure lives)");
ok(byEvent(mol, "ORTHO_SLICE_EVENT").every((h) => h.cls === "OK-REF"),
  "B3 ORTHO_SLICE_EVENT rides the ref (the family's law-giver)");
ok(byEvent(mol, "OBLIQUE_SHEET_EVENT").every((h) => h.cls === "OK-REF"),
  "B4 OBLIQUE_SHEET_EVENT rides the ref");

// C — every non-ref listener is enrolled in the receipt (bootstrap then assert).
// The receipt shots-qa/t1132-stale-listener-hashes.json is the standing
// judgment: key → [{hash, why}]. First run bootstraps it from the live
// sweep (this window's manual audit); every later run asserts the live
// bodies still match the enrolled hashes — an edit re-opens the audit
// honestly instead of drifting silently.
const RECEIPT = path.join(ROOT, "shots-qa", "t1132-stale-listener-hashes.json");
const live = []; // {key, hash} in sweep order
for (const h of classified) {
  if (h.cls === "OK-REF") continue;
  live.push({ key: `${h.file} :: ${h.eventName} :: ${h.handler.trim()}`, hash: bodyHash(h.body) });
}
const auditedCount = Object.values(AUDITED).reduce((n, a) => n + a.length, 0);
const enrolledKeys = Object.keys(AUDITED).length;

if (!fs.existsSync(RECEIPT)) {
  // bootstrap: assign each live hit a slot in its key's entry list (encounter order)
  const receipt = {};
  const cursor = {};
  for (const { key, hash } of live) {
    const idx = cursor[key] ?? 0;
    const whys = AUDITED[key];
    if (!whys || idx >= whys.length) {
      console.log(`  RED C-bootstrap ${key} has no audit-table slot — extend AUDITED first`);
      process.exit(1);
    }
    (receipt[key] ??= []).push({ hash, why: whys[idx].why });
    cursor[key] = idx + 1;
  }
  fs.writeFileSync(RECEIPT, JSON.stringify(receipt, null, 2) + "\n");
  const n = Object.values(receipt).reduce((s, a) => s + a.length, 0);
  ok(n === 26 && Object.keys(receipt).length === enrolledKeys,
    `C0 receipt bootstrapped: the audited 26 enrolled (${n} across ${Object.keys(receipt).length} keys)`);
} else {
  const receipt = JSON.parse(fs.readFileSync(RECEIPT, "utf8"));
  const consumed = new Set(); // `key#${i}`
  const problems = [];
  for (const { key, hash } of live) {
    const entries = receipt[key];
    if (!entries) { problems.push(`UNENROLLED ${key} [${hash}]`); continue; }
    const i = entries.findIndex((e, i) => e.hash === hash && !consumed.has(`${key}#${i}`));
    if (i < 0) {
      problems.push(
        `HASH-DRIFT ${key} [live ${hash} vs enrolled ${entries.map((e) => e.hash).join(",")}]`
      );
      continue;
    }
    consumed.add(`${key}#${i}`);
  }
  ok(problems.length === 0, `C1 every non-ref listener matches its enrolled hash (problems: ${problems.length})`);
  for (const m of problems.slice(0, 10)) console.log(`    ${m}`);
  const receiptEntries = Object.values(receipt).reduce((n, a) => n + a.length, 0);
  ok(consumed.size === receiptEntries,
    `C2 the receipt is fully consumed (${consumed.size}/${receiptEntries})`);
  ok(receiptEntries === 26 && Object.keys(receipt).length === enrolledKeys && auditedCount === 26,
    `C3 the receipt carries the audited 26 (${receiptEntries} entries / ${Object.keys(receipt).length} keys / table ${auditedCount})`);
}

// D — teeth on a synthetic fixture
const FIX_DIRECT = `
import React from "react";
function Fake() {
  const [phase, setPhase] = React.useState("loading");
  const applyObliqueClipIntent = (d) => setPhase(String(d.offset));
  React.useEffect(() => {
    const onClip = (e) => { applyObliqueClipIntent(e.detail); };
    window.addEventListener("cf:clip", onClip);
    return () => window.removeEventListener("cf:clip", onClip);
  }, []);
  return null;
}
`;
const FIX_REF = FIX_DIRECT.replace(
  "const applyObliqueClipIntent = (d) => setPhase(String(d.offset));",
  "const applyObliqueClipIntentRef = React.useRef(applyObliqueClipIntent);"
).replace("applyObliqueClipIntent(e.detail);", "applyObliqueClipIntentRef.current(e.detail);");
const fd = scanSource(FIX_DIRECT, "fixture-direct.tsx");
const fr = scanSource(FIX_REF, "fixture-ref.tsx");
ok(fd.length === 1 && classify(fd[0]).cls === "SUSPECT",
  "D1 the synthetic direct-applier listener is caught (SUSPECT)");
ok(fr.length === 1 && classify(fr[0]).cls === "OK-REF",
  "D2 the ref-routed twin is classified OK-REF");

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1132 stale-listener unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
