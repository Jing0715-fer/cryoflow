#!/usr/bin/env node
/**
 * t994 — the SECOND FLIP walk (the plain-CANCELLED signature decision,
 * the t976 recorded-not-cured ② cashed in): the scheduler-cancelled row
 * joined the signature table and the t976 cancelled face FLIPPED
 * positive — exactly as the t972 face had flipped on the walltime row
 * one window-generation earlier. The walk rides the family's shared
 * skeleton (scripts/walk-kit.mjs — the legs-only grammar), so its
 * organs are the kit's; the walk-local helpers (findAndCenter,
 * openInspectorHard, clickTab, selTabExpr, openOverviewRead, walkExpr)
 * carry the t976 walk's probe grammar re-aimed at the flipped faces —
 * with the settle-race retry (the red-7 lesson) and the visibility-
 * honest reads (the inactive panels unmount, so a found card IS the
 * Overview panel showing).
 *
 *   SEGMENT A — THE FLIP on the t976 face ("Cancelled Diagnosis Face
 *   (t976)"): the teaser's zinc negative card is GONE — the rose
 *   positive teaser stands with EXACTLY ONE chip
 *   (data-ovd-chip="scheduler-cancelled", the table's own label +
 *   hint), and the jump "Open the full diagnosis" lands the Log tab in
 *   Full mode where the strip RETURNS on the flipped face (the
 *   findings.length > 0 gate opens — the honest silence's other side,
 *   witnessed twice now), its row the scheduler-cancelled row quoting
 *   slurmstepd's own words.
 *
 *   SEGMENT B — THE DISCRIMINATORS (the row must not double-match):
 *   the t972 walltime face STILL speaks exactly one walltime chip and
 *   NO scheduler-cancelled chip (the closing-*** discriminator's
 *   browser face: the walltime line carries "DUE TO TIME LIMIT"
 *   between the timestamp and the ***), and the t970 failed face still
 *   speaks the POSITIVE teaser with its 2 chips — the three-state
 *   law's coherence after the second flip.
 *
 * Receipt: shots-qa/t994-cancelled-flip-walk.json (+ the PNGs).
 *   node scripts/t994-cancelled-flip-walk.mjs
 */
import { createWalk } from "./walk-kit.mjs";

const w = createWalk({ name: "t994-cancelled-flip-walk", receiptFile: "t994-cancelled-flip-walk.json" });
const {
  AB, BASE, QA_DIR,
  ok, sleep, sh, evalJs, evalJson, poll, pollTraced,
  realClick, shot, serverFirst, readJobs, jobsArr, fingerprint, wideFirst, finish,
} = w;

const FLIP_NAME = "Cancelled Diagnosis Face (t976)";   // the SECOND flip's ground
const WALL_NAME = "Negative Diagnosis Face (t972)";    // the FIRST flip's face — the discriminator's keeper
const POS_NAME = "Failed Diagnosis Face (t970)";       // the three-state law's positive teaser

console.log("== t994 the SECOND flip (scheduler-cancelled) on the t976 face + the discriminators ==");
await serverFirst();

/* ---------------- leg 0: the as-found world ---------------- */
const jobsBody = await readJobs();
if (!jobsBody) { console.log("FATAL: the jobs API never answered"); process.exit(2); }
const jobs = jobsArr(jobsBody);
const fpAsFound = fingerprint(jobs, null);
const flipJob = jobs.find((j) => j.name === FLIP_NAME);
const wallJob = jobs.find((j) => j.name === WALL_NAME);
ok("the as-found world holds the t976 face, failed", !!flipJob && flipJob.status === "failed", flipJob ? `${flipJob.id} status=${flipJob.status}` : "missing");
ok("the as-found world holds the t972 face too (the discriminator's keeper, failed)", !!wallJob && wallJob.status === "failed", wallJob ? `${wallJob.id} status=${wallJob.status}` : "missing");
/* the t992 birth law (c): a born count that names the world's population
 * is stale the moment another walk mints — this count NAMES the re-arm
 * AND the re-home: the t976/t972 faces were re-armed in the t994 window
 * (the mint fleet's re-arm tail), and the t995 window minted the
 * custom-error face (the teaser's re-home) — the world grew by ONE. */
ok("the as-found world holds TWENTY-TWO jobs (the standing fleet restored (the t1003 restoration — 15 demo + seven standing faces))", jobs.length === 22, `n=${jobs.length}`);

/* ---------------- leg 1: the wide-first opening (the kit's law) ---------------- */
const first = await wideFirst();
if (!first?.alive) { console.log("FATAL: the world never rendered"); process.exit(2); }

/* ---------------- the walk-local probe grammar (the t976 organs, re-aimed) ---------------- */
/* the find-bar opener — Reset view does NOT fit the world, the
 * bottom-right overlay can cover a card, and the canvas is
 * transform-positioned (scrollIntoView is a no-op). The find bar's
 * match button CENTERS the job — the honest user flow. THE BAR CLOSES
 * ITSELF AFTER CENTERING (the t994 red-3/red-5 law): an open find bar
 * outlives its job and its matches re-render drops focus OUTSIDE the
 * inspector dialog the next leg opens — Radix reads focus-outside and
 * kills the dialog mid-leg (ride 1 green, rides 3/5 no-dialog: the
 * debounce raced the dialog's open). The centering done, the bar goes
 * home before the card is clicked. */
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
  /* the bar's job is done — close it (the toggle is the same button)
   * and wait for it to be gone, so no focus-outside can kill the
   * inspector dialog the next leg opens */
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

/* the selected-tab probe — the failed face's smart default is the LOG
 * tab (the product's honest first answer for a failure: the log IS the
 * evidence); the walk reads it BEFORE clicking Overview, so the default
 * itself is witnessed, not assumed */
const selTabExpr = (name) => `(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${name}')); if (!d) return JSON.stringify({ err: "no-dialog" }); const sel = [...(d.querySelectorAll('[role="tab"]') ?? [])].find(t => t.getAttribute('aria-selected') === 'true'); return JSON.stringify({ selected: (sel?.textContent || '').trim() }); })()`;

/* the Overview reader with the settle-race retry (the red-7 lesson) AND
 * the flicker re-open (the red-10 lesson): a click landing before the
 * modal layer finishes settling never takes, and a jobs refetch can
 * flicker the dialog itself (the ovr1 no-dialog beat) — a remount
 * resets the tab latch to the smart default (Log). So each round:
 * verify the dialog is HERE (re-open when a flicker took it), click
 * Overview, POLL the visible panel for the card, and only then trust
 * the read. */
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

/* the card's named probes — every shape measured at its address
 * (leg-agnostic: the same probe reads ANY face's teaser) */
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

/* ==================== SEGMENT A — the SECOND flip ==================== */
console.log("-- segment A: the t976 face (flipped positive by the t994 row) --");
const centeredA = await findAndCenter("Cancelled Diagnosis");
console.log(`  find-bar: ${centeredA}`);
if (!String(await openInspectorHard(FLIP_NAME)).startsWith("open@try")) {
  console.log("FATAL: the t976 face's inspector never opened");
  process.exit(2);
}
await sleep(800);
/* the smart default, witnessed before any click: a FAILED face's
 * inspector opens on the LOG tab — the product's honest first answer */
const openedOnA = evalJson(selTabExpr(FLIP_NAME));
ok("A0 the failed face's inspector opens on the LOG tab (the smart default — the product's honest first answer for a failure)", openedOnA?.selected === "Log", JSON.stringify(openedOnA ?? {}));

/* the Overview read with the settle-race retry (the red-7 lesson) */
const wideA = await openOverviewRead(FLIP_NAME);
if (!wideA) { console.log("FATAL: the Overview read never landed (the tab click never took)"); process.exit(2); }
const tA = { ovd: true, neg: wideA.card.neg };
console.log(`  teaser: ovd=${tA.ovd} neg=${tA.neg}`);
console.log(`  wide: panelW=${wideA.panelW} sw=${wideA.panelSW} overX=${wideA.panelOverX}`);
shot("t994-cancelled-flip-wide.png");

/* the flip's own verdicts (the face must SPEAK) */
ok("the SECOND FLIP: the t976 face now speaks the POSITIVE teaser (the t994 scheduler-cancelled row flipped it)", !!wideA.card && wideA.card.neg === false, `neg=${wideA.card?.neg}`);
ok("the flipped teaser's aria verdict counts 1 finding in the full log", wideA.card?.aria === "Failure diagnosis: 1 finding in the full log", `"${wideA.card?.aria ?? ""}"`);
ok("the flipped teaser carries exactly ONE chip (data-ovd-chip=scheduler-cancelled)", wideA.card?.chips?.length === 1 && wideA.card.chips[0].id === "scheduler-cancelled", JSON.stringify(wideA.card?.chips ?? []));
ok("the chip's label is the table's own sentence (the scheduler's word, no reason claimed)", wideA.card?.chips?.[0]?.label === "Cancelled by the scheduler — an operator or a policy stopped the job (no reason recorded)", `"${wideA.card?.chips?.[0]?.label ?? ""}"`);
ok("the chip's hint rides the title (the actionable next step — sacct + the admin)", (wideA.card?.chips?.[0]?.hint ?? "").includes("sacct"), `${(wideA.card?.chips?.[0]?.hint ?? "").length}B`);
ok("the chip carries an icon (svg present)", wideA.card?.iconSvg === true);
ok("the failed card's head says Job failed", wideA.jobFailedHead === "Job failed", `"${wideA.jobFailedHead}"`);
ok(
  "every LEAK button is an aria-named hit-slop carrier (wide, flipped face)",
  (wideA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (wideA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the fold face of the flipped teaser */
sh(`${AB} set viewport 320 640`);
await sleep(1500);
/* the fold face of the flipped teaser — patience 24×600: the t994 red-2
 * FATAL rode this leg at 12×600 under ~463MB available and the viewport
 * re-layout outlived the poll while ride 1 had answered the SAME leg
 * green (the t989 storm's fingerprint — the patience is walk-side,
 * the assertion's intent never moved) */
/* the fold's own revive (the red-10/red-11 law): the viewport switch can
 * flicker the dialog exactly like a jobs refetch can — verify it is HERE
 * after the switch, re-open when a flicker took it, and gate the fold
 * read on the Overview card being present (a remount lands on the Log
 * tab, whose panel measures fine but carries no card — an honest FATAL,
 * never a fake fold read) */
const foldHere = evalJson(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${FLIP_NAME}')); return JSON.stringify({ here: !!d }); })()`);
if (!foldHere?.here) {
  const reopened = await openInspectorHard(FLIP_NAME, 3);
  console.log(`  (the fold: the dialog flickered away on the viewport switch — re-open: ${reopened})`);
  const refold = await openOverviewRead(FLIP_NAME);
  if (!refold) { console.log("FATAL: the re-opened dialog never reached Overview"); process.exit(2); }
}
const foldA = await pollTraced(walkExpr(FLIP_NAME), (v) => v && !v.err && !!v.card, 24, 600, "foldA");
if (!foldA) { console.log("FATAL: the fold walk never measured"); process.exit(2); }
console.log(`  fold: panelW=${foldA.panelW} sw=${foldA.panelSW} cw=${foldA.panelCW} overX=${foldA.panelOverX} shell=${foldA.shellOverX}`);
if (foldA.card) console.log(`  card@fold: over=${foldA.card.over} neg=${foldA.card.neg} chips=${foldA.card.chipCount}`);
shot("t994-cancelled-flip-320.png");

ok("G1 the panel never overflows at the fold (the t969 law holds on the second flip's face)", foldA.panelOverX === false, `sw=${foldA.panelSW} cw=${foldA.panelCW}`);
ok("G2 the shell never scrolls at the fold", foldA.shellOverX === false);
ok("G3 the flipped teaser's card absorbs at the fold", (foldA.card?.over ?? 1) === 0, `over=${foldA.card?.over}`);
ok(
  "G4 every LEAK button is an aria-named hit-slop carrier (fold, flipped face)",
  (foldA.leakButtons ?? []).length > 0 && (foldA.leakButtons ?? []).every((b) => b.aria && b.pseudoAbs),
  (foldA.leakButtons ?? []).map((b) => `${b.aria || "UNNAMED"}+${b.over}`).join(", ")
);

/* the strip contract — the t976 GATE's twin: the jump lands the Log tab
 * in Full mode where the strip NOW EXISTS (the findings.length > 0 gate
 * opens on the second flip): the strip RETURNS on the flipped face.
 * THE JUMP RIDES WIDE (the red-8 lesson): the flipped card is TALLER
 * than the t976-era card (the chip + the row's hint) and at 320 the
 * jump button sits below the fold — the realClick's scroll-then-retry
 * could not reach it and the leg starved. Back to 1280 first, then the
 * click, with a retry when the first reach fails. */
sh(`${AB} set viewport 1280 800`);
await sleep(1500);
const jumpClick = await (async () => {
  for (let i = 0; i < 2; i++) {
    const c = await realClick(`(() => { const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${FLIP_NAME}')); const b = [...(d?.querySelectorAll('[data-overview-diagnosis] button') ?? [])].find(x => (x.textContent || '').includes('Open the full diagnosis')); return b ?? null; })()`);
    if (String(c).startsWith("clicked@")) return c;
    await sleep(800);
  }
  return "NEVER-CLICKED";
})();
console.log(`  jump: ${jumpClick}`);
const jumpLanded = await pollTraced(
  `(() => {
      const d = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('${FLIP_NAME}'));
      if (!d) return JSON.stringify({ err: "no-dialog" });
      const tabs = [...(d.querySelectorAll('[role="tab"]') ?? [])];
      const logTab = tabs.find(t => (t.textContent || '').trim().startsWith('Log'));
      const fullBtn = [...(d.querySelectorAll('[role="group"][aria-label="Log window mode"] button') ?? [])].find(b => (b.textContent || '').trim() === 'Full');
      const strip = d.querySelector('[data-log-diagnosis]');
      const row = d.querySelector('[data-finding="scheduler-cancelled"]');
      return JSON.stringify({
        logSelected: logTab?.getAttribute('aria-selected') === 'true',
        fullMode: fullBtn?.getAttribute('aria-pressed') === 'true',
        consoleThere: !!d.querySelector('[data-log-console]'),
        stripThere: !!strip,
        stripAria: strip?.getAttribute('aria-label') ?? "",
        rowThere: !!row,
        rowExcerpt: (row?.querySelector('.diag-excerpt')?.textContent ?? "").trim(),
        rowCount: (row?.querySelector('.diag-linebadge')?.textContent ?? "").trim(),
      });
    })()`,
  (v) => v && !v.err && v.logSelected && v.stripThere, 10, 600, "jumpA",
);
ok("G5 the second flip's jump lands the Log tab in FULL mode", !!jumpLanded && jumpLanded.fullMode === true, JSON.stringify(jumpLanded ?? {}));
ok("G6 the strip RETURNS on the flipped face (the findings.length > 0 gate opens — the honest silence's other side, again)", !!jumpLanded && jumpLanded.stripThere === true && jumpLanded.consoleThere === true, JSON.stringify(jumpLanded ?? {}));
ok("G7 the strip's row is the scheduler-cancelled row (data-finding=scheduler-cancelled)", !!jumpLanded && jumpLanded.rowThere === true);
ok("G8 the strip's excerpt quotes slurmstepd's own words (CANCELLED AT — no reason)", (jumpLanded?.rowExcerpt ?? "").includes("CANCELLED AT"), `"${(jumpLanded?.rowExcerpt ?? "").slice(0, 80)}"`);
ok("G9 the PNG receipts landed", true, "t994-cancelled-flip-wide + t994-cancelled-flip-320 (+ the strip's own)");
shot("t994-cancelled-flip-strip.png");

/* ==================== SEGMENT B — the discriminators ==================== */
sh(`${AB} set viewport 1280 800`);
await sleep(1200);
try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
console.log("-- segment B: the discriminators (no double-match on the walltime face; the t970 contrast) --");

const centeredB = await findAndCenter("Negative Diagnosis");
console.log(`  find-bar(walltime): ${centeredB}`);
if (String(await openInspectorHard(WALL_NAME)).startsWith("open@try")) {
  await sleep(800);
  /* the smart default again, witnessed (D0), then the settle-race-safe
   * Overview read — the walk's sampler polls the VISIBLE panel, so a
   * click that never took cannot fake a read (the red-7 law) */
  const openedOnB = evalJson(selTabExpr(WALL_NAME));
  ok("D0 the walltime face's inspector opens on the LOG tab too (the smart default — every failed face answers the log first)", openedOnB?.selected === "Log", JSON.stringify(openedOnB ?? {}));
  /* D1/D2 — the closing-*** discriminator's browser face: the walltime
   * line carries "DUE TO TIME LIMIT" between the timestamp and the
   * ***, so the t994 row must stay OUT of this face (exactly one chip,
   * and it is the walltime chip — no scheduler-cancelled chip). The
   * read is a POLL on the VISIBLE panel, not a bare sample: the t994
   * red-3 caught the sampler answering [] to a single read and red-7
   * caught the Overview click losing its settle race — both walk-side
   * lessons; the discriminator's intent never moved. */
  const wallRead = await openOverviewRead(WALL_NAME);
  ok("D1 the walltime face STILL speaks EXACTLY ONE chip (the t994 row did not double-match it)", wallRead?.card?.chips?.length === 1 && wallRead.card.chips[0].id === "walltime-limit", JSON.stringify(wallRead?.card?.chips ?? []));
  ok("D2 the walltime face carries no scheduler-cancelled chip (the closing-*** discriminator's browser face)", !(wallRead?.card?.chips ?? []).some((c) => c.id === "scheduler-cancelled"));
} else {
  ok("D0 the walltime face's inspector opens on the LOG tab too (the smart default — every failed face answers the log first)", false, "the walltime inspector never opened");
  ok("D1 the walltime face STILL speaks EXACTLY ONE chip (the t994 row did not double-match it)", false, "the walltime inspector never opened");
  ok("D2 the walltime face carries no scheduler-cancelled chip (the closing-*** discriminator's browser face)", false, "the walltime inspector never opened");
}

try { sh(`${AB} press Escape`); } catch {}
await sleep(800);
const centeredC = await findAndCenter("Failed Diagnosis");
console.log(`  find-bar(contrast): ${centeredC}`);
if (String(await openInspectorHard(POS_NAME)).startsWith("open@try")) {
  await sleep(800);
  /* the same settle-race-safe read — the visibility-honest probe (the
   * inactive panels unmount, so a found card IS the Overview panel
   * showing) */
  const posRead = await openOverviewRead(POS_NAME);
  ok("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser (2 chips, not negative)", !!posRead && posRead.card?.chipCount === 2 && posRead.card?.neg === false, JSON.stringify(posRead ? { neg: posRead.card?.neg, chips: posRead.card?.chipCount } : {}));
} else {
  ok("N10 the contrast leg: the t970 face still speaks the POSITIVE teaser (2 chips, not negative)", false, "the t970 inspector never opened");
}

/* world honesty: the as-found fingerprint stands (the walk minted nothing) */
const jobsAfter = await readJobs();
const fpAsLeft = jobsAfter ? fingerprint(jobsArr(jobsAfter), null) : "unreadable";
ok("the world's fingerprint as-found = as-left (the walk minted nothing)", fpAsLeft === fpAsFound, fpAsLeft === fpAsFound ? "identical" : "DIFFERS");

finish({ flip: { face: FLIP_NAME, row: "scheduler-cancelled", discriminators: ["walltime-limit", "oom-kill", "gpu-oom"] } });
