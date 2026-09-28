/**
 * t438 bench — the finish knock's arithmetic.
 *
 *   K1 (diffFinishEvents): the transition law, verbatim the store's
 *      sweep — running→final fires (both kinds, order preserved),
 *      everything else is silent: absent→final (fresh load / project
 *      switch in), running→absent (project switch away), pending→final
 *      (auto-start skip), final→final (idempotence), and a batch mixing
 *      all of the above reports ONLY the true finishes.
 *   K2 (planKnock): the visible/hidden split — a visible tab produces a
 *      zero plan no matter what; the hidden tab knocks (title count =
 *      events, independent of opt-ins); the chime rides the opt-in
 *      exactly once per sweep; the notification rides permission with
 *      the toast dialect: solo form (name + kind + elapsed + result
 *      passthrough / fallback) and digest form (census-count title,
 *      roster cap 4, "… and N more").
 *   K3 (knockTitlePrefix + persistence): the unread dialect "(N) " and
 *      its zero form; the sound preference round-trips through the
 *      guarded localStorage shim (and survives a throwing shim).
 *
 * World contract: pure functions + a stubbed window.localStorage — no
 * React, no store, no network. Audio/Notification channels are guarded
 * by typeof checks (no-op without a DOM) and are exercised live in QA.
 */

import {
  diffFinishEvents,
  knockTitlePrefix,
  planKnock,
  readKnockSound,
  writeKnockSound,
  type FinishEvent,
} from "../src/lib/finish-knock";
import type { JobDTO } from "../src/lib/types";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

/* ---------------- the job factory ---------------- */

let seq = 0;
function job(partial: Partial<JobDTO>): JobDTO {
  seq += 1;
  return {
    id: partial.id ?? `job-${seq}`,
    projectId: "p1",
    type: "MotionCorr",
    name: partial.name ?? `MotionCorr ${seq}`,
    x: 0,
    y: 0,
    status: partial.status ?? "running",
    progress: 100,
    params: {},
    result: partial.result ?? null,
    duration: 0,
    startedAt: partial.startedAt ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: null,
  };
}

const running = (name: string) => job({ name, status: "running" });
const completed = (name: string) => job({ name, status: "completed" });
const failed = (name: string) => job({ name, status: "failed" });
const pending = (name: string) => job({ name, status: "pending" });

/* ================= K1 — the diff law ================= */
console.log("K1 — diffFinishEvents: the transition law");

// K1.1 running → completed fires, with the result verbatim
{
  const prev = [running("MotionCorr A")];
  const next = [job({ id: prev[0].id, name: "MotionCorr A", status: "completed", result: "24 micrographs aligned" })];
  const events = diffFinishEvents(prev, next);
  must(events.length === 1, "K1.1 one transition fires");
  must(events[0].kind === "completed" && events[0].name === "MotionCorr A", "K1.1 completed + name carried");
  must(events[0].result === "24 micrographs aligned", "K1.1 result verbatim");
}

// K1.2 running → failed fires with kind
{
  const prev = [running("Classify2D B")];
  const next = [job({ id: prev[0].id, name: "Classify2D B", status: "failed", result: "exit 1" })];
  const events = diffFinishEvents(prev, next);
  must(events.length === 1 && events[0].kind === "failed", "K1.2 failed kind fires");
}

// K1.3 the silence family
{
  const done = completed("Done long ago");
  const neverRan = pending("Pending skip");
  // absent → final: fresh load / project switch IN — no announcement
  must(diffFinishEvents([], [done]).length === 0, "K1.3a absent→final silent");
  // pending → final: auto-start skip — weird, not a knock
  must(diffFinishEvents([], [neverRan]).length === 0, "K1.3b pending→final silent (absent)");
  {
    const next = [job({ id: neverRan.id, name: neverRan.name, status: "completed" })];
    must(diffFinishEvents([neverRan], next).length === 0, "K1.3c pending→final silent (watched)");
  }
  // final → final: idempotent world pays nothing
  {
    const next = [job({ id: done.id, name: done.name, status: "completed" })];
    must(diffFinishEvents([done], next).length === 0, "K1.3d final→final silent");
  }
  // running → absent: project switch AWAY — disappearance is not a finish
  must(diffFinishEvents([running("Gone away")], []).length === 0, "K1.3e running→absent silent");
  // running → running: the heartbeat's own noise
  {
    const a = running("Still running");
    const next = [job({ id: a.id, name: a.name, status: "running" })];
    must(diffFinishEvents([a], next).length === 0, "K1.3f running→running silent");
  }
}

// K1.4 the mixed sweep — order preserved, only true finishes report
{
  const a = running("A");
  const b = running("B");
  const c = running("C");
  const d = running("D");
  const e = running("E");
  const next = [
    job({ id: a.id, name: "A", status: "completed" }), // fires
    job({ id: b.id, name: "B", status: "failed" }),    // fires
    job({ id: c.id, name: "C", status: "running" }),   // silent
    // d dropped: switch away — silent
    job({ id: e.id, name: "E", status: "aborted" }),   // not final-final — silent
    completed("F"),                                    // absent→final — silent
  ];
  const events = diffFinishEvents([a, b, c, d, e], next as JobDTO[]);
  must(events.length === 2, "K1.4 mixed sweep reports only true finishes");
  must(events[0].name === "A" && events[0].kind === "completed", "K1.4 order preserved (first)");
  must(events[1].name === "B" && events[1].kind === "failed", "K1.4 order preserved (second)");
}

/* ================= K2 — planKnock: the decision ================= */
console.log("K2 — planKnock: the visible/hidden split and the dialect");

const ev = (name: string, kind: FinishEvent["kind"], elapsed = "", result: string | null = null): FinishEvent => ({
  id: `ev-${name}`,
  name,
  kind,
  elapsed,
  result,
});

const HIDDEN = { hidden: true, soundOn: false, perm: "default" };
const VISIBLE = { hidden: false, soundOn: true, perm: "granted" as const };

// K2.1 visible tab → zero plan in every channel, even with everything opted in
{
  const plan = planKnock([ev("A", "completed")], VISIBLE);
  must(!plan.chime && plan.notification === null && plan.knocks === 0, "K2.1 visible tab: zero plan");
}

// K2.2 hidden tab: the title knock counts facts, independent of opt-ins
{
  const plan = planKnock([ev("A", "completed"), ev("B", "failed")], HIDDEN);
  must(plan.knocks === 2, "K2.2 knocks count events (opt-ins irrelevant)");
  must(!plan.chime, "K2.2 chime stays off (not opted in)");
  must(plan.notification === null, "K2.2 notification stays off (not granted)");
}

// K2.3 empty sweep → silent plan even fully opted in and hidden
{
  const plan = planKnock([], { hidden: true, soundOn: true, perm: "granted" });
  must(!plan.chime && plan.notification === null && plan.knocks === 0, "K2.3 empty sweep: silent");
}

// K2.4 the chime: exactly ONE per sweep regardless of N
{
  const events = [1, 2, 3, 4, 5].map((i) => ev(`J${i}`, "completed"));
  const plan = planKnock(events, { hidden: true, soundOn: true, perm: "default" });
  must(plan.chime === true, "K2.4 one chime per sweep");
  must(plan.notification === null, "K2.4 chime without notification (permission default)");
}

// K2.5 solo notification — the toast's own dialect
{
  const plan = planKnock([ev("MotionCorr", "completed", "4m 12s", "24 aligned")], {
    hidden: true,
    soundOn: false,
    perm: "granted",
  });
  must(plan.notification !== null, "K2.5 solo notification fires");
  must(plan.notification?.title === "MotionCorr completed · 4m 12s", "K2.5 solo title = name + kind + elapsed");
  must(plan.notification?.body === "24 aligned", "K2.5 solo body = result verbatim");
}

// K2.6 solo fallbacks — no result, no elapsed
{
  const ok = planKnock([ev("MotionCorr", "completed")], { hidden: true, soundOn: false, perm: "granted" });
  must(ok.notification?.body === "Finished clean — results are ready in the inspector.", "K2.6a completed fallback body");
  const bad = planKnock([ev("Classify2D", "failed")], { hidden: true, soundOn: false, perm: "granted" });
  must(bad.notification?.title === "Classify2D failed", "K2.6b failed title, no elapsed suffix");
  must(bad.notification?.body === "Open the inspector for the log trail.", "K2.6c failed fallback body");
  // result present but whitespace-only → fallback (a blank toast is a lie)
  const blank = planKnock([ev("J", "failed", "", "   ")], { hidden: true, soundOn: false, perm: "granted" });
  must(blank.notification?.body === "Open the inspector for the log trail.", "K2.6d whitespace result → fallback");
}

// K2.7 the digest — census-count title, roster cap 4, remainder counted
{
  const events = [
    ev("A", "completed", "1m"),
    ev("B", "completed", "2m"),
    ev("C", "failed", "3m"),
    ev("D", "completed", "4m"),
    ev("E", "failed", "5m"),
    ev("F", "completed", "6m"),
  ];
  const plan = planKnock(events, { hidden: true, soundOn: false, perm: "granted" });
  must(plan.notification?.title === "4 completed · 2 failed", "K2.7a digest title = census dialect");
  const lines = plan.notification?.body.split("\n") ?? [];
  must(lines.length === 5, "K2.7b roster capped at 4 + tail");
  must(lines[0] === "A completed · 1m" && lines[3] === "D completed · 4m", "K2.7c roster lines in form and order");
  must(lines[4] === "… and 2 more", "K2.7d remainder counted, not recited");
}

// K2.8 exactly at the cap — no tail line invented
{
  const events = [1, 2, 3, 4].map((i) => ev(`J${i}`, "completed"));
  const plan = planKnock(events, { hidden: true, soundOn: false, perm: "granted" });
  const lines = plan.notification?.body.split("\n") ?? [];
  must(lines.length === 4, "K2.8 exactly 4 events → 4 lines, no tail");
}

/* ================= K3 — title frames + the sound pref ================= */
console.log("K3 — knockTitlePrefix and the guarded preference");

must(knockTitlePrefix(0) === "", "K3.1 zero knocks → empty prefix (frame B identical)");
must(knockTitlePrefix(3) === "(3) ", "K3.2 the unread dialect");
must(`${knockTitlePrefix(2)}Main · CryoFlow` === "(2) Main · CryoFlow", "K3.3 frame A composes");

// K3.4 the preference round-trips through a REAL localStorage (bun has none — shim)
{
  const backing = new Map<string, string>();
  const shim = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, v),
  };
  (globalThis as Record<string, unknown>).window = { localStorage: shim };
  must(readKnockSound() === false, "K3.4a default off (absent key)");
  writeKnockSound(true);
  must(readKnockSound() === true, "K3.4b round-trip on");
  writeKnockSound(false);
  must(readKnockSound() === false, "K3.4c round-trip off");
}

// K3.5 a throwing shim must never crash the callers (private mode)
{
  const throwing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  };
  (globalThis as Record<string, unknown>).window = { localStorage: throwing };
  must(readKnockSound() === false, "K3.5a throwing read → default off");
  let threw = false;
  try {
    writeKnockSound(true);
  } catch {
    threw = true;
  }
  must(!threw, "K3.5b throwing write swallowed");
}

/* ---------------- verdict ---------------- */
console.log(`\nt438 finish-knock bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
