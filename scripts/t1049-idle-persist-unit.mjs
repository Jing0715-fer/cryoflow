#!/usr/bin/env node
/**
 * t1049 — THE IDLE PERSIST unit (node-only): the gremlin's silence,
 * pinned at source. The t1047/t1048 ledger's dialog self-closer is
 * CLOSED: the killer was the app's own background writers churning the
 * dev watcher (every project-tree write = a rebuild; a Fast Refresh
 * rebuild that cannot apply falls back to a full reload; the reload
 * wipes the client state — the dialogs die). Two pulses measured live:
 * the judge watermark (a fresh Date.now() written EVERY 30s idle tick —
 * content always differs, the write never rests) and the relion
 * detection snapshot (a fresh savedAt over identical bytes).
 *
 * THE CURES PINNED HERE:
 *   A  the watermark's IDLE PERSIST THROTTLE (judge-worker.ts): the RAM
 *      edge moves every tick (the memory never throttles), the disk
 *      hears about an idle edge at most once per span (IDLE_PERSIST_MS),
 *      the span's clock advances WHEN the write lands, and a JUDGED
 *      seat persists immediately (real advancement never waits);
 *   B  the snapshot's SAME-CONTENT GUARD (relion/system.ts): the body
 *      is the voice, the savedAt is bookkeeping — an identical body
 *      never touches the disk, the cache mirrors what THIS process
 *      wrote, and a fresh boot's first write always lands;
 *   C  the walk's own face cure (molstar-embed.tsx): the INTENT RENDER
 *      CLOCK — applyClipIntent mutates the ref first, and a same-values
 *      drag made every field setState a bail-out (the readout froze at
 *      "—" while the 3D clip moved); the clock bumps on EVERY intent,
 *      so the ref-driven faces repaint in lockstep with the drag.
 *
 * PROTOCOL: node-only, readFileSync includes, exit honest, receipt to
 * shots-qa/.t1049-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1049-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, hint) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${hint ? ` — ${hint}` : ""}`); }
};

const judge = read("src/lib/ai/judge-worker.ts");
const system = read("src/lib/relion/system.ts");
const embed = read("src/components/workflow/results/molstar-embed.tsx");

console.log("A — the watermark's idle persist throttle (judge-worker.ts)");
{
  ok("A1 the span constant is born (IDLE_PERSIST_MS = 10 * 60_000)", judge.includes("const IDLE_PERSIST_MS = 10 * 60_000;"));
  ok("A2 the idle clock is born beside it (lastIdlePersistAt)", judge.includes("let lastIdlePersistAt = 0;"));
  ok("A3 the law comment names the pulse (the 30s heartbeat was the gremlin's)", judge.includes("the 30s\n * heartbeat was the gremlin's pulse"));
  const idleIdx = judge.indexOf("if (candidates.length === 0) {");
  const idleBlock = judge.slice(idleIdx, idleIdx + 700);
  ok("A4 the RAM edge moves EVERY tick (s.watermark = scanStart outside the gate)", /s\.watermark = scanStart;\s*\n\s*if \(scanStart - lastIdlePersistAt >= IDLE_PERSIST_MS\) \{/.test(idleBlock));
  ok("A5 the disk gates on the span (scanStart - lastIdlePersistAt >= IDLE_PERSIST_MS)", idleBlock.includes("if (scanStart - lastIdlePersistAt >= IDLE_PERSIST_MS) {"));
  ok("A6 the clock advances WHEN the write lands (inside the gate)", /lastIdlePersistAt = scanStart;\s*\n\s*writeWatermark\(scanStart\);/.test(idleBlock));
  const judgedIdx = judge.indexOf("writeWatermark(target.updatedAtMs);");
  const judgedLine = judge.slice(judgedIdx, judgedIdx + 160);
  ok("A7 a judged seat persists UNCONDITIONALLY (real advancement never waits)", judgedLine.includes("writeWatermark(target.updatedAtMs); // a judged seat: real advancement"));
  ok("A8 the judged write resets the idle clock too", judgedLine.includes("lastIdlePersistAt = Date.now();"));
  ok("A9 the recovery-only doctrine is spoken (the stamps carry the correctness)", judge.includes("the per-job stamps carry the\n * correctness"));
}

console.log("B — the snapshot's same-content guard (relion/system.ts)");
{
  ok("B1 the body cache is born (lastSnapshotBody)", system.includes("let lastSnapshotBody: string | null = null;"));
  ok("B2 the guard compares the FACTS (the probe clock stripped)", system.includes("const { checkedAt: _probeClock, ...facts } = persist;"));
  ok("B3 the skip path rests the disk (return before the write)", /if \(body === lastSnapshotBody\) return;/.test(system));
  ok("B4 the cache mirrors the write (the assignment precedes it)", /lastSnapshotBody = body;\s*\n\s*writeFileSync\(/.test(system));
  ok("B5 the body strips the fromCache marker (the persist contract kept)", /const persist = \{ \.\.\.status \};\s*\n\s*delete persist\.fromCache;/.test(system));
  ok("B6 the doctrine is spoken (a stale mirror must never silence a real change)", system.includes("a stale mirror must never silence a real change"));
  ok("B7 the gremlin's other pulse is named in the law (every tree write is a rebuild trigger)", system.includes("every tree write is a rebuild trigger"));
  ok("B8 the clock-exclusion doctrine is spoken (a more honest age than the last probe)", system.includes("a more honest age than \"the last probe\""));
}

console.log("C — the intent render clock (molstar-embed.tsx)");
{
  ok("C1 the clock is born beside the clip states (useState(0))", embed.includes("const [, setClipRenderClock] = useState(0);"));
  ok("C2 the law names the bail-out (the ref moved, the faces did not)", embed.includes("every setState is a bail-out and the component never\n  // re-renders: the ref moved, the faces did not"));
  const intentIdx = embed.indexOf("clipStateRef.current = {");
  const intentBlock = embed.slice(intentIdx, intentIdx + 600);
  ok("C3 the bump is UNCONDITIONAL and fresh-valued (the bail-out never eats it)", intentBlock.includes("setClipRenderClock((c) => c + 1);"));
  ok("C4 the bump rides the ref write (the faces follow the mutation)", /rev: clipStateRef\.current\.rev \+ 1,\s*\n\s*\};\s*\n[\s\S]*?setClipRenderClock/.test(intentBlock));
  ok("C5 the doctrine is spoken (the ref's rev and the render agree)", embed.includes("the ref's rev and the render agree"));
}

mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({ unit: "t1049-idle-persist-unit", at: new Date().toISOString(), pass, fail }, null, 2));

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
