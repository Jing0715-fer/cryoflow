#!/usr/bin/env node
/**
 * t869 — the arrival laws, ONE implementation for the family (the
 * shared-ruler precedent: a computation grows once, every carrier rides
 * the growth). Three laws the churning world taught, now imported instead
 * of inlined (t844 was the first inline carrier; the remaining carriers
 * — t862/t863/t864/t865/t866 — import this module from t869 on):
 *
 *   ROSTER-ARRIVAL DOOR (t846) — the boot's landing dialect mounts the
 *     project's cards on their own schedule; a clock-settled canvas films
 *     the boot mid-mount (the 144-vs-143 witness). An arrival waits for
 *     arrival: the canvas is measured only when it hosts the roster's
 *     dominant project's cards, counted from the API, never pinned.
 *   RETRY-THROUGH-REBOOT FETCH (t402/t867) — the heavy faces kill
 *     next-server mid-ride and undici's keep-alive pool hands the next
 *     fetch a dead socket; the fetch retries through the watchdog's boot.
 *   RETRY-THROUGH-REBOOT LOAD (t867's openRetry) — a bare ab("open") dies
 *     on a rebooting server (net::ERR_CONNECTION_REFUSED); the load
 *     retries through the boot instead of dying honestly-red.
 *
 *   import { arrivalDoor, openRetry } from "./arrival-laws.mjs";
 *   openRetry("http://localhost:3000"); sleep(3);
 *   await arrivalDoor("the baseline canvas");
 */

import { execSync } from "node:child_process";

export const BASE = "http://localhost:3000";

export const ab = (args, cwd = process.cwd()) =>
  execSync(`agent-browser ${args}`, { encoding: "utf8", cwd });

export const sleep = (s) => execSync(`sleep ${s}`);

/** agent-browser eval unwrap — the t837 defensive form. */
export const evalJson = (js) => {
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

/* same-origin metadata — the roster read is a same-origin gate (the t708 shape) */
export const SH = {
  Origin: BASE,
  Referer: `${BASE}/`,
  "Sec-Fetch-Site": "same-origin",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Dest": "empty",
};

export const fetchRetry = async (url, opts = {}, attempt = 0) => {
  try {
    return await fetch(url, opts);
  } catch (e) {
    if (attempt >= 12) throw e;
    console.log(`  (server down — retrying ${url} through the reboot)`);
    sleep(5);
    return fetchRetry(url, opts, attempt + 1);
  }
};

/* the roster's dominant project's card count — measured from the API,
 * never pinned (the t846 door's own ruler). */
export const rosterCards = async () => {
  const b = await (await fetchRetry(`${BASE}/api/jobs`, { headers: SH })).json();
  const jobs = b.jobs ?? b;
  const byProject = {};
  for (const j of jobs) byProject[j.projectId ?? "?"] = (byProject[j.projectId ?? "?"] ?? 0) + 1;
  return Math.max(1, ...Object.values(byProject));
};

export const cardsNow = () =>
  evalJson('(() => JSON.stringify({ cards: document.querySelectorAll("[data-card-btn]").length }))()');

/* the door itself: wait (bounded) until the canvas hosts the roster's cards. */
export const arrivalDoor = async (where) => {
  const want = await rosterCards();
  for (let i = 0; i < 30 && cardsNow().cards !== want; i++) sleep(1);
  console.log(`  the roster-arrival door (${where}): ${cardsNow().cards}/${want} cards hosted`);
};

/* the load's own door: retry through the watchdog's boot. */
export const openRetry = (url) => {
  for (let i = 0; i < 24; i++) {
    try {
      ab(`open ${url}`);
      return;
    } catch {
      console.log(`  (server down — retrying the load through the reboot, attempt ${i + 1})`);
      sleep(5);
    }
  }
  throw new Error("the server never came back — the ride stops honestly");
};
