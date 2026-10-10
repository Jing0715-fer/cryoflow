#!/usr/bin/env node
/* t825 — the toast stack: the mouth holds three, and the queue learns
 * to bury.
 *
 * The feature: TOAST_LIMIT 1 → 3 (the t822 tuition was this constant's
 * live pain — the share flight toast kept dying early because ANY toast
 * fired during its five seconds evicted it; every ADD was an eviction),
 * and TOAST_REMOVE_DELAY 1e6 → 250 (the shadcn fossil kept dismissed
 * toasts in state for ~16.7 minutes — harmless under LIMIT=1, but SILT
 * under a stack: dead slots shrink the visible depth). The viewport
 * grows a gap so the eye can count the stack.
 *
 * The probe pins the LAWS — statically (source reads) and BEHAVIORALLY
 * (the reducer evaluated in isolation with the remove-queue stubbed —
 * the file's own constants feed the eval, so the behavior test always
 * rides the values on file):
 *
 *   A. the stack law (what holds)
 *      1. TOAST_LIMIT = 3 on file, the t822 tuition named in the
 *         constant's own comment window
 *      2. BEHAVIOR: four ADDs → three remain (the file's own limit)
 *      3. BEHAVIOR: newest first, tail evicted — the head verdict
 *         survives, the oldest leaves
 *
 *   B. the burial law (what leaves, when)
 *      4. TOAST_REMOVE_DELAY = 250 on file, the 1e6 fossil named (the
 *         silt story told in the constant's own window)
 *      5. BEHAVIOR: DISMISS sets open:false AND notifies the queue
 *      6. BEHAVIOR: REMOVE filters the id out (the burial completes)
 *      7. the burial covers the exit animation: 250 > ~150, and the
 *         closed-state classes carry animate-out / fade-out-80 /
 *         slide-out-to-right-full (the delay's reason, on file)
 *
 *   C. the stack's body (the viewport)
 *      8. gap-2 rides the viewport class list (LIMIT=1 never needed it)
 *      9. the placement/swipe contract untouched — flex-col-reverse +
 *         sm:flex-col + sm:bottom-0 sm:right-0 (the Task 174 law)
 *
 *   D. the resync guard (the t824 law must outlive this window)
 *     10. the resync still rides at subscribe time — setState(memoryState)
 *         after the listeners.push (the boot gap stays closed)
 *     11. the t824 lesson comment still names the gap and the victim
 *
 *   E. the calibre
 *     12. no new API route — 18 api dirs + src/app/api/route.ts = 19
 */

import { readFileSync, readdirSync, statSync } from "node:fs";

const hookSrc = readFileSync("src/hooks/use-toast.ts", "utf8");
const toastUi = readFileSync("src/components/ui/toast.tsx", "utf8");

let pass = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${label}`);
  } else {
    fails.push(label);
    console.log(`  FAIL  ${label}`);
  }
};

// ---- window helpers (the fifth amendment: bounded by the next
// declaration, never a fixed width) -------------------------------
const between = (src, startMarker, endMarker) => {
  const a = src.indexOf(startMarker);
  const b = src.indexOf(endMarker, a + 1);
  return a > -1 && b > a ? src.slice(a, b) : "";
};

// ---- the reducer, evaluated in isolation -------------------------
// The slice runs from the reducer's declaration to the next one
// ("const listeners"); the TS annotation on the signature is stripped;
// addToRemoveQueue (module-scope side effect) and TOAST_LIMIT
// (module-scope constant) are injected — TOAST_LIMIT read from the
// file's own bytes so the behavior test rides the value on file.
const limitM = hookSrc.match(/const TOAST_LIMIT = (\d+)/);
const delayM = hookSrc.match(/const TOAST_REMOVE_DELAY = (\d+)/);
const reducerSrc = between(hookSrc, "export const reducer", "const listeners")
  .replace("export const reducer", "const reducer")
  .replace("(state: State, action: Action): State", "(state, action)");
const makeReducer = (queue) =>
  new Function("addToRemoveQueue", "TOAST_LIMIT", `${reducerSrc}\nreturn reducer;`)(
    queue,
    Number(limitM ? limitM[1] : 0)
  );

console.log("A. the stack law (what holds)");
{
  const win = between(hookSrc, "// t825 — the stack:", "type ToasterToast");
  ok(
    !!limitM && limitM[1] === "3",
    "A1 TOAST_LIMIT = 3 on file"
  );
  ok(
    win.includes("t822") && win.includes("every ADD is an eviction"),
    "A1b the constant's window names the t822 tuition (every ADD was an eviction)"
  );

  const reducer = makeReducer(() => {});
  let s = { toasts: [] };
  for (let i = 1; i <= 4; i++) {
    s = reducer(s, { type: "ADD_TOAST", toast: { id: String(i), open: true } });
  }
  ok(
    s.toasts.length === Number(limitM ? limitM[1] : 0),
    "A2 BEHAVIOR: four ADDs → the file's own limit remain"
  );
  ok(
    s.toasts.map((t) => t.id).join(",") === "4,3,2",
    "A3 BEHAVIOR: newest first, tail evicted — the head verdict survives"
  );
}

console.log("B. the burial law (what leaves, when)");
{
  const win = between(hookSrc, "// t825 — the queue learns to bury", "type ToasterToast");
  ok(
    !!delayM && delayM[1] === "250",
    "B4 TOAST_REMOVE_DELAY = 250 on file"
  );
  ok(
    win.includes("1e6") && win.includes("16.7") && win.includes("SILT"),
    "B4b the window names the 1e6 fossil and the silt it becomes under a stack"
  );

  const queueCalls = [];
  const reducer = makeReducer((id) => queueCalls.push(id));
  let s = { toasts: [] };
  for (let i = 1; i <= 3; i++) {
    s = reducer(s, { type: "ADD_TOAST", toast: { id: String(i), open: true } });
  }
  s = reducer(s, { type: "DISMISS_TOAST", toastId: "3" });
  ok(
    s.toasts.length === 3 &&
      s.toasts[0].open === false &&
      queueCalls.includes("3"),
    "B5 BEHAVIOR: DISMISS sets open:false AND notifies the queue"
  );
  s = reducer(s, { type: "REMOVE_TOAST", toastId: "3" });
  ok(
    s.toasts.length === 2 && !s.toasts.some((t) => t.id === "3"),
    "B6 BEHAVIOR: REMOVE filters the id out — the burial completes"
  );

  const animWin = between(toastUi, "const toastVariants = cva(", "const Toast = React.forwardRef");
  ok(
    Number(delayM ? delayM[1] : 0) > 150 &&
      animWin.includes("data-[state=closed]:animate-out") &&
      animWin.includes("fade-out-80") &&
      animWin.includes("slide-out-to-right-full"),
    "B7 the burial covers the exit animation (250 > ~150, the closed-state classes on file)"
  );
}

console.log("C. the stack's body (the viewport)");
{
  const win = between(toastUi, "// t825 — the stack's breathing room", "ToastViewport.displayName");
  ok(
    win.includes("gap-2"),
    "C8 gap-2 rides the viewport class list — the eye can count the stack"
  );
  ok(
    win.includes("flex-col-reverse") &&
      win.includes("sm:flex-col") &&
      win.includes("sm:bottom-0 sm:right-0"),
    "C9 the placement contract untouched (flex-col-reverse / sm:flex-col / bottom-right — Task 174's law)"
  );
}

console.log("D. the resync guard (the t824 law outlives this window)");
{
  // the window starts at the effect's OPENING — the push rides BEFORE
  // the t824 comment, so a comment-anchored window would amputate the
  // very line this law pins (the instrument's own first draft did).
  const win = between(hookSrc, "React.useEffect(() => {", "}, [state])");
  ok(
    win.indexOf("listeners.push(setState)") > -1 &&
      win.indexOf("listeners.push(setState)") < win.indexOf("setState(memoryState)") &&
      win.includes("setState(memoryState)"),
    "D10 the resync still rides at subscribe time, after the push"
  );
  ok(
    win.includes("t824") && win.includes("boot gap"),
    "D11 the t824 lesson comment still names the gap and its victim"
  );
}

console.log("E. the calibre");
{
  const apiRoot = "src/app/api";
  const dirs = readdirSync(apiRoot).filter((f) => statSync(`${apiRoot}/${f}`).isDirectory());
  const hasRootRoute = statSync("src/app/api/route.ts").isFile();
  ok(
    dirs.length === 18 && hasRootRoute && dirs.length + 1 === 19,
    `E12 no new API route — ${dirs.length} api dirs + src/app/api/route.ts = ${dirs.length + 1} entries`
  );
}

console.log("");
if (fails.length) {
  console.error(`t825-toast-stack-unit: ${fails.length} FAILED`);
  process.exit(1);
}
console.log(`t825-toast-stack-unit: ${pass} pass / 0 fail`);
