#!/usr/bin/env node
/* t824 — the toast boot gap: a dispatch that fires between the Toaster's
 * render and its subscription was silently lost.
 *
 * The bug, witnessed live in this window: the shared-view landing's
 * MALFORMED-bounce toast ("This shared link could not be read") never
 * mounted — 24 polls from t=429ms to t=10537ms, zero hits, while the
 * address bar was already cleaned (the effect RAN, toast() WAS called).
 * The same mouth on the same page spoke fine at t≈5s (the honest-miss
 * toast, mounted 5308ms → died 10254ms — the Radix 5s duration, exact).
 * The anatomy: on hydration the landing's effect fires in the SAME
 * passive-effects pass as the layout's <Toaster/> subscription — page
 * subtree BEFORE layout sibling — and useToast's useState snapshot was
 * taken at render, never re-read. A dispatch in that commit window
 * updates memoryState, notifies an EMPTY listener set, and is lost
 * forever. The user consumed a dead link and the world said nothing.
 *
 * The fix: ONE line — at subscribe time, re-read memoryState
 * (setState(memoryState)). Any commit-window dispatch is pulled in when
 * the subscription attaches; when nothing moved, setState receives the
 * same reference and React bails out, so the resync is free. The deps
 * array and the cleanup are untouched (additive, not a rewrite).
 *
 * The probe pins the LAWS statically (source reads — the fleet's
 * calibre; every window bounded by the NEXT declaration, never a fixed
 * width — the t820/t822 instrument lesson):
 *
 *   A. the resync law (what closes the gap)
 *      1. setState(memoryState) rides INSIDE the subscribe effect,
 *         AFTER the push — the resync happens at attach time
 *      2. the lesson's comment rides where the next sweep reads it
 *         (the boot gap + the landing victim named in the file)
 *      3. the subscription semantics are UNCHANGED — deps still [state],
 *         cleanup still splices (additive fix, not a rewrite)
 *
 *   B. the victims' mouth (the landing's three honest verdicts)
 *      4. the malformed bounce still speaks FIRST — before any staging
 *      5. the one-shot contract is untouched: the bar is cleaned before
 *         any await-able store work
 *      6. the landed + could-not-land verdicts still ride the same
 *         mouth, after the retry loop's exhaustion cleanup
 *
 *   C. the mouth's mechanics (what the fix did NOT touch)
 *      7. dispatch still reduces memoryState then notifies the listeners
 *      8. the reducer still ADD_TOASTs to the head under TOAST_LIMIT
 *
 *   D. the calibre
 *      9. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";

const useToastSrc = readFileSync("src/hooks/use-toast.ts", "utf8");
const landingSrc = readFileSync("src/components/workflow/shared-view-landing.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => (cond ? pass++ : fails.push(label));

// ---- declaration-bounded windows ----
const win = (src, from, to) => {
  const a = src.indexOf(from);
  const b = to ? src.indexOf(to, a + 1) : src.length;
  return a >= 0 && (b > a || to === undefined) ? src.slice(a, b) : "";
};
const effectWin = win(useToastSrc, "listeners.push(setState)", "}, [state])");
const useToastWin = win(useToastSrc, "function useToast", "export { useToast, toast }");
const malformedWin = win(landingSrc, "if (!share)", "stage before the landing drive");
const effectLandingWin = win(landingSrc, "React.useEffect", "return () => {");
const retryWin = win(landingSrc, "for (let attempt", "this browser can reach right now");
const dispatchWin = win(useToastSrc, "function dispatch", "type Toast = Omit");
const reducerWin = win(useToastSrc, "case \"ADD_TOAST\"", "case \"UPDATE_TOAST\"");

// ---- A. the resync law ----
ok(
  effectWin.includes("listeners.push(setState)") &&
    effectWin.indexOf("setState(memoryState)") > effectWin.indexOf("listeners.push(setState)"),
  "A1 the resync rides at subscribe time, after the push",
);
ok(
  useToastWin.includes("boot gap") && useToastWin.includes("malformed-bounce"),
  "A2 the lesson's comment names the gap and the landing victim",
);
ok(
  useToastWin.includes("}, [state])") &&
    effectWin.includes("listeners.indexOf(setState)") &&
    effectWin.includes("listeners.splice(index, 1)"),
  "A3 the subscription semantics unchanged (deps [state], cleanup splices)",
);

// ---- B. the victims' mouth ----
ok(
  malformedWin.includes('"This shared link could not be read"') &&
    malformedWin.includes("return;") &&
    !malformedWin.includes("sessionStorage.setItem"),
  "B4 the malformed bounce speaks first, before any staging",
);
ok(
  effectLandingWin.includes("history.replaceState") &&
    effectLandingWin.indexOf("history.replaceState") < effectLandingWin.indexOf("openJob") &&
    effectLandingWin.includes("let alive = true"),
  "B5 the one-shot contract: the bar is cleaned before any store work",
);
ok(
  retryWin.includes("removeItem(PENDING_SHARE_KEY)") &&
    retryWin.indexOf("removeItem(PENDING_SHARE_KEY)") < retryWin.indexOf('"Shared view could not land"') &&
    landingSrc.includes('"Shared view landed"'),
  "B6 the landed + could-not-land verdicts ride the same mouth after exhaustion",
);

// ---- C. the mouth's mechanics ----
ok(
  dispatchWin.includes("reducer(memoryState, action)") &&
    dispatchWin.includes("listeners.forEach"),
  "C7 dispatch reduces memoryState, then notifies the listeners",
);
ok(
  reducerWin.includes("TOAST_LIMIT") && reducerWin.includes("[action.toast, ...state.toasts]"),
  "C8 ADD_TOAST still heads the list under TOAST_LIMIT",
);

// ---- D. the calibre ----
const apiDir = "src/app/api";
const apiEntries = readdirSync(apiDir).filter((f) => statSync(`${apiDir}/${f}`).isDirectory()).length;
ok(
  apiEntries === 18 && existsSync("src/app/api/route.ts"),
  "D9 the calibre: 18 api dirs + src/app/api/route.ts = 19 entries",
);

// ---- the verdict ----
console.log(`t824 toast-gap unit: ${pass} ok / ${fails.length} fail`);
for (const f of fails) console.log(`  FAIL ${f}`);
process.exit(fails.length ? 1 : 0);
