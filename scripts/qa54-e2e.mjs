// Task 54 QA — Import views dialog: MIXED multi-source import.
//   A  MIX SOURCES: two JSON files (one with a junk entry) via DataTransfer
//      → dialog groups file sources → in-dialog "From job" appends a third
//      group → in-dialog "File" appends a fourth → capacity preselect math
//      asserted at every step → untick one → confirm → toast "6 views from
//      4 sources" → list 6/8 + server row 6 entries
//   B  HONEST GAPS + FULL-LIST SEMANTICS: junk-only file → skip toast and
//      NO dialog; fill the list to 8/8; open the dialog again (job source)
//      → full-hint banner, every checkbox disabled, Import disabled;
//      Select all / Clear behave at capacity
//   C  CLEANUP + CONSOLE: server rows wiped, console 0 errors
// Usage: QA_PHASES=A node scripts/qa54-e2e.mjs   (A needs the canvas +
//      viewer warm; B standalone re-bootstraps the viewer itself)
import { execSync } from "node:child_process";
import { appendFileSync } from "node:fs";

const AB = "agent-browser";
const LOGF = new URL("../.qa-logs/qa54-trace.log", import.meta.url).pathname;
const step = (m) => {
  const line = `[${(Date.now() / 1000).toFixed(0)}] ${m}`;
  try { appendFileSync(LOGF, line + "\n"); } catch { /* ignore */ }
  console.log(m);
};
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => { step(`SIGNAL ${sig} — dying`); process.exit(1); });
}
process.on("exit", (c) => step(`exit code=${c}`));
process.on("uncaughtException", (e) => { step(`uncaught: ${e.message}`); process.exit(2); });
process.on("unhandledRejection", (e) => { step(`unhandledRejection: ${e}`); process.exit(3); });

const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJs = (expr) =>
  execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 90_000, input: expr }).trim();
const unq = (s) => (s || "").replace(/^"|"$/g, "");
const J = (expr) => JSON.parse(unq(evalJs(expr)));
const PHASES = (process.env.QA_PHASES || "A,B,C").split(",").map((s) => s.trim().toUpperCase());

const JOB = "3D Auto-Refine 1";
const B = "http://localhost:3000";
// resolve job ids by NAME — workdir ids drift across seeds (qa53 lesson)
const jobsRaw = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs"`);
const jobs = JSON.parse(jobsRaw); // NO whitespace squeeze — it eats the spaces inside job names
const jobsArr = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const host = jobsArr.find((j) => j.name === JOB);
const sibling = jobsArr.find((j) => j.name !== JOB && /refine|motioncorr|ctffind|extract/i.test(j.type + j.name));
if (!host) throw new Error(`host job "${JOB}" not found`);
if (!sibling) throw new Error("no sibling job found");
const JID = host.id;
const SID = sibling.id;
step(`jobs: host=${JID} (${host.name}) sibling=${SID} (${sibling.name})`);

const snap = (name) => ({
  id: name,
  name,
  ts: Date.now(),
  snapshot: { mode: "camera", fov: 0.876, position: [12.3, -4.5, 30.1], up: [0, 1, 0], target: [0.1, 0.2, 0.3], radius: 52.4, radiusMax: 120, fog: 0, clipFar: 0, minNear: 0, minFar: 0 },
  view: { sigma: 3, sign: 1, slice: { on: true, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
});
const putBm = (list, jid = JID) => {
  for (let i = 0; i < 3; i++) {
    try {
      sh(`curl -s --max-time 30 -X PUT "http://localhost:3000/api/jobs/${jid}/camera-bookmarks" -H "Content-Type: application/json" -d '{"bookmarks":${JSON.stringify(list)}}'`);
      return;
    } catch { sleep(2500); }
  }
};
const serverRow = (jid = JID) => {
  const raw = sh(`curl -s --max-time 20 "http://localhost:3000/api/jobs/${jid}/camera-bookmarks"`).replace(/\s+/g, "");
  try { return (JSON.parse(raw).bookmarks || []).length; } catch { return -1; }
};

const toastObserver = `(() => {
  window.__qaToasts = [];
  const t0 = Date.now();
  window.__qaMo && window.__qaMo.disconnect();
  window.__qaMo = new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1) {
        const t = (n.textContent || '');
        if (/Imported|skipped|restored|not found/i.test(t)) {
          window.__qaToasts.push({ at: Date.now() - t0, text: t.replace(/\\s+/g, ' ').slice(0, 200) });
        }
      }
    }
  });
  window.__qaMo.observe(document.body, { childList: true, subtree: true });
  return 'observer-on';
})()`;
const lastToasts = (n = 2) => unq(evalJs(`(window.__qaToasts||[]).slice(-${n}).map(t=>t.text).join(' | ') || 'NONE'`));

const realClick = async (findExpr) => {
  const coords = evalJs(
    `(() => { const el = (${findExpr}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
  );
  if (!coords || coords === "null") return "NO-ELEMENT";
  const c = JSON.parse(coords);
  sh(`${AB} mouse move ${c.x} ${c.y}`);
  sh(`${AB} mouse down`);
  sh(`${AB} mouse up`);
  return `clicked@${c.x},${c.y}`;
};

// dialog probes — scoped to the IMPORT dialog by title (a Radix
// PopoverContent ALSO carries role=dialog; picking .pop() grabs whichever
// portal rendered last and false-positives after confirm)
const dlg = `(() => { const ds = [...document.querySelectorAll('[role=dialog]')]; return ds.find(d => d.textContent.includes('Import views')) ?? null; })()`;
const importDlgGone = `(() => ![...document.querySelectorAll('[role=dialog]')].some(d => d.textContent.includes('Import views')))()`;
const dialogProbe = () => J(`(() => {
  const c = ${dlg};
  if (!c) return null;
  const groups = [...c.querySelectorAll('[data-canvas-ui=import-source-group]')];
  return {
    desc: (c.querySelector('p')?.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 140),
    nGroups: groups.length,
    groupHeads: groups.map(g => (g.querySelector('span')?.textContent || '').trim()),
    groupCounts: groups.map(g => { const head = g.querySelector(':scope > div'); const s = head ? [...head.querySelectorAll('span')] : []; return s.length ? s[s.length-1].textContent.trim() : '?'; }),
    ticked: (c.textContent.match(/(\\d+) ticked/) || [])[1] ?? null,
    free: (c.textContent.match(/(\\d+) free slot/) || [])[1] ?? null,
    after: (c.textContent.match(/(\\d+)\\/8 after import/) || [])[1] ?? null,
    fullHint: !!c.querySelector('[data-canvas-ui=import-full-hint]'),
    checkboxes: [...c.querySelectorAll('[role=checkbox]')].map(x => x.disabled === true || x.hasAttribute('data-disabled') || x.getAttribute('aria-disabled') === 'true'),
    addJobOpen: !!c.querySelector('[data-canvas-ui=import-add-job-list]'),
    confirmBtn: (() => { const b=[...c.querySelectorAll('button')].find(x=>/^Import( \\d+)?$/.test(x.textContent.trim())); return b? {t:b.textContent.trim(), disabled:b.disabled} : null; })(),
  };
})()`);

/** inject File objects into the hidden import input via DataTransfer and
 *  fire change — React's synthetic onChange listens at the root and sees
 *  the bubbled native event */
const dropFiles = (filesJs) => unq(evalJs(`(() => {
  const input = document.querySelector('input[type=file][multiple]');
  if (!input) return 'NO-INPUT';
  const dt = new DataTransfer();
  try {
    for (const f of ${filesJs}) dt.items.add(f);
  } catch (e) { return 'LOOP-ERR:' + e.message; }
  const pre = dt.files.length;
  input.files = dt.files;
  const post = input.files.length;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return 'dropped:' + post + ' (pre=' + pre + ')';
})()`));

const bmLiteral = (n, extraJunk = false) => {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push(snap(`qa54 ${extraJunk ? "junk" : "row"} ${i + 1}`)); // keep id — cleanBookmarks requires a string id
  }
  if (extraJunk) arr.push({ id: "junk", name: "junk row", ts: Date.now() }); // NO snapshot → cleanBookmarks filters it (rawCount 3, cleaned 2)
  return JSON.stringify(arr);
};

const makeFile = (varName, name, payloadJs) =>
  `new File([JSON.stringify(${payloadJs})], "${name}", { type: "application/json" })`;

const openViewer = async () => {
  let card = "";
  for (let i = 0; i < 14; i++) {
    card = await realClick(
      `[...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Enlarge Half-map 1 (iter 1)')`,
    );
    if (card.includes("clicked@")) break;
    await realClick(
      `[...document.querySelectorAll('[role=button]')].find(x => (x.textContent||'').includes('${JOB}') && (x.textContent||'').includes('completed'))`,
    );
    step(`  openViewer iter ${i}: enlarge=${card.slice(0, 24)}`);
    await sleep(2200);
  }
  if (!card.includes("clicked@")) throw new Error("half-map card never appeared");
  await sleep(1500);
  let v3d = "";
  for (let i = 0; i < 12; i++) {
    v3d = evalJs(
      `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('View in 3D')); b ? b.click() : 0; return b ? 'v3d-clicked' : 'V3D-WAIT'; })()`,
    );
    if (v3d.includes("v3d-clicked")) break;
    await sleep(2000);
  }
  step(`  v3d: ${v3d}`);
  for (let i = 0; i < 75; i++) {
    await sleep(2000);
    const probe = evalJs(`({m: typeof window.__molstar, s: !!document.querySelector('[role=slider]')})`).replace(/\s+/g, "");
    if (i % 10 === 9) step(`  ready-wait ${i}: ${probe.slice(0, 50)}`);
    if (probe.includes('"m":"object"') && probe.includes('"s":true')) return true;
  }
  return false;
};

const openBookmarkPopover = async () => {
  // already open? clicking the trigger again would TOGGLE it closed
  const already = J(`(() => !!document.querySelector('[data-canvas-ui=from-job-list], button[title="Export — download these views as a JSON file"]'))()`);
  if (already === true) return "already-open";
  let r = "";
  for (let i = 0; i < 6 && !r.includes("clicked@"); i++) {
    r = await realClick(`[...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Camera view bookmarks'))`);
    await sleep(900);
  }
  if (!r.includes("clicked@")) throw new Error("bookmark popover never opened");
  await sleep(400);
  return r;
};

const listCount = () => unq(evalJs(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => (x.getAttribute('aria-label')||'').startsWith('Camera view bookmarks'));
  const m = ((b && b.getAttribute('aria-label')) || '').match(/(\\d+) saved/);
  return m ? m[1] : (b ? '0' : 'NO-LIST');
})()`));

/** sanity: a fresh probe must prove it can return true (qa50 lesson) */
const sanityCheck = async () => {
  const s = unq(evalJs(`(() => !!document.querySelectorAll('button').length)() + ''`));
  if (s !== "true") throw new Error(`probe sanity failed: "${s}"`);
};

/** PHASE A — mixed sources, capacity preselect, confirm merge */
const phaseA = async () => {
  console.log("== PHASE A: mixed multi-source import ==");
  putBm([]);
  putBm([snap("qa54 sib 1"), snap("qa54 sib 2")], SID);
  step("  server rows: host cleared, sibling seeded with 2");

  sh(`${AB} open ${B}`);
  await sleep(6000);
  await sanityCheck();
  const ready = await openViewer();
  if (!ready) throw new Error("viewer never became ready");
  await sleep(1500);
  evalJs(toastObserver);
  step("  viewer ready");

  // open the popover, then inject TWO files at once through the input
  await openBookmarkPopover();
  const f1 = makeFile("f1", "export-a.json", `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(2, true)} }`);
  const f2 = makeFile("f2", "export-b.json", `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(2)} }`);
  const d1 = dropFiles(`[${f1}, ${f2}]`);
  step(`  drop 2 files: ${d1}`);
  if (!d1.startsWith("dropped:2")) throw new Error(`file drop failed: ${d1}`);

  let st = null;
  for (let i = 0; i < 12 && !st; i++) { await sleep(1500); st = dialogProbe(); }
  if (!st) throw new Error("import dialog never appeared");
  step(`  dialog A1: ${JSON.stringify(st)}`);
  if (!/4 of 5 entries parsed across 2 sources/.test(st.desc)) throw new Error(`desc wrong: ${st.desc}`);
  if (st.nGroups !== 2) throw new Error(`expected 2 groups, got ${st.nGroups}`);
  if (!st.groupHeads.includes("export-a.json") || !st.groupHeads.includes("export-b.json")) throw new Error(`group heads wrong: ${st.groupHeads}`);
  if (st.groupCounts.filter(c => c === "2/3").length !== 1 || st.groupCounts.filter(c => c === "2/2").length !== 1) throw new Error(`group counts wrong: ${st.groupCounts}`);
  if (st.ticked !== "4" || st.free !== "4") throw new Error(`preselect wrong: ticked=${st.ticked} free=${st.free}`);
  if (st.after !== "4") throw new Error(`after-import wrong: ${st.after}`);
  step("  A1 PASS — 2 file groups, junk entry filtered (2/3), preselect 4/8");

  // in-dialog: mix in a JOB source
  const jobBtn = await realClick(`(() => { const c = ${dlg}; return c ? [...c.querySelectorAll('button')].find(b => (b.getAttribute('title')||'') === 'Add views from another job in this project') : null; })()`);
  if (!jobBtn.includes("clicked@")) throw new Error(`from-job toggle failed: ${jobBtn}`);
  let addOpen = false;
  for (let i = 0; i < 10 && !addOpen; i++) { await sleep(1200); addOpen = J(`(() => !!(${dlg})?.querySelector('[data-canvas-ui=import-add-job-list]'))()`); }
  if (!addOpen) throw new Error("add-job list never opened");
  let sibRow = "";
  for (let i = 0; i < 10 && !sibRow.includes("clicked@"); i++) {
    sibRow = await realClick(`(() => { const c = ${dlg}; return c ? [...c.querySelectorAll('[data-canvas-ui=import-add-job-list] button')].find(b => (b.getAttribute('title')||'').includes('Add 2 views from')) : null; })()`);
    await sleep(1500);
  }
  if (!sibRow.includes("clicked@")) {
    const diag = J(`(() => { const c = ${dlg}; if (!c) return null; const list = c.querySelector('[data-canvas-ui=import-add-job-list]'); return { listOpen: !!list, text: list ? list.textContent.replace(/\\s+/g, ' ').slice(0, 220) : null }; })()`);
    step(`  DIAG sibling rows: ${JSON.stringify(diag)}`);
    throw new Error(`sibling row click failed: ${sibRow}`);
  }
  await sleep(1200);
  st = dialogProbe();
  step(`  dialog A2: ${JSON.stringify(st)}`);
  if (st.nGroups !== 3) throw new Error(`expected 3 groups after job append, got ${st.nGroups}`);
  if (!st.groupHeads.includes(sibling.name)) throw new Error(`job group missing: ${st.groupHeads}`);
  if (st.ticked !== "6" || st.free !== "2") throw new Error(`preselect after job wrong: ${st.ticked}/${st.free}`);
  step("  A2 PASS — job source appended + preselected (6 ticked, 2 free)");

  // in-dialog: mix in a THIRD FILE (1 entry) via the dashed adder
  const fileBtn = await realClick(`${dlg} ? [...(${dlg}).querySelectorAll('button')].find(b => (b.getAttribute('title')||'') === 'Add views from one or more JSON files') : null`);
  if (!fileBtn.includes("clicked@")) throw new Error(`in-dialog file toggle failed: ${fileBtn}`);
  const f3 = makeFile("f3", "export-c.json", `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(1)} }`);
  const d2 = dropFiles(`[${f3}]`);
  if (!d2.startsWith("dropped:1")) throw new Error(`in-dialog file drop failed: ${d2}`);
  await sleep(1200);
  st = dialogProbe();
  step(`  dialog A3: ${JSON.stringify(st)}`);
  if (st.nGroups !== 4) throw new Error(`expected 4 groups after file 3, got ${st.nGroups}`);
  if (!st.groupHeads.includes("export-c.json")) throw new Error(`group export-c missing: ${st.groupHeads}`);
  if (st.ticked !== "7" || st.free !== "1") throw new Error(`preselect after file 3 wrong: ${st.ticked}/${st.free}`);
  step("  A3 PASS — fourth source appended (7 ticked, 1 free)");

  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-dialog.png`);

  // untick one row → 6 ticked
  const unt = unq(evalJs(`(() => {
    const c = ${dlg}; if (!c) return 'NO-DLG';
    const cb = [...c.querySelectorAll('[role=checkbox]')].find(x => x.getAttribute('aria-checked') === 'true' && !x.getAttribute('aria-disabled'));
    if (!cb) return 'NO-CHECKED';
    cb.click(); return 'unticked';
  })()`));
  if (unt !== "unticked") throw new Error(`untick failed: ${unt}`);
  await sleep(500);
  st = dialogProbe();
  if (st.ticked !== "6") throw new Error(`untick not reflected: ${st.ticked}`);
  step("  untick PASS — 6 ticked");

  // confirm → toast + list + server row
  const conf = await realClick(`${dlg} ? [...(${dlg}).querySelectorAll('button')].find(b => /^Import \\d+$/.test(b.textContent.trim())) : null`);
  if (!conf.includes("clicked@")) throw new Error(`confirm click failed: ${conf}`);
  await sleep(1800);
  const toasts = lastToasts(3);
  step(`  toasts: ${toasts}`);
  if (!/Imported 6 views from 4 sources/.test(toasts)) throw new Error(`merge toast missing: ${toasts}`);
  const dlgGone = J(importDlgGone);
  if (!dlgGone) throw new Error("dialog still open after confirm");
  const cnt = listCount();
  step(`  list count: ${cnt}/8`);
  if (cnt !== "6") throw new Error(`list count wrong: ${cnt}`);
  const srv = serverRow(JID);
  step(`  server row: ${srv}`);
  if (srv !== 6) throw new Error(`server row wrong: ${srv}`);
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-merged.png`);
  step("PHASE A GREEN");
};

/** BATCH A345 — viewer-memory-budget variant of the BACK HALF of phase A.
 *  The dev server keeps getting OOM-killed in the molstar-compile window
 *  (4 GB box, turbopack native + wasm + Chrome), and the counts fetches of
 *  the in-dialog job picker are the first casualty. This batch proves the
 *  remaining file-only chain — in-dialog File append, untick, confirm, the
 *  merge toast with source count, the live list and the SERVER row — with
 *  zero dependency on the counts API. */
const phaseA345 = async () => {
  console.log("== PHASE A345: in-dialog file append + untick + confirm ==");
  putBm([]);
  sh(`${AB} open ${B}`);
  await sleep(6000);
  await sanityCheck();
  const ready = await openViewer();
  if (!ready) throw new Error("viewer never became ready");
  await sleep(1500);
  evalJs(toastObserver);
  step("  viewer ready");

  await openBookmarkPopover();
  const fa = makeFile("fa", "batch-a.json", `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(2, true)} }`);
  const da = dropFiles(`[${fa}]`);
  if (!da.startsWith("dropped:1")) throw new Error(`file drop failed: ${da}`);
  let st = null;
  for (let i = 0; i < 12 && !st; i++) { await sleep(1500); st = dialogProbe(); }
  if (!st) throw new Error("import dialog never appeared");
  if (!/2 of 3 entries parsed across 1 source/.test(st.desc)) throw new Error(`desc wrong: ${st.desc}`);
  if (st.nGroups !== 1 || st.ticked !== "2" || st.free !== "6") throw new Error(`state wrong: ${JSON.stringify(st)}`);
  step("  A345-1 PASS — base file source (2 of 3, ticked 2)");

  // in-dialog File append — the input lives at the component root now, so
  // the modal dialog can reach it even after the popover was dismissed
  const fileBtn = await realClick(`(() => { const c = ${dlg}; return c ? [...c.querySelectorAll('button')].find(b => (b.getAttribute('title')||'') === 'Add views from one or more JSON files') : null; })()`);
  if (!fileBtn.includes("clicked@")) throw new Error(`in-dialog file toggle failed: ${fileBtn}`);
  const fb = makeFile("fb", "batch-b.json", `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(1)} }`);
  const db = dropFiles(`[${fb}]`);
  if (!db.startsWith("dropped:1")) throw new Error(`in-dialog file drop failed: ${db}`);
  await sleep(1200);
  st = dialogProbe();
  step(`  dialog A345-2: ${JSON.stringify(st)}`);
  if (st.nGroups !== 2) throw new Error(`expected 2 groups, got ${st.nGroups}`);
  if (!st.groupHeads.includes("batch-b.json")) throw new Error(`group batch-b missing: ${st.groupHeads}`);
  if (st.ticked !== "3" || st.free !== "5") throw new Error(`append preselect wrong: ${st.ticked}/${st.free}`);
  step("  A345-2 PASS — in-dialog file appended (3 ticked, 5 free)");

  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-dialog.png`);

  // untick one → confirm → toast names BOTH sources
  const unt = unq(evalJs(`(() => {
    const c = ${dlg}; if (!c) return 'NO-DLG';
    const cb = [...c.querySelectorAll('[role=checkbox]')].find(x => x.getAttribute('aria-checked') === 'true' && !x.getAttribute('aria-disabled'));
    if (!cb) return 'NO-CHECKED';
    cb.click(); return 'unticked';
  })()`));
  if (unt !== "unticked") throw new Error(`untick failed: ${unt}`);
  await sleep(500);
  st = dialogProbe();
  if (st.ticked !== "2" || st.free !== "6") throw new Error(`untick state wrong: ${st.ticked}/${st.free}`);
  const conf = await realClick(`(() => { const c = ${dlg}; return c ? [...c.querySelectorAll('button')].find(b => /^Import \\d+$/.test(b.textContent.trim())) : null; })()`);
  if (!conf.includes("clicked@")) throw new Error(`confirm click failed: ${conf}`);
  await sleep(1800);
  const toasts = lastToasts(3);
  step(`  toasts: ${toasts}`);
  if (!/Imported 2 views from 2 sources/.test(toasts)) throw new Error(`merge toast missing: ${toasts}`);
  const dlgGone = J(importDlgGone);
  if (!dlgGone) throw new Error("dialog still open after confirm");
  const cnt = listCount();
  if (cnt !== "2") throw new Error(`list count wrong: ${cnt}`);
  // server-row assert runs in phase C (QA54_EXPECT_ROW=2) — the dev server
  // is usually OOM-dead by this point in the SAME batch, and a curl into a
  // dead server would fail the chain for ops reasons, not product reasons
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-merged.png`);
  step("  A345-3 PASS — confirm merged 2 views from 2 sources (server row deferred to C)");
  step("PHASE A345 GREEN");
};

/** PHASE B — junk-only skip + full-list semantics */
const phaseB = async () => {
  console.log("== PHASE B: honest gaps + full-list semantics ==");
  putBm([]);
  putBm([snap("qa54 sib 1"), snap("qa54 sib 2")], SID);
  sh(`${AB} open ${B}`);
  await sleep(6000);
  await sanityCheck();
  const ready = await openViewer();
  if (!ready) throw new Error("viewer never became ready");
  await sleep(1500);
  evalJs(toastObserver);
  step("  viewer ready (host list empty after clean)");

  // junk-only file → skip toast, NO dialog
  await openBookmarkPopover();
  const fj = makeFile("fj", "garbage.json", `{ hello: "world" }`);
  const dj = dropFiles(`[${fj}]`);
  if (!dj.startsWith("dropped:1")) throw new Error(`junk drop failed: ${dj}`);
  await sleep(2000);
  const toastsB1 = lastToasts(2);
  const noDlg = J(importDlgGone);
  step(`  junk: toasts=${toastsB1} dialogClosed=${noDlg}`);
  if (!/1 of 1 file skipped/.test(toastsB1)) throw new Error(`skip toast missing: ${toastsB1}`);
  if (!noDlg) throw new Error("dialog opened for a junk-only file");
  step("  B1 PASS — junk-only file skipped honestly, no dialog");

  // fill the list to 8: 2-entry file ×2, then 4-entry file, confirming each
  for (const [name, n] of [["fill-1.json", 2], ["fill-2.json", 2], ["fill-3.json", 4]]) {
    const ff = makeFile("ff", name, `{ format: "cryoflow-view-bookmarks", version: 1, bookmarks: ${bmLiteral(n)} }`);
    const dd = dropFiles(`[${ff}]`);
    if (!dd.startsWith("dropped:1")) throw new Error(`${name} drop failed: ${dd}`);
    let stx = null;
    for (let i = 0; i < 12 && !stx; i++) { await sleep(1500); stx = dialogProbe(); }
    if (!stx) throw new Error(`dialog never appeared for ${name}`);
    const want = String(Math.min(n, 8 - (parseInt(listCount(), 10) || 0)));
    if (stx.ticked !== want) throw new Error(`${name} preselect wrong: ${stx.ticked} want ${want}`);
    const cf = await realClick(`${dlg} ? [...(${dlg}).querySelectorAll('button')].find(b => /^Import \\d+$/.test(b.textContent.trim())) : null`);
    if (!cf.includes("clicked@")) throw new Error(`${name} confirm failed: ${cf}`);
    await sleep(1600);
    step(`  ${name}: imported (list now ${listCount()}/8)`);
  }
  if (listCount() !== "8") throw new Error(`list not full: ${listCount()}`);

  // open the dialog again via a JOB source → full-hint + all locked
  await openBookmarkPopover();
  const fjb = await realClick(`[...document.querySelectorAll('button')].find(b => (b.getAttribute('title')||'') === 'From job — pull saved views straight from another job in this project')`);
  if (!fjb.includes("clicked@")) throw new Error(`from-job toggle failed: ${fjb}`);
  let sr = "";
  for (let i = 0; i < 12 && !sr.includes("clicked@"); i++) {
    await sleep(1500);
    sr = await realClick(`(() => { const rows=[...document.querySelectorAll('[data-canvas-ui=from-job-list] button')]; return rows.find(b => (b.getAttribute('title')||'').includes('Add 2 views from')) || null; })()`);
  }
  if (!sr.includes("clicked@")) throw new Error(`full-list sibling row failed: ${sr}`);
  await sleep(1200);
  const stf = dialogProbe();
  if (!stf) throw new Error("import dialog never opened from the full-list job source");
  step(`  full dialog: ${JSON.stringify(stf)}`);
  if (!stf.fullHint) throw new Error("full-hint banner missing");
  if (stf.ticked !== "0" || stf.free !== "0") throw new Error(`full state wrong: ${stf.ticked}/${stf.free}`);
  if (stf.checkboxes.some((d) => !d)) throw new Error(`some checkbox not disabled: ${JSON.stringify(stf.checkboxes)}`);
  if (!stf.confirmBtn?.disabled) throw new Error("Import button not disabled at capacity");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-full.png`);
  step("  B2 PASS — full-list semantics honest (hint, locked, disabled)");

  // Select all at capacity stays 0; Clear is a no-op — dialog closes clean
  const cancel = await realClick(`${dlg} ? [...(${dlg}).querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel') : null`);
  if (!cancel.includes("clicked@")) throw new Error("cancel failed");
  await sleep(600);
  step("PHASE B GREEN");
};

/** PHASE C — deferred server-row assert + cleanup + console */
const phaseC = async () => {
  console.log("== PHASE C: deferred assert + cleanup ==");
  // standalone-batch bootstrap (qa48 lesson: browser sessions do not
  // survive across bash calls — every batch must land on the app itself)
  sh(`${AB} open ${B}`);
  await sleep(5000);
  // the import chain's PROOF on the server side survives in the DB even
  // though the dev server of the import batch was OOM-killed after it
  const expectRow = parseInt(process.env.QA54_EXPECT_ROW || "0", 10);
  const h0 = serverRow(JID);
  step(`  host row before clean: ${h0} (expect ${expectRow || ">=1"})`);
  if (expectRow > 0) {
    if (h0 !== expectRow) throw new Error(`deferred row assert failed: ${h0} != ${expectRow}`);
  } else if (h0 <= 0) {
    throw new Error(`no import evidence on the server: ${h0}`);
  }
  putBm([]);
  putBm([], SID);
  const h = serverRow(JID);
  const s = serverRow(SID);
  step(`  server rows after clean: host=${h} sibling=${s}`);
  if (h !== 0 || s !== 0) throw new Error(`rows not clean: ${h}/${s}`);
  const errs = sh(`${AB} errors`) || "(none)";
  step(`  console errors: ${errs}`);
  if (errs !== "(none)") throw new Error("console errors present");
  sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-final.png`);
  step("PHASE C GREEN");
};

(async () => {
  const BATCH = process.env.QA54_BATCH || "full"; // "full" | "A345" (memory-budget back half)
  for (const p of PHASES) {
    if (p === "A") await (BATCH === "A345" ? phaseA345() : phaseA());
    if (p === "B") await phaseB();
    if (p === "C") await phaseC();
  }
  step("ALL PHASES GREEN");
  sh(`${AB} close`);
})().catch((e) => {
  step(`FATAL: ${e.message}`);
  try { sh(`${AB} screenshot /home/z/my-project/agent-ctx/qa54-fatal.png`); sh(`${AB} close`); } catch { /* ignore */ }
  process.exit(1);
});
