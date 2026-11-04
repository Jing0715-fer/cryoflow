#!/usr/bin/env node
/**
 * t996-picker-error-unit — the census's 29th instrument.
 *
 * THE STORY: the rounds picker's phase machine (t398's popover — the
 * alertdialog plane's sibling) has carried an honest fetch-error face
 * since its birth: a phase-level `error` state, the server's own reason
 * in the message (or the fallback sentence when no reason exists), and
 * the "Try again" affordance whose click rides the ?refresh=1 lane —
 * the 8s TTL bypassed BY CONSTRUCTION. Until t996 no walk had ever
 * witnessed that face live: the transport has never died under the
 * popover in the whole family's history. The t994 entry's candidate ②
 * (carried through t995) named the seat; the t996 walk sits in it.
 *
 * THE CONTRACT PINNED (in-process includes — the capture-layer law
 * t957 pinned: never a plain-text echo of source bytes):
 *   P1  the phase machine speaks four states (idle/loading/ready/error).
 *   P2  the fetchError lane exists as its own string state.
 *   P3  the throw carries the server's OWN reason before the HTTP form.
 *   P4  the 8s TTL guard stands (the lazy-open economy).
 *   P5  the refresh lane rides ?refresh=1 (both TTLs bypassed).
 *   P6  Try again's click is load(true) — the affordance IS the bypass.
 *   P7  the no-reason fallback sentence ("could not read the rounds").
 *   P8  the error face speaks in the destructive voice.
 *   P9  the popover names itself ("Rounds you can continue from").
 *   P10 the trigger names itself ("Pick which previous round to
 *       continue from").
 *   P11 the refresh affordance names itself ("Re-read the rounds from
 *       the engine and the cluster").
 *   P12 the route's NEVER-500 law: cluster trouble answers 200 with the
 *       per-source error (the ready face holds; the picker degrades to
 *       an honest note — phase error is TRANSPORT-only by design).
 *   P13 the route's error payload speaks serverErrorMessage.
 *   P14 the verb-row sister face: a failed scan leaves the verb ABSENT
 *       rather than guessing (the t454 honesty law, the row's form).
 *   P15 the verb-row's transport throw rides httpErrorFrom (t959 — the
 *       door's own reason).
 *   P16 the walk exists in the tree and names its receipt.
 *   P17 the walk rides the family's shared skeleton (createWalk import —
 *       the t991 kit law; no copy-pasted organs).
 *
 *   node scripts/t996-picker-error-unit.mjs
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import url from "url";

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const PANEL = path.join(ROOT, "src/components/workflow/job-panel.tsx");
const ROUTE = path.join(ROOT, "src/app/api/jobs/[id]/continue-sources/route.ts");
const VERB = path.join(ROOT, "src/components/workflow/results/continue-verb-row.tsx");
const WALK = path.join(ROOT, "scripts/t996-picker-error-walk.mjs");

const panel = readFileSync(PANEL, "utf8");
const route = readFileSync(ROUTE, "utf8");
const verb = readFileSync(VERB, "utf8");

let pass = 0;
let fail = 0;
function ok(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* P1 — the four-state phase machine */
ok("P1 the phase machine speaks idle/loading/ready/error",
  panel.includes(`"idle" | "loading" | "ready" | "error"`));

/* P2 — the fetchError lane is its own state */
ok("P2 the fetchError lane exists",
  panel.includes("const [fetchError, setFetchError] = React.useState<string | null>(null);"));

/* P3 — the server's own reason rides before the HTTP form */
ok("P3 the throw carries data.error before the HTTP fallback",
  panel.includes("throw new Error(data.error ?? `HTTP ${res.status}`)"));

/* P4 — the 8s TTL guard */
ok("P4 the 8s TTL guard stands",
  panel.includes("Date.now() - fetchedAtRef.current < 8000"));

/* P5 — the refresh lane */
ok("P5 the fetch URL carries the refresh lane",
  panel.includes('${refresh ? "?refresh=1" : ""}'));

/* P6 — Try again IS the bypass */
ok("P6 Try again's click is load(true) (the TTL bypassed by the affordance)",
  panel.includes("onClick={() => void load(true)}"));

/* P7 — the no-reason fallback sentence */
ok("P7 the fallback sentence exists",
  panel.includes('could not read the rounds'));

/* P8 — the destructive voice on the error face */
ok("P8 the error face speaks the destructive voice",
  /phase === "error" && \([\s\S]{0,200}text-destructive/.test(panel));

/* P9-P11 — the named instruments */
ok("P9 the popover names itself",
  panel.includes('aria-label="Rounds you can continue from"'));
ok("P10 the trigger names itself",
  panel.includes('aria-label="Pick which previous round to continue from"'));
ok("P11 the refresh affordance names itself",
  panel.includes('aria-label="Re-read the rounds from the engine and the cluster"'));

/* P12 — the NEVER-500 law (the phase/source contrast's foundation) */
ok("P12 the route answers 200 with the per-source error (never a 500)",
  route.includes("status: 200"), "the catch's answer is a 200 envelope");
ok("P12b the catch keeps sources in the payload",
  route.includes("{ sources: [], error: serverErrorMessage("));

/* P13 — the server error voice */
ok("P13 the route speaks serverErrorMessage",
  route.includes("serverErrorMessage(\"GET /api/jobs/[id]/continue-sources\", error)"));

/* P14 — the verb-row sister's honesty */
ok("P14 the verb-row's scan-refusal sentence stands",
  verb.includes("the continue verb stays absent rather than guessing"));

/* P15 — the verb-row's transport throw */
ok("P15 the verb-row throws httpErrorFrom on !res.ok",
  verb.includes("if (!res.ok) throw await httpErrorFrom(res);"));

/* P16 — the walk is in the tree */
ok("P16 the walk exists and names its receipt",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes("t996-picker-error-walk.json"));

/* P17 — the kit law */
ok("P17 the walk rides the shared skeleton",
  existsSync(WALK) && readFileSync(WALK, "utf8").includes('from "./walk-kit.mjs"'));

console.log(`== t996-picker-error-unit ${pass}/${pass + fail} green ==`);
process.exit(fail === 0 ? 0 : 1);
