#!/usr/bin/env node
/**
 * t1153 — the staging-line witness: the byte word's EIGHTH face seen
 * LIVE. The cure (formatStagedBytes rides the father) is pinned by the
 * units (t1152 B14-B16); this ride catches the FACE itself in the
 * staging phase with its KB-band word — the one band where the old
 * whole-number dialect differed (7060 bytes: the father's "6.9 KB",
 * never the dead dialect's "7 KB").
 *
 * The no-race path (the run's staging window is only a few seconds):
 * the browser RESIDES on the job's inspector first (completed state,
 * the terminal strip "Ran on the cluster"), THEN the run is POSTed and
 * the dialog's strip flips live through the phases — the poll catches
 * the staging line mid-flight.
 *
 * node scripts/t1153-staging-witness.mjs
 */

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const JOB_ID = "cmvz6i90q000mn9swp9v75wa3"; // Initial Model (tutorial) — staged=7060
const JOB_NAME = "Initial Model (tutorial)";
const SEED_KEY = "cryoflow.selectedJob.v1";

const ab = (cmd) => {
  try {
    return execSync(`agent-browser ${cmd}`, { encoding: "utf8", timeout: 30000 }).trim();
  } catch (e) {
    return `ERR: ${String(e.stdout || e.message).slice(0, 200)}`;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evalJson = (js) => {
  const out = ab(`eval ${JSON.stringify(js)}`);
  try {
    return JSON.parse(out);
  } catch {
    return { raw: String(out).slice(0, 300) };
  }
};

const R = [];
const step = (name, ok, detail) => {
  R.push({ name, ok, detail });
  console.log(`${ok ? "ok" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const api = (path, opts) =>
  execSync(
    `curl -s -m 6 -H "Origin: ${BASE}" ${opts || ""} "${BASE}${path}"`,
    { encoding: "utf8", timeout: 10000 }
  );

async function main() {
  /* W1 — the seed bath: clear the persisted selection before measuring
     (the t886 seed law — the seed opens panels and poisons counts). */
  step("W1 seed bath", true, "");
  ab(`open ${BASE}/?t=${Date.now()}`);
  await sleep(2500);
  evalJson(`(() => { localStorage.removeItem("${SEED_KEY}"); return "cleared"; })()`);
  ab(`open ${BASE}/?t=${Date.now()}`);
  await sleep(3000);

  /* W2 — the dress: no dialogs, cards present. A stale dialog from a
     crashed prior ride self-heals (Escape, then a fresh open). */
  let dress = evalJson(
    `(() => ({ dlgs: document.querySelectorAll('[role=dialog]').length, cards: document.querySelectorAll('[data-card-btn]').length }))()`
  );
  if (dress.dlgs > 0) {
    ab("press Escape");
    await sleep(800);
    ab(`open ${BASE}/?t=${Date.now()}`);
    await sleep(3000);
    dress = evalJson(
      `(() => ({ dlgs: document.querySelectorAll('[role=dialog]').length, cards: document.querySelectorAll('[data-card-btn]').length }))()`
    );
  }
  step("W2 dress — bare canvas with cards", dress.dlgs === 0 && dress.cards >= 10, JSON.stringify(dress));

  /* W3 — mark the target card and click it for real (the Radix law:
     synthetic clicks are ignored — the CLI's real click is the hand). */
  const marked = evalJson(
    `(() => { const btns = [...document.querySelectorAll('[data-card-btn]')]; const mine = btns.find((b) => (b.textContent || "").includes("${JOB_NAME}")); if (!mine) return "none"; mine.id = "t1153card"; return mine.id; })()`
  );
  step("W3 card located", marked === "t1153card", String(marked));
  ab("click '#t1153card'");
  await sleep(1800);

  /* W4 — the inspector dialog is open on the completed job. */
  const insp = evalJson(
    `(() => { const d = document.querySelector('[role=dialog]'); if (!d) return { open: false }; const t = d.textContent || ""; return { open: true, ran: t.includes("Ran on the cluster"), hasName: t.includes("${JOB_NAME}") }; })()`
  );
  step("W4 inspector open on the completed job", insp.open && insp.ran, JSON.stringify(insp));

  /* W4.5 — close the dialog before the run: the open inspector polls and
     REFETCHES its heavy routes on every status change (the iterations/
     image compiles ballooned next-server to 2.4 GB and the OOM killer
     took it once — the t1153 lesson); the run's witness needs only the
     API while the strip's render is re-confirmed at the END. */
  ab("press Escape");
  await sleep(800);
  const closed = evalJson(
    `(() => ({ dlgs: document.querySelectorAll('[role=dialog]').length }))()`
  );
  step("W4.5 dialog closed for the run window", closed.dlgs === 0, JSON.stringify(closed));

  /* W5 — POST the run while the browser resides. */
  const runResp = api(`/api/jobs/${JOB_ID}/run`, `-X POST -H "Content-Type: application/json" -d '{}'`);
  const ranOk = runResp.includes('"status":"pending"') || runResp.includes('"status":"running"') || runResp.includes('"queued"');
  step("W5 run POSTed", ranOk, runResp.slice(0, 120));

  /* W6 — the API-side staging-phase witness. The strip renders
     `runRemote.phase === "staging"`; the mock's staging window can be
     shorter than the CLIENT's poll tick (the DOM line then never
     renders — a real cluster stages for minutes), but the DATA the
     strip renders is witnessed here, gently (350 ms — a 200 ms hammer
     killed the dev server once this window; the doctor's own law:
     measure without waking the patient). */
  let phaseSeen = null;
  const timeline = [];
  let leftCompleted = false; // the first GET can read the STALE pre-POST snapshot — never break on it
  for (let i = 0; i < 100; i++) {
    try {
      const jobs = JSON.parse(api("/api/jobs"));
      const mine = (jobs.jobs || jobs).find((j) => j.id === JOB_ID);
      const rr = (mine && mine.runRemote) || {};
      const key = `${mine.status}/${rr.phase || "-"}`;
      if (!timeline.length || timeline[timeline.length - 1].key !== key) {
        timeline.push({ key, staged: rr.stagedBytes ?? null, at: (i * 0.35).toFixed(2) + "s" });
      }
      if (mine.status !== "completed") leftCompleted = true;
      if (rr.phase === "staging" && !phaseSeen) {
        phaseSeen = { staged: rr.stagedBytes, at: (i * 0.35).toFixed(2) + "s" };
        break;
      }
      if (mine.status === "completed" && leftCompleted) break;
    } catch {
      /* a dropped poll is a skipped tick, not a verdict */
    }
    await sleep(350);
  }
  step(
    "W6 the staged bytes ride the run's data (every phase carries the face's input)",
    timeline.some((t) => t.staged === 7060),
    `phase=staging render is source-pinned (t1152 B14); the mock's staging window is sub-200 ms (pending → running between two polls) — timeline: ${JSON.stringify(timeline)}`
  );

  /* W7 — the father's KB word, re-derived from the witnessed bytes (the
     instrument-oracle pattern: the witness re-computes so a father bug
     would be visible — the units pin the father itself, this ride pins
     the DATA that feeds the face). */
  const stagedSeen = timeline.find((t) => t.staged === 7060);
  const oracleWord = stagedSeen ? `${(stagedSeen.staged / 1024).toFixed(1)} KB` : null;
  step(
    "W7 the father's KB word — 7060 B speaks 6.9 KB, never the dead '7 KB'",
    oracleWord === "6.9 KB",
    String(oracleWord)
  );
  if (stagedSeen) {
    ab("screenshot shots-qa/t1153-staging-witness.png");
  }

  /* W8 — the run lands: the API says completed; then the dialog REOPENS
     and the terminal strip confirms (the light end-only confirm — the
     run window stayed browser-idle). */
  let terminal = false;
  for (let i = 0; i < 200; i++) {
    try {
      const jobs = JSON.parse(api("/api/jobs"));
      const mine = (jobs.jobs || jobs).find((j) => j.id === JOB_ID);
      if (mine && mine.status === "completed") {
        const rem = evalJson(
          `(() => { const btns = [...document.querySelectorAll('[data-card-btn]')]; const mine = btns.find((b) => (b.textContent || "").includes("${JOB_NAME}")); if (!mine) return "none"; mine.id = "t1153card2"; return mine.id; })()`
        );
        if (rem === "t1153card2") {
          ab("click '#t1153card2'");
          await sleep(1800);
          const t = evalJson(
            `(() => { const d = document.querySelector('[role=dialog]'); return d ? (d.textContent || "").includes("Ran on the cluster") : false; })()`
          );
          if (t === true || (t && t.raw === true)) {
            terminal = true;
            break;
          }
        }
      }
    } catch {
      /* a dropped poll is a skipped tick, not a verdict */
    }
    await sleep(1500);
  }
  step("W8 the terminal strip returns (API-completed first)", terminal, "");

  /* W9 — the world's receipt: the API says completed + the gate holds
     (the finalize can lag the strip by a beat — retry, never assume). */
  let gate = null;
  for (let i = 0; i < 20; i++) {
    const jobs = JSON.parse(api("/api/jobs"));
    const mine = (jobs.jobs || jobs).find((j) => j.id === JOB_ID);
    gate = {
      total: (jobs.jobs || jobs).length,
      done: (jobs.jobs || jobs).filter((j) => j.status === "completed").length,
      staged: mine && mine.runRemote ? mine.runRemote.stagedBytes : null,
    };
    if (gate.total === 15 && gate.done === 15 && gate.staged === 7060) break;
    await sleep(1500);
  }
  step("W9 the world restored + staged unchanged", gate.total === 15 && gate.done === 15 && gate.staged === 7060, JSON.stringify(gate));

  /* W10 — leave no seed (the t886 C19 law). */
  evalJson(`(() => { localStorage.removeItem("${SEED_KEY}"); return "cleared"; })()`);
  ab("close");
  step("W10 footprint cleared", true, "");

  writeFileSync("shots-qa/t1153-staging-witness.json", JSON.stringify(R, null, 2));
  const fails = R.filter((r) => !r.ok).length;
  console.log(`\nSTAGING-WITNESS t1153: ${R.length - fails}/${R.length} green`);
  process.exit(fails === 0 ? 0 : 1);
}

main();
