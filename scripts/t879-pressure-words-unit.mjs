// t879 — THE PRESSURE WORDS UNIT: the OOM war's ledger gets its product
// face, and the face gets its pins.
//
// The window's story: the film leg's mirror witness died seven times to
// the same killer — `chrome invoked oom-killer … Killed process 31189
// (next-server) … anon-rss:2770392kB` — and no memory-lane bar could
// NAME it. The cure is a diagnostics face that quotes the kernel ring's
// own testimony: how many kills this boot, who died last (and how big),
// who held the allocator's rope, what THIS server parks in RSS. The law
// it rides: evidence-from-bytes (the module header's) gains one clause —
// the kernel's ring IS bytes; the "no process sniffing" law stays intact
// (nothing enumerates live processes; the ring remembers the dead).
//
// Pins: the parser's faces on fixtures (count, the victim's comm and the
// anon-rss math, the invoker NEAREST the last kill, the kthreadd skip,
// the zero-kill face, malformed-line tolerance); the presenter's three
// wordings (kills, no-kill, unreadable ring) riding the SAME fixture
// through presentSystemDiagnostics; the source laws (the payload type
// carries pressure, readDiagnostics composes it, the route's doc names
// the ring, the dialog's memory card carries the diag-pressure row, the
// bench carries the ledger pins).
//
// node scripts/unit-runner.mjs scripts/t879-pressure-words-unit.mjs
//

import { readFileSync } from "node:fs";
import {
  composeMemoryLanes,
  parseOomRing,
  readMemoryPressure,
  presentSystemDiagnostics,
} from "@/lib/diagnostics";

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(`${ROOT}/${rel}`, "utf8");

// ── fixture: the t879 window's real ring shape (names/numbers shifted) ──

const FIXTURE = [
  "[100.1] chrome invoked oom-killer: gfp_mask=0x100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=0",
  " oom_kill_process+0x10b/0x210",
  "Tasks state (memory values in kB):",
  "[ 100.2] Out of memory: Killed process 900 (python3) total-vm:1000000kB, anon-rss:1048576kB, file-rss:1000kB, shmem-rss:0kB, UID:1001",
  "[100.3] chrome invoked oom-killer: gfp_mask=0x100dca(GFP_HIGHUSER_MOVABLE|__GFP_ZERO), order=0, oom_score_adj=300",
  "[ 100.4] Out of memory: Killed process 901 (next-server (v1)) total-vm:65000000kB, anon-rss:2793236kB, file-rss:22000kB, shmem-rss:0kB, UID:1001 pgtables:40000kB",
  "[100.5] oom_reaper reaped process 901 (next-server (v1)), now anon-rss:0kB",
].join("\n");

// ── A — the parser's faces ──────────────────────────────────────────────

{
  const r = parseOomRing(FIXTURE);
  ok("A1 the ring's kill count is the ledger's count", r.oomKills === 2, `${r.oomKills} kills (the reaper's own line never counts)`);
  ok("A2 the last victim is named with the anon-rss math", r.lastVictim?.comm === "next-server (v1)" && r.lastVictim?.rssMb === 2728, `${r.lastVictim?.comm} at ${r.lastVictim?.rssMb}MB (2793236kB → /1024)`);
  ok("A3 the invoker is the one NEAREST the last kill", r.lastInvoker === "chrome", `${r.lastInvoker} (not a stale earlier allocator)`);
}

{
  const r = parseOomRing("nothing happened here — a quiet ring");
  ok("A4 a quiet ring answers zero and honest nulls", r.oomKills === 0 && r.lastVictim === null && r.lastInvoker === null, JSON.stringify(r));
}

{
  const withKthreadd = "[1.0] kthreadd invoked oom-killer\n[1.1] Out of memory: Killed process 5 (node) total-vm:1kB, anon-rss:2048000kB\n";
  const r = parseOomRing(withKthreadd);
  ok("A5 kernel housekeeping invokers are skipped", r.lastInvoker === null, `kthreadd is the killer's own house, not a rope-holder`);
}

{
  const messy = "invoked oom-killer with no timestamp prefix\nOut of memory: Killed process 7 (bash) total-vm:9kB\n";
  const r = parseOomRing(messy);
  ok("A6 malformed lines never crash the parse", r.oomKills >= 0 && typeof r.lastInvoker === "string" || r.lastInvoker === null, `count ${r.oomKills}, invoker ${JSON.stringify(r.lastInvoker)}`);
}

{
  const r = parseOomRing("");
  ok("A7 an empty ring is zero kills, no victim, no invoker", r.oomKills === 0 && r.lastVictim === null && r.lastInvoker === null, "the honest empty");
}

// ── B — the presenter's three wordings ──────────────────────────────────

{
  const lanes = composeMemoryLanes({ memTotalMb: 4041, memAvailableMb: 3277, buffCacheMb: 297, swapTotalMb: 0 });
  const payload = {
    memory: lanes,
    disk: { totalMb: 10138, freeMb: 2048, usedPct: 79 },
    provenance: { commit: "4150a1b9", standalone: false },
    world: { projects: 1, jobs: 16, runningJobs: 0 },
    durability: null,
    pressure: { oomKills: 2, lastVictim: { comm: "next-server (v1)", rssMb: 2726 }, lastInvoker: "chrome", selfRssMb: 412 },
    generatedAt: "2026-11-05T00:00:00.000Z",
  };
  const res = presentSystemDiagnostics(payload);
  const s = res.summary ?? "";
  ok("B1 the kill ledger rides the locator line", /2 OOM kills this boot/.test(s), s.match(/the kernel ring carries 2 OOM kills[^.]*/)?.[0]?.slice(0, 60));
  ok("B2 the victim's name and size ride it too", /next-server \(v1\) at 2726MB/.test(s), "the whale named");
  ok("B3 the allocator's rope is named", /invoked by chrome/.test(s), "chrome held the rope");
  ok("B4 the server's own footprint rides it", /this server parks at 412MB/.test(s), "self VmRSS");
}

{
  const quiet = {
    memory: null,
    disk: null,
    provenance: { commit: null, standalone: false },
    world: null,
    durability: null,
    pressure: { oomKills: 0, lastVictim: null, lastInvoker: null, selfRssMb: null },
    generatedAt: "2026-11-05T00:00:00.000Z",
  };
  const s = presentSystemDiagnostics(quiet).summary ?? "";
  ok("B5 the quiet ring says so", /no OOM kill in the kernel ring this boot/.test(s), "zero kills is a face, not an absence");
}

{
  const muted = {
    memory: null,
    disk: null,
    provenance: { commit: null, standalone: false },
    world: null,
    durability: null,
    pressure: null,
    generatedAt: "2026-11-05T00:00:00.000Z",
  };
  const s = presentSystemDiagnostics(muted).summary ?? "";
  ok("B6 an unreadable ring is SAID, never guessed", /not ours to read/.test(s), "the EPERM face");
}

// ── C — the source laws ─────────────────────────────────────────────────

const libSrc = read("src/lib/diagnostics.ts");
ok("C1 the payload type carries the pressure field", libSrc.includes("pressure: MemoryPressure | null;"), "DiagnosticsPayload grew the ledger");
ok("C2 readDiagnostics composes the pressure leg", libSrc.includes("Promise.resolve(readMemoryPressure())"), "the 4-way Promise.all");
ok("C3 the reader caps the ring spawn", /spawnSync\("dmesg", \[\], \{\s*timeout: 3000/.test(libSrc), "3s — the diagnostics read never hangs the route");
ok("C4 the module header's evidence law names the ring", libSrc.includes("past kills, not a live process walk"), "the no-sniffing law intact");

const routeSrc = read("src/app/api/diagnostics/route.ts");
ok("C5 the route's door stays first and its doc tells the truth", routeSrc.indexOf("isLocalRequest(request)") >= 0 && routeSrc.includes("readDiagnostics"), "the t259 law unchanged");

const dialogSrc = read("src/components/workflow/system-diagnostics-dialog.tsx");
ok("C6 the dialog's memory card carries the ledger row", dialogSrc.includes('data-testid="diag-pressure"'), "the t879 face renders where the lanes live");
ok("C7 the row speaks all three wordings", dialogSrc.includes("OOM kill") && dialogSrc.includes("No OOM kill in the kernel ring this boot") && dialogSrc.includes("The kernel ring was not ours to read"), "kills · quiet · unknown");

const benchSrc = read("scripts/t530-diagnostics-bench.ts");
ok("C8 the bench pins the ledger", benchSrc.includes("2 OOM kills") && benchSrc.includes("invoked by chrome"), "the t530 cup grew with the face");

const clientSrc = read("src/lib/types.ts");
ok("C9 the client mirror grew the same shape", clientSrc.includes("MemoryPressureClient") && clientSrc.includes("pressure: MemoryPressureClient | null;"), "one shape, two lanes");

// ── D — the live face (read-only, best-effort) ──────────────────────────

{
  let live = "unavailable";
  try {
    const p = readMemoryPressure();
    live = p === null ? "null (the ring was not ours to read)" : `${p.oomKills} kills, last victim ${p.lastVictim ? `${p.lastVictim.comm} at ${p.lastVictim.rssMb}MB` : "none"}, self ${p.selfRssMb ?? "?"}MB`;
  } catch (e) {
    live = `threw: ${e.message}`;
  }
  ok("D1 the live read answers without throwing", !live.startsWith("threw"), live);
}

console.log(`\nt879 pressure-words unit: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
