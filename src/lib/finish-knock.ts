/**
 * CryoFlow — the finish knock (t438).
 *
 * The app's announcement law has always had a visible half: toasts speak
 * while the user looks (Task 146's aggregation doctrine), and the tab
 * census carries presence while they don't (Task 143 — title + favicon
 * say a world is alive). What neither says is WHEN: a batch that finishes
 * in a hidden tab changes the title by SUBTRACTION ("2 running" → "· 0
 * running") — an announcement you must remember the previous state to
 * hear. A scientist who kicked off MotionCorr and went to email gets no
 * knock on the door.
 *
 * This module is the knock's BRAIN — pure, React-free, bench-able. The
 * three out-of-page channels it decides between, quietest first:
 *
 *   title flicker  always on, zero permission: "(3) W2 · 2 running ·
 *                  CryoFlow" alternating with the census title while the
 *                  tab is hidden (written by use-tab-census — ONE writer
 *                  to document.title, always).
 *   chime          explicit opt-in (header bell), a WebAudio two-tone —
 *                  no asset, no autoplay risk (created inside the user
 *                  gesture that enabled it).
 *   notification   explicit opt-in (Notification.permission ===
 *                  "granted"), one OS notification per finish sweep,
 *                  speaking the same dialect the toasts speak.
 *
 * Two laws the visible world already lives by, extended here:
 *   - the VISIBLE/HIDDEN split: toasts speak when the tab is visible,
 *     the knock speaks when it is hidden — never both at once (double
 *     announcement is noise, and the toast channel already owns "seen").
 *   - the AGGREGATION law (t146): one sweep of N finishers speaks once
 *     — a single chime, a single notification (solo form or census
 *     digest) — never N of anything.
 */

import type { JobDTO } from "./types";

export type FinishKind = "completed" | "failed";

/** One observed transition running → final. `elapsed` is pre-formatted
 *  by the caller (the same announceElapsed formula the toasts use) so
 *  this module stays clock-free and pure. */
export interface FinishEvent {
  id: string;
  name: string;
  kind: FinishKind;
  /** Human elapsed ("4m 12s") — "" when the job never recorded a start. */
  elapsed: string;
  /** The job's result line, verbatim — the notification body's raw ore. */
  result: string | null;
}

/**
 * The diff law, verbatim the store's own sweep (Task 146): a finish is
 * an id whose PREVIOUS status was "running" and whose next status is
 * final. Everything else is silence:
 *   - absent → final  (fresh load, project switch IN — you didn't watch
 *     it run, so you don't announce it)
 *   - running → absent (project switch AWAY — a disappearance is not a
 *     finish; the job's own project will announce it if anyone watches)
 *   - pending → final (auto-start skip — weird, but not a knock)
 *   - final → final   ( resurrection guards live elsewhere)
 */
export function diffFinishEvents(
  prev: ReadonlyArray<Pick<JobDTO, "id" | "status">>,
  next: ReadonlyArray<JobDTO>,
): FinishEvent[] {
  const events: FinishEvent[] = [];
  for (const job of next) {
    if (job.status !== "completed" && job.status !== "failed") continue;
    const before = prev.find((p) => p.id === job.id);
    if (before?.status !== "running") continue;
    events.push({
      id: job.id,
      name: job.name,
      kind: job.status,
      elapsed: "", // caller may enrich; diff stays a status witness
      result: job.result ?? null,
    });
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* The knock census — a module-level observable, the census's third    */
/* segment. Counts UNACKNOWLEDGED finishers: facts the user has not    */
/* been shown a chance to see. Acknowledgement = returning to the tab  */
/* (the same reflex that makes a returning poll tick refresh cards).   */
/* ------------------------------------------------------------------ */

let knockCount = 0;
const knockSubs = new Set<() => void>();

export function getKnockCount(): number {
  return knockCount;
}

export function addKnocks(n: number): void {
  if (n <= 0) return;
  knockCount += n;
  for (const cb of knockSubs) cb();
}

export function clearKnocks(): void {
  if (knockCount === 0) return;
  knockCount = 0;
  for (const cb of knockSubs) cb();
}

export function subscribeKnock(cb: () => void): () => void {
  knockSubs.add(cb);
  return () => knockSubs.delete(cb);
}

/** The flicker's frame A: the unread dialect every inbox, mail client
 *  and chat app already trained the user to read — a parenthesized
 *  count riding the title's head. Frame B is the census title itself. */
export function knockTitlePrefix(n: number): string {
  return n > 0 ? `(${n}) ` : "";
}

/* ------------------------------------------------------------------ */
/* The decision — one sweep in, one plan out.                          */
/* ------------------------------------------------------------------ */

export interface NotificationDraft {
  title: string;
  body: string;
}

export interface KnockPlan {
  /** ONE chime per sweep regardless of N (aggregation law). */
  chime: boolean;
  /** ONE notification per sweep — solo form or digest, never N. */
  notification: NotificationDraft | null;
  /** Facts to add to the title knock (every finisher counts, even when
   *  the sound/notify channels are opted out — the flicker is the
   *  always-on layer). */
  knocks: number;
}

export interface KnockContext {
  /** document.hidden at sweep time — the visible/hidden split's hinge. */
  hidden: boolean;
  /** User opted into the chime (header bell). */
  soundOn: boolean;
  /** Notification.permission ("granted" | "default" | "denied" | "unsupported"). */
  perm: string;
}

const NOTIF_ROSTER_CAP = 4; // an OS toast is smaller than an app toast — cap tighter

export function planKnock(events: FinishEvent[], ctx: KnockContext): KnockPlan {
  if (!ctx.hidden || events.length === 0) {
    // visible tab: the toast law already spoke (or is about to) — the
    // knock stays silent in every channel, including the title (a title
    // flicker on a visible tab is a strobe, not a knock)
    return { chime: false, notification: null, knocks: 0 };
  }
  const completedN = events.filter((e) => e.kind === "completed").length;
  const failedN = events.length - completedN;
  const elapsedSuffix = (e: FinishEvent) => (e.elapsed ? ` · ${e.elapsed}` : "");

  let notification: NotificationDraft | null = null;
  if (ctx.perm === "granted") {
    if (events.length === 1) {
      const e = events[0];
      notification = {
        title: `${e.name} ${e.kind}${elapsedSuffix(e)}`,
        body:
          e.result?.trim() ||
          (e.kind === "completed"
            ? "Finished clean — results are ready in the inspector."
            : "Open the inspector for the log trail."),
      };
    } else {
      // the digest speaks the toast census dialect (t146): counts title,
      // one roster line per finisher in the form its solo announcement
      // would have had, remainder counted past the cap
      const parts: string[] = [];
      if (completedN) parts.push(`${completedN} completed`);
      if (failedN) parts.push(`${failedN} failed`);
      const roster = events.map(
        (e) => `${e.name} ${e.kind}${elapsedSuffix(e)}`,
      );
      const shown = roster.slice(0, NOTIF_ROSTER_CAP);
      const tail =
        roster.length > NOTIF_ROSTER_CAP
          ? `… and ${roster.length - NOTIF_ROSTER_CAP} more`
          : null;
      notification = {
        title: parts.join(" · "),
        body: [...shown, ...(tail ? [tail] : [])].join("\n"),
      };
    }
  }

  return {
    chime: ctx.soundOn,
    notification,
    knocks: events.length,
  };
}

/* ------------------------------------------------------------------ */
/* The chime — a synthesized two-tone (E5 → A5, the "someone's at the  */
/* door" interval), no audio asset, created inside the user gesture    */
/* that enabled it so no autoplay policy can strangle it later.        */
/* ------------------------------------------------------------------ */

let chimeCtx: AudioContext | null = null;

/** Must be called from a user-gesture call chain (the bell's toggle).
 *  Safe to call anywhere (guarded), but gesture-time creation is the
 *  contract that keeps the LATER hidden-tab play legal. */
export function primeKnockAudio(): void {
  try {
    if (typeof window === "undefined" || typeof AudioContext === "undefined") return;
    chimeCtx ??= new AudioContext();
    if (chimeCtx.state === "suspended") void chimeCtx.resume();
  } catch {
    chimeCtx = null; // no audio here — the other channels still speak
  }
}

export function playKnockChime(): void {
  try {
    if (!chimeCtx || chimeCtx.state !== "running") return;
    const t0 = chimeCtx.currentTime;
    const gain = chimeCtx.createGain();
    gain.connect(chimeCtx.destination);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55);
    for (const [freq, at] of [
      [659.25, 0], // E5
      [880.0, 0.16], // A5 — the answer
    ] as const) {
      const osc = chimeCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0 + at);
      osc.connect(gain);
      osc.start(t0 + at);
      osc.stop(t0 + at + 0.3);
    }
  } catch {
    // a chime must never become an error — the title flicker still speaks
  }
}

/* ------------------------------------------------------------------ */
/* Browser notifications — feature-detected, permission-honest.        */
/* ------------------------------------------------------------------ */

export type KnockPerm = "unsupported" | "default" | "granted" | "denied";

export function knockPermission(): KnockPerm {
  try {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    return Notification.permission as KnockPerm;
  } catch {
    return "unsupported";
  }
}

/** The permission as a tiny observable store, same shape as the sound
 *  preference: read once, published on every resolution, subscribed by
 *  the bell so the menu re-renders the moment the browser answers. */
let permCache: KnockPerm | null = null;
const permSubs = new Set<() => void>();

export function getKnockPerm(): KnockPerm {
  permCache ??= knockPermission();
  return permCache;
}

export function subscribeKnockPerm(cb: () => void): () => void {
  permSubs.add(cb);
  return () => permSubs.delete(cb);
}

export async function requestKnockPermission(): Promise<KnockPerm> {
  try {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported";
    }
    const result = await Notification.requestPermission();
    const p = (result as KnockPerm) ?? "default";
    permCache = p;
    for (const cb of permSubs) cb();
    return p;
  } catch {
    permCache = "denied"; // some browsers throw on refusal — treat as refused
    for (const cb of permSubs) cb();
    return "denied";
  }
}

/** tag collapses same-tag notifications so a burst of sweeps can never
 *  stack OS toasts; onclick focuses the tab (best effort — the user
 *  asked to be told, the least the door can do is open). */
export function sendKnockNotification(draft: NotificationDraft): void {
  try {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    const n = new Notification(draft.title, {
      body: draft.body,
      tag: "cryoflow-finish",
      // silent: the chime is OUR sound and speaks once per sweep — the
      // OS sound doubling it would break the aggregation law audibly
      silent: true,
    } as NotificationOptions & { silent?: boolean });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* best effort */
      }
    };
  } catch {
    /* never an error */
  }
}

/* ------------------------------------------------------------------ */
/* The sound preference — written ONLY inside the user gesture that    */
/* flips the bell toggle (t157-F: a fresh boot writes zero keys).      */
/* ------------------------------------------------------------------ */

export const KNOCK_SOUND_KEY = "cryoflow.knock.sound";

export function readKnockSound(): boolean {
  try {
    return window.localStorage.getItem(KNOCK_SOUND_KEY) === "1";
  } catch {
    return false;
  }
}

/** The sound preference as a tiny observable store — the canonical cure
 *  (use-now.ts doctrine) for client-only values that used to need a
 *  setState-in-effect seed: server snapshot is "off" (hydration starts
 *  matched), the client snapshot reads (and caches) the real key, and
 *  writes go through here so every subscriber re-renders in step. */
let soundCache: boolean | null = null;
const soundSubs = new Set<() => void>();

export function getKnockSound(): boolean {
  soundCache ??= readKnockSound();
  return soundCache;
}

export function subscribeKnockSound(cb: () => void): () => void {
  soundSubs.add(cb);
  return () => soundSubs.delete(cb);
}

export function writeKnockSound(on: boolean): void {
  soundCache = on;
  try {
    window.localStorage.setItem(KNOCK_SOUND_KEY, on ? "1" : "0");
  } catch {
    /* private mode — the preference lives for the session only */
  }
  for (const cb of soundSubs) cb();
}
