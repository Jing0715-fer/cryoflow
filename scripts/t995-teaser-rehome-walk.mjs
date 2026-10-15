#!/usr/bin/env node
/**
 * t995 — THE TEASER'S RE-HOME WALK: the negative leg's first LIVE
 * browser witness since the t994 flip left it homeless. The t995 mint
 * (scripts/t995-custom-error-mint.mjs) made the unit's N19 story flesh
 * — a wrapper-level 127 death (the modulefile's RELION build retired,
 * bash's "command not found", the wrapper's own exit narration) whose
 * full log matches ZERO signature rows and ends on no live frame, so
 * diagnoseFailureLines answers ZERO end to end. This walk witnesses
 * what that ZERO looks like in the product, at every surface the
 * family has a name for:
 *
 *   SEGMENT A — THE NEGATIVE TEASER on the t995 face ("Custom Error
 *   Face (t995)"): the inspector opens on the LOG tab (the smart
 *   default — the failed face's honest first answer, witnessed on the
 *   zero face too), the Overview card is the ZINC negative (calm, not
 *   rose — "nothing found" is information), its aria verdict "No known
 *   failure signature matched the full log", the count chip "0
 *   findings", ZERO data-ovd-chip rows, the note's own sentence ("the
 *   cause is custom to this job. The log is the ground truth"), and
 *   the jump button says "Read the full log" — the negative card's
 *   quieter verb.
 *
 *   THE ZERO LEG'S JUMP — the strip's honest ABSENCE, witnessed live
 *   for the first time: "Read the full log" lands the Log tab in Full
 *   mode where the findings.length > 0 gate keeps the strip ABSENT by
 *   design (the t976/t994 walks witnessed the strip's RETURN on
 *   flipped faces; this is the gate's other side, on a live face) —
 *   the console stands alone, zero data-finding rows anywhere in the
 *   dialog, the log itself the answer.
 *
 *   SEGMENT B — THE COHERENCE: the zero leg lives BESIDE the positive
 *   legs without stealing their verdicts — the t976 cancelled face
 *   still speaks EXACTLY ONE scheduler-cancelled chip (the t994 flip
 *   holds), and the t970 failed face still speaks the POSITIVE teaser
 *   with its 2 chips. The three-state law's faces, all live at once.
 *
 * The organs are the kit's (scripts/walk-kit.mjs); the walk-local
 * helpers carry the t994 grammar verbatim (findAndCenter with the
 * self-close law, openInspectorHard, clickTab, selTabExpr,
 * openOverviewRead with the settle-race retry + flicker re-open, the
 * walkExpr probe) re-aimed at the zero face. The jump rides wide (the
 * red-8 law) and the fold reads through the card gate (the red-2/red-10
 * lessons, patience 24×600).
 *
 * Receipt: shots-qa/t995-teaser-rehome-walk.json (+ the PNGs).
 *   node scripts/t995-teaser-rehome-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const w = createWalk({ name: "t995-teaser-rehome-walk", receiptFile: "t995-teaser-rehome-walk.json" });
const {
  AB, BASE, QA_DIR,
  ok, sleep, sh, evalJs, evalJson, poll, pollTraced,
  realClick, shot, serverFirst, readJobs, jobsArr, fingerprint, wideFirst, finish,
} = w;

const ZERO_NAME = "Custom Error Face (t995)";      // the re-homed negative leg's face
const FLIP_NAME = "Cancelled Diagnosis Face (t976)"; // the t994 flip's face — the coherence leg
const POS_NAME = "Failed Diagnosis Face (t970)";   // the three-state law's positive teaser

console.log("== t995 the teaser's RE-HOME (the zero leg's live browser witness) + the coherence ==");
await serverFirst();

/* ---------------- leg 0: the as-found world ---------------- */
const jobsBody = await readJobs();
if (!jobsBody) { console.log("FATAL: the jobs API never answered"); process.exit(2); }
const jobs = jobsArr(jobsBody);
const fpAsFound = fingerprint(jobs, null);
const zeroJob = jobs.find((j) => j.name === ZERO_NAME);
const posJob = jobs.find((j) => j.name === POS_NAME);
ok("the as-found world holds the t995 face, failed (the mint's row-flip)", !!zeroJob && zeroJob.status === "failed", zeroJob ? `${zeroJob.id} status=${zeroJob.status}` : "missing");
ok("the as-found world holds the t970 face too (the positive leg's keeper, failed)", !!posJob && posJob.status === "failed", posJob ? `${posJob.id} status=${posJob.status}` : "missing");
/* the t992 birth law (c): the count NAMES the mint — the t995 custom-error
 * face joined this window (the teaser's re-home); the world grew by ONE. */
ok("the as-found world holds TWENTY-TWO jobs (the standing fleet restored (the t1003 restoration — 15 demo + seven standing faces))", jobs.length === 22, `n=${jobs.length}`);

/* ---------------- leg 1: the wide-first opening (the kit's law) ---------------- */
const first = await wideFirst();
if (!first?.alive) { console.log("FATAL: the world never rendered"); process.exit(2); }

/* ---------------- the walk-local probe grammar (the t994 organs, re-aimed) ---------------- */
/* the find-bar opener — the t994 grammar verbatim: the bar CENTERS the
 * job, then CLOSES ITSELF (the t994 red-3/red-5 law: an open find bar's
 * matches re-render drops focus outside the Radix dialog the next leg
 * opens, and Radix reads focus-outside as leave) */
const findAndCenter = async (needle) => {
  const alreadyOpen = evalJson(`(() => { const b = document.querySelector('[aria-label="Find jobs by name, type, or key:value parameter query"]'); return JSON.stringify({ open: !!b && b.getBoundingClientRect().width > 0 }); })()`);
  if (!(alreadyOpen && alreadyOpen.open)) {
    const btn = await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
    if (!String(btn).startsWith("clicked@")) return "NO-FIND-BAR";
    await sleep(700);
  }
  const box = `[aria-label="Find jobs by name, type, or key:value parameter query"]`;
  sh(`${AB} fill '${box}' '${needle}'`);
  await sleep(900);
  const matchBtn = await evalJson(`(() => { const b = [...document.querySelectorAll('button')].find(x => /^\\d+ match(es)?$/.test((x.textContent || '').trim()) && x.getBoundingClientRect().width > 0); if (!b) return null; const r = b.getBoundingClientRect(); return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
  if (!matchBtn || !matchBtn.x) return "NO-MATCH";
  sh(`${AB} mouse move ${matchBtn.x} ${matchBtn.y}`); sh(`${AB} mouse down`); sh(`${AB} mouse up`);
  await sleep(900);
  await realClick(`[...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Find jobs on canvas') ?? null`);
  await poll(
    `(() => { const b = document.querySelector('[aria-label="Find jobs by name, type, or key:value parameter query"]'); return JSON.stringify({ gone: !b || b.getBoundingClientRect().width === 0 }); })()`,
    (v) => v.gone, 8, 400,
  );
  await sleep(400);
  return `centered:${needle}`;
};

const openInspectorHard = async (name, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`[...document.querySelectorAll('[data-job]')].find(c => (c.textContent || '').includes('${name}'))?.querySelector('[role="button"][tabindex]')`);
    const opened = await poll(
      `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(d => (d.textContent || '').includes('${name}')); return JSON.stringify({ open: !!d }); })()`,
      (v) => v.open === true, 5, 500,
    );
    if (opened?.open === true) return `open@try${i}`;
    try { sh(`${AB} press Escape`); } catch {}
    await sleep(700);
  }
  return "NEVER-OPEN";
};

const clickTab = async (name, label, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    const clicked = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); return [...(d?.querySelectorAll('[role="tab"]') ?? [])].find(t => (t.textContent || '').trim().startsWith('${label}')) ?? null; })()`);
    if (String(clicked).startsWith("clicked@")) return clicked;
    await sleep(800);
  }
  return "NEVER-CLICKED";
};

/* the selected-tab probe — the smart default read (a failed face's
 * inspector opens on the LOG tab; witnessed on the zero face too) */
const selTabExpr = (name) => `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); if (!d) return JSON.stringify({ err: "no-dialog" }); const sel = [...(d.querySelectorAll('[role="tab"]') ?? [])].find(t => t.getAttribute('aria-selected') === 'true'); return JSON.stringify({ selected: (sel?.textContent || '').trim() }); })()`;

/* the Overview reader — the t994 grammar verbatim: verify the dialog is
 * HERE each round (the flicker re-open), click Overview, POLL the
 * VISIBLE panel for the card (the inactive panels unmount — a found
 * card IS the Overview panel showing), retry on the settle race */
const openOverviewRead = async (name, rounds = 4) => {
  for (let i = 0; i < rounds; i++) {
    const here = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); return JSON.stringify({ here: !!d }); })()`);
    if (!here?.here) {
      const reopened = await openInspectorHard(name, 3);
      console.log(`  (round ${i}: the dialog flickered away — re-open: ${reopened})`);
      await sleep(800);
    }
    const clicked = await clickTab(name, "Overview", 2);
    if (String(clicked).startsWith("clicked@")) {
      const read = await pollTraced(walkExpr(name), (v) => v && !v.err && !!v.card, 10, 600, `ovr${i}`);
      if (read && !read.err && read.card) return read;
    }
    await sleep(600);
  }
  return null;
};

/* the card's named probes — the t994 walkExpr carried verbatim (every
 * shape measured at its address; leg-agnostic) */
const walkExpr = (name) => `(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const panels = [...dlg.querySelectorAll('[role="tabpanel"]')].filter(p => p.getBoundingClientRect().width > 0);
  if (!panels.length) return JSON.stringify({ err: "no-visible-panel" });
  const panel = panels[0];
  const offenders = [];
  const selfClipping = (el) => {
    const s = getComputedStyle(el);
    if (typeof el.className === "string" && el.className.includes("sr-only")) return true;
    return s.overflowX !== "visible" || s.overflowY !== "visible";
  };
  const walk = (el, depth) => {
    if (depth > 24) return;
    if (el.scrollWidth > el.clientWidth + 1) {
      offenders.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 120),
        sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth,
        text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 60),
        selfClip: selfClipping(el),
      });
    }
    for (const c of el.children) walk(c, depth + 1);
  };
  walk(panel, 0);
  offenders.sort((a, b) => b.over - a.over);
  const pRect = panel.getBoundingClientRect();
  const out = {
    panelW: Math.round(pRect.width),
    panelSW: panel.scrollWidth, panelCW: panel.clientWidth,
    panelOverX: panel.scrollWidth > panel.clientWidth + 1,
    shellOverX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    offenders: offenders.slice(0, 14),
    unclipped: offenders.filter((o) => !o.selfClip).length,
  };
  const ovd = panel.querySelector("[data-overview-diagnosis]");
  if (ovd) {
    const box = (el) => el ? { sw: el.scrollWidth, cw: el.clientWidth, over: el.scrollWidth - el.clientWidth } : null;
    out.card = {
      neg: ovd.hasAttribute("data-ovd-negative"),
      aria: ovd.getAttribute("aria-label") ?? "",
      zinc: (ovd.className || "").includes("border-zinc-500/25"),
      iconSvg: !!ovd.querySelector("svg"),
      headLabel: ovd.querySelector(".ovd-head-label")?.textContent ?? "",
      count: ovd.querySelector(".ovd-count")?.textContent ?? "",
      chips: [...ovd.querySelectorAll("[data-ovd-chip]")].map((c) => ({
        id: c.getAttribute("data-ovd-chip"),
        label: (c.querySelector(".ovd-chip-label")?.textContent ?? "").trim(),
        hint: c.getAttribute("title") ?? "",
      })),
      chipCount: ovd.querySelectorAll("[data-ovd-chip]").length,
      ...box(ovd),
      note: ovd.querySelector(".ovd-negative-note") ? {
        text: (ovd.querySelector(".ovd-negative-note").textContent || "").replace(/\\s+/g, " ").trim(),
        ...box(ovd.querySelector(".ovd-negative-note")),
      } : null,
      jump: ovd.querySelector("button") ? {
        text: (ovd.querySelector("button").textContent || "").replace(/\\s+/g, " ").trim(),
        ...box(ovd.querySelector("button")),
      } : null,
    };
  }
  const failedP = [...panel.querySelectorAll("p")].find((p) => p.textContent === "Job failed");
  out.jobFailedHead = failedP ? "Job failed" : "";
  /* the exoneration probe — the t970/t971 law verbatim: a leaked button
   * must be aria-named with an absolute ::before (the Task 171 hit-slop
   * family); an unnamed leak with no pseudo is a DISEASE */
  out.leakButtons = [...dlg.querySelectorAll("button")]
    .filter((b) => b.scrollWidth > b.clientWidth + 1)
    .slice(0, 8)
    .map((b) => {
      const before = getComputedStyle(b, "::before");
      return {
        aria: b.getAttribute("aria-label") ?? "",
        over: b.scrollWidth - b.clientWidth,
        pseudoAbs: before.position === "absolute",
        inset: before.inset,
      };
    });
  return JSON.stringify(out);
})()`;

/* ==================== SEGMENT A — the negative teaser, live ==================== */
console.log("-- segment A: the t995 face (the zero leg's home, re-homed) --");
const centeredA = await findAndCenter("Custom Error");
console.log(`  find-bar: ${centeredA}`);
if (!String(await openInspectorHard(ZERO_NAME)).startsWith("open@try")) {
  console.log("FATAL: the t995 face's inspector never opened");
  process.exit(2);
}
await sleep(800);
/* the smart default, witnessed before any click — on the ZERO face too */
const openedOnA = evalJson(selTabExpr(ZERO_NAME));
ok("A0 the zero face's inspector opens on the LOG tab (the smart default — every failed face answers the log first, even when the answer is 'no known signature')", openedOnA?.selected === "Log", JSON.stringify(openedOnA ?? {}));

const wideA = await openOverviewRead(ZERO_NAME);
if (!wideA) { console.log("FATAL: the Overview read never landed (the tab click never took)"); process.exit(2); }
console.log(`  teaser: neg=${wideA.card.neg} chips=${wideA.card.chipCount}`);
console.log(`  wide: panelW=${wideA.panelW} sw=${wideA.panelSW} overX=${wideA.panelOverX}`);
shot("t995-teaser-rehome-wide.png");

/* the negative leg's own verdicts (the card must SPEAK the zero) */
ok("A1 the RE-HOME: the t995 face speaks the NEGATIVE teaser (data-ovd-negative — the zero contract has a live face again)", wideA.card.neg === true, `neg=${wideA.card.neg}`);
ok("A2 the negative card's aria verdict names the zero (no known failure signature matched the full log)", wideA.card.aria === "No known failure signature matched the full log", `"${wideA.card.aria}"`);
ok("A3 the count chip reads 0 findings (the diagnosis RAN — silence would leave the user guessing)", wideA.card.count === "0 findings", `"${wideA.card.count}"`);
ok("A4 the negative card carries ZERO chips (no data-ovd-chip rows — no signature claimed)", wideA.card.chipCount === 0, `chips=${wideA.card.chipCount}`);
ok("A5 the card is the CALM zinc, not the alarm rose (nothing found is information, not an emergency)", wideA.card.zinc === true, `zinc=${wideA.card.zinc}`);
ok("A6 the note speaks the teaser's own sentence (custom to this job; the log is the ground truth)", (wideA.card.note?.text ?? "").includes("custom to this job") && (wideA.card.note?.text ?? "").includes("The log is the ground truth"), `"${(wideA.card.note?.text ?? "").slice(0, 100)}"`);
ok("A7 the jump button is the negative card's quieter verb (Read the full log)", wideA.card.jump?.text === "Read the full log", `"${wideA.card.jump?.text ?? ""}"`);
ok("A8 the failed card's head says Job failed", wideA.jobFailedHead === "Job failed", `"${wideA.jobFailedHead}"`);
ok(
  "A9 every LEAK button is an aria-named hit-slop carrier (wide, zero face)",
  (wideA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (wideA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the fold face of the negative teaser — the t994 red-2 lesson's
 * patience (24×600) and the card gate (a remount lands on Log, whose
 * panel carries no card — an honest FATAL, never a fake fold read).
 * The RED-1 lesson (this walk's own storm): the viewport switch can
 * KILL the dialog outright (not just flicker it), and at 320 the
 * re-open cannot click the card — the canvas is transform-positioned
 * (the t978 law) and the face at (1960,1600) sits off-viewport, where
 * realClick's scrollIntoView branch is a no-op. The honest cure is the
 * walk's own opening organ: POLL for the dialog's self-heal first (a
 * flicker remounts — the red-10 lesson), and only when it is REALLY
 * gone, re-center the face through the find bar (the honest user flow
 * — the same organ that opened the world) and re-open from there. */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
let foldHere = await poll(
  `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${ZERO_NAME}')); return JSON.stringify({ here: !!d }); })()`,
  (v) => v.here === true, 8, 600,
);
if (!foldHere?.here) {
  const recentered = await findAndCenter("Custom Error");
  console.log(`  (the fold: the dialog died on the viewport switch — re-centered via the find bar: ${recentered})`);
  const reopened = await openInspectorHard(ZERO_NAME, 4);
  console.log(`  (the fold: re-open: ${reopened})`);
  const refold = await openOverviewRead(ZERO_NAME);
  if (!refold) { console.log("FATAL: the re-opened dialog never reached Overview"); process.exit(2); }
}
let foldA = await pollTraced(walkExpr(ZERO_NAME), (v) => v && !v.err && !!v.card, 24, 600, "foldA");
if (!foldA || foldA.err || !foldA.card) {
  /* the fold read can still land on the Log tab (the remount's smart
   * default) — the card gate's own revive: re-click Overview through
   * the settle-race-safe reader before calling it honest */
  const revived = await openOverviewRead(ZERO_NAME);
  if (!revived) { console.log("FATAL: the fold walk never measured a card"); process.exit(2); }
  foldA = revived;
}
console.log(`  fold: panelW=${foldA.panelW} sw=${foldA.panelSW} cw=${foldA.panelCW} overX=${foldA.panelOverX} shell=${foldA.shellOverX}`);
if (foldA.card) console.log(`  card@fold: over=${foldA.card.over} neg=${foldA.card.neg} chips=${foldA.card.chipCount}`);
shot("t995-teaser-rehome-320.png");

ok("G1 the panel never overflows at the fold (the t969 law holds on the zero face)", foldA.panelOverX === false, `sw=${foldA.panelSW} cw=${foldA.panelCW}`);
ok("G2 the shell never scrolls at the fold", foldA.shellOverX === false);
ok("G3 the negative card absorbs at the fold", (foldA.card?.over ?? 1) === 0, `over=${foldA.card?.over}`);
ok(
  "G4 every LEAK button is an aria-named hit-slop carrier (fold, zero face)",
  (foldA.leakButtons ?? []).length > 0 && (foldA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (foldA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* THE ZERO LEG'S JUMP — the strip's honest ABSENCE, witnessed live for
 * the first time. The jump rides wide (the t994 red-8 law: the card is
 * taller than its t976-era shape and at 320 the button sat below the
 * fold — back to 1280 first), then the landing poll. */
sh(`${AB} set viewport 1280 800`);
await sleep(1500);
const jumpClick = await (async () => {
  for (let i = 0; i < 2; i++) {
    const c = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${ZERO_NAME}')); const b = [...(d?.querySelectorAll('[data-overview-diagnosis] button') ?? [])].find(x => (x.textContent || '').includes('Read the full log')); return b ?? null; })()`);
    if (String(c).startsWith("clicked@")) return c;
    await sleep(800);
  }
  return "NEVER-CLICKED";
})();
console.log(`  jump: ${jumpClick}`);
const jumpLanded = await pollTraced(
  `(() => {
      const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${ZERO_NAME}'));
      if (!d) return JSON.stringify({ err: "no-dialog" });
      const tabs = [...(d.querySelectorAll('[role="tab"]') ?? [])];
      const logTab = tabs.find(t => (t.textContent || '').trim().startsWith('Log'));
      const fullBtn = [...(d.querySelectorAll('[role="group"][aria-label="Log window mode"] button') ?? [])].find(b => (b.textContent || '').trim() === 'Full');
      return JSON.stringify({
        logSelected: logTab?.getAttribute('aria-selected') === 'true',
        fullMode: fullBtn?.getAttribute('aria-pressed') === 'true',
        consoleThere: !!d.querySelector('[data-log-console]'),
        stripThere: !!d.querySelector('[data-log-diagnosis]'),
        findingRows: d.querySelectorAll('[data-finding]').length,
      });
    })()`,
  (v) => v && !v.err && v.logSelected && v.consoleThere, 10, 600, "jumpA",
);
ok("J1 the zero leg's jump lands the Log tab in FULL mode", !!jumpLanded && jumpLanded.fullMode === true, JSON.stringify(jumpLanded ?? {}));
ok("J2 the strip is ABSENT by design (the findings.length > 0 gate's other side — the console stands alone, the log itself the answer)", !!jumpLanded && jumpLanded.stripThere === false && jumpLanded.consoleThere === true, `strip=${jumpLanded?.stripThere} console=${jumpLanded?.consoleThere}`);
ok("J3 zero data-finding rows anywhere in the dialog (no signature claimed on the zero face)", !!jumpLanded && jumpLanded.findingRows === 0, `rows=${jumpLanded?.findingRows}`);
shot("t995-teaser-rehome-strip-absent.png");

/* ==================== SEGMENT B — the coherence ==================== */
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
console.log("-- segment B: the coherence (the zero leg lives beside the positive legs) --");

const centeredB = await findAndCenter("Cancelled Diagnosis");
console.log(`  find-bar(cancelled): ${centeredB}`);
if (String(await openInspectorHard(FLIP_NAME)).startsWith("open@try")) {
  await sleep(800);
  const flipRead = await openOverviewRead(FLIP_NAME);
  ok("B1 the t994 flip HOLDS beside the zero leg: the cancelled face still speaks EXACTLY ONE scheduler-cancelled chip (no cross-contamination)", !!flipRead && flipRead.card?.chips?.length === 1 && flipRead.card.chips[0].id === "scheduler-cancelled", JSON.stringify(flipRead?.card?.chips ?? []));
  ok("B1b the cancelled face carries NO negative card (the zero leg did not bleed into the flipped face)", !!flipRead && flipRead.card?.neg === false, `neg=${flipRead?.card?.neg}`);
} else {
  ok("B1 the t994 flip HOLDS beside the zero leg: the cancelled face still speaks EXACTLY ONE scheduler-cancelled chip (no cross-contamination)", false, "the cancelled inspector never opened");
  ok("B1b the cancelled face carries NO negative card (the zero leg did not bleed into the flipped face)", false, "the cancelled inspector never opened");
}

try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
const centeredC = await findAndCenter("Failed Diagnosis");
console.log(`  find-bar(contrast): ${centeredC}`);
if (String(await openInspectorHard(POS_NAME)).startsWith("open@try")) {
  await sleep(800);
  const posRead = await openOverviewRead(POS_NAME);
  ok("B2 the t970 face still speaks the POSITIVE teaser (2 chips — the positive leg keeps its face while the negative leg regains its own)", !!posRead && posRead.card?.chipCount === 2 && posRead.card?.neg === false, JSON.stringify(posRead ? { neg: posRead.card?.neg, chips: posRead.card?.chipCount } : {}));
} else {
  ok("B2 the t970 face still speaks the POSITIVE teaser (2 chips — the positive leg keeps its face while the negative leg regains its own)", false, "the t970 inspector never opened");
}

/* world honesty: the as-found fingerprint stands (the walk minted nothing) */
const jobsAfter = await readJobs();
const fpAsLeft = jobsAfter ? fingerprint(jobsArr(jobsAfter), null) : "unreadable";
ok("the world's fingerprint as-found = as-left (the walk minted nothing)", fpAsLeft === fpAsFound, fpAsLeft === fpAsFound ? "identical" : "DIFFERS");

finish({ rehome: { face: ZERO_NAME, contract: "zero-signature", gates: ["signature-table", "silent-run-death-autopsy"], jump: "strip absent by design" } });
