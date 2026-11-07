#!/usr/bin/env node
/**
 * t1045-remote-monitor-seat-unit — the inspector's remote-monitor seat.
 *
 * The seat: the inspector watches a REMOTE run's slurm state and its
 * cluster ledger, but the cluster MANAGER itself (connections,
 * heartbeats, the module set) had no seat there — the user staring at a
 * remote run had to leave the inspector to find the header's door. The
 * action cluster grows the seat, and it rides the t483 handshake law
 * VERBATIM: the surface that names the door never mounts a second
 * dialog, it only rings the owner's bell — the SAME
 * REMOTE_CLUSTERS_OPEN_EVENT the header's chip and the palette row
 * ring. Presence rides the project's own binding (the t300 law): a
 * project whose data lives on a cluster carries the seat; a local
 * project carries none — a lying seat is worse than no seat.
 *
 * Bands:
 *   A — the seat's face (source pins on job-inspector.tsx): the testid,
 *       the family's word verbatim (aria-label), the teaching title, the
 *       cluster-manager icon (Network — the palette row's own face, NOT
 *       the dispatch Server beside it: two doors, two words), the bell
 *       ring verbatim, and the presence gate at the render.
 *   B — the handshake law (the t483 pin): the inspector imports ONLY
 *       the event constant (never the dialog component — no second
 *       mounting), the owner still listens (the dialog's openit stands),
 *       and the bell has many ringers (the header chip, the palette
 *       row) — one bell, many ringers, one dialog.
 *   C — the presence law on real data (the mirrored gate) + the
 *       neighbors' pins: the dispatch Server stands beside the seat
 *       (two doors, two words), the cleanup eraser follows, and the
 *       gate's arithmetic on real project shapes (bound → seat,
 *       null/absent → none).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const inspector = readFileSync(path.join(ROOT, "src/components/workflow/job-inspector.tsx"), "utf8");
const dialog = readFileSync(path.join(ROOT, "src/components/workflow/remote-cluster-dialog.tsx"), "utf8");
const header = readFileSync(path.join(ROOT, "src/components/workflow/header.tsx"), "utf8");
const palette = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");

let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`  ok ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

console.log("A — the seat's face");
{
  const seatIdx = inspector.indexOf('data-testid="inspector-remote-monitor-seat"');
  ok(seatIdx > 0, "the seat is born (the testid)");
  const seatWindow = inspector.slice(seatIdx - 2200, seatIdx + 500);
  ok(seatWindow.includes('aria-label="Manage remote clusters"'), "the family's word verbatim (the palette row's own aria-label)");
  ok(seatWindow.includes("connections, heartbeats, job dispatch"), "the title teaches the manager's contents");
  ok(seatWindow.includes("<Network className=\"size-3.5\" aria-hidden=\"true\" />"), "the icon is the cluster-manager face's own (Network, not the dispatch Server)");
  ok(seatWindow.includes("window.dispatchEvent(new CustomEvent(REMOTE_CLUSTERS_OPEN_EVENT))"), "the click rings the OWNER's bell verbatim (the t483 handshake)");
  ok(seatWindow.includes("{projectRemote != null && ("), "the presence gate rides the render (bound → seat, local → none)");
  ok(seatWindow.includes("{/* t1045 — the remote-monitor seat"), "the seat's comment stands (the law's seat in the source)");
}

console.log("B — the handshake law (the t483 pin)");
{
  // the inspector imports ONLY the event constant — never the dialog component
  ok(inspector.includes('import { REMOTE_CLUSTERS_OPEN_EVENT } from "./remote-cluster-dialog"'), "the inspector imports the bell (the event constant)");
  ok(!inspector.includes("RemoteClusterButton"), "the inspector mounts NO second dialog (no RemoteClusterButton in the inspector)");
  ok(!inspector.includes("useRemoteConnections"), "the inspector holds no connections state (the owner's state stays the owner's)");

  // the owner still listens
  ok(dialog.includes("window.addEventListener(REMOTE_CLUSTERS_OPEN_EVENT, openit)"), "the owner still listens (the dialog's openit stands)");

  // one bell, many ringers
  ok(header.includes("RemoteClusterButton"), "the header chip stands (the owner's mount)");
  ok(palette.includes("new CustomEvent(REMOTE_CLUSTERS_OPEN_EVENT)"), "the palette row still rings the same bell");
}

console.log("C — the presence law on real data + the neighbors' pins");
{
  // the mirrored gate — the arithmetic the render speaks
  const gate = (project) => (project?.remote ?? null) != null;
  ok(gate({ remote: { connectionId: "conn-mv8ogdoy" } }) === true, "a remote-bound project carries the seat");
  ok(gate({ remote: null }) === false, "a local project (remote null) carries none");
  ok(gate({}) === false, "an absent remote field carries none (the legacy shape)");
  ok(gate(null) === false, "no project at all carries none (the boot race)");

  // the neighbors — two doors, two words, then the eraser
  const seatIdx = inspector.indexOf('data-testid="inspector-remote-monitor-seat"');
  const before = inspector.slice(0, seatIdx);
  const serverIdx = before.lastIndexOf('aria-label="Run on cluster (SSH)"');
  ok(serverIdx > 0 && seatIdx - serverIdx < 2400, "the dispatch Server stands beside the seat (two doors, two words)");
  const after = inspector.slice(seatIdx, seatIdx + 1400);
  ok(after.includes('aria-label="Clean intermediates (local + cluster)"'), "the cleanup eraser follows the seat (the action cluster's order holds)");
  ok(after.includes("RemoteRunButton") === false, "the seat renders AFTER the dispatch dialog (the RemoteRunButton sits before it)");
}

console.log(`\n${pass}/${pass + fail} green`);
if (fail > 0) process.exit(1);
