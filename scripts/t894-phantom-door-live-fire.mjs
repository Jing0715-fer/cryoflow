#!/usr/bin/env node
/**
 * t894-phantom-door-live-fire.mjs — the phantom gate's CAUSAL witness.
 *
 * The sweep tool's probe (probe 3) runs AFTER the ghost sweep, so a 404
 * there cannot distinguish the t894 route fix from the sweep itself (an
 * unregistered ghost id is refused by `setActiveProject` alone — the OLD
 * code refused it too). THIS script closes that hole:
 *
 *   1. REGISTER a ghost meta (a fresh synthetic id, registry-only — no
 *      Prisma row) directly in data/projects.json, the exact pathology
 *      witnessed live at the window's opening hour.
 *   2. PROBE POST /api/projects/switch with that id:
 *        404 → the DB-row gate fired while the registry KNEW the id
 *              (setActiveProject would have said yes) — the FIX is causal.
 *        200 → the door still lies (the fix is absent or stale-served).
 *   3. RESTORE the registry to its pre-test state (bit-for-bit), whatever
 *      the probe answered — the test owns its own cleanup.
 *
 * Exit: 0 gate causal · 2 door lies.
 */

import { readFileSync, writeFileSync, renameSync } from "fs";

const ROOT = "/home/z/my-project";
const REGISTRY = `${ROOT}/data/projects.json`;
const ORIGIN = "http://localhost:3000";

const before = readFileSync(REGISTRY, "utf8");
const ghostId = `t894-livefire-ghost-${Date.now()}`;

try {
  // 1. register the ghost (the pathology, byte-true: meta without a row)
  const reg = JSON.parse(before);
  reg.projects[ghostId] = { mode: "spa", engine: "relion" };
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + "\n");
  console.log(`registered ghost meta: ${ghostId} (registry-only, no DB row)`);

  // 2. probe the door
  const res = await fetch(`${ORIGIN}/api/projects/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify({ id: ghostId }),
  });
  const body = await res.json().catch(() => null);
  console.log(`switch(ghost) -> ${res.status} ${JSON.stringify(body)}`);

  if (res.status === 404) {
    console.log("CAUSAL: the DB-row gate fired on a registry-KNOWN id — the t894 fix is live and load-bearing");
  } else {
    console.log("DOOR LIES: a registry-known ghost was activatable — the fix is absent or stale-served");
    process.exitCode = 2;
  }
} finally {
  // 3. restore bit-for-bit, whatever happened
  const tmp = `${REGISTRY}.livefire-restore`;
  writeFileSync(tmp, before);
  renameSync(tmp, REGISTRY);
  const restored = readFileSync(REGISTRY, "utf8");
  console.log(`registry restored bit-for-bit: ${restored === before}`);
}
