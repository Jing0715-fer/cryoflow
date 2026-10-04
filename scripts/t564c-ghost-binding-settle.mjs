/**
 * t564c — the ghost-binding debt settlement (t563 entry ③).
 *
 * t563's probe found the debt: the EMPIAR project's meta carries
 * remote: { connectionId: "qa-t372-muro2rn5" } — a connection that was
 * DELETED from the registry in an earlier window's cleanup. The binding
 * became a ghost: the run dialog's remote leg has nowhere to go, bare
 * POST /run dispatch trips the t317 remote lane, and every probe that
 * meets the project must work around it (t563 borrowed-and-restored the
 * key byte-for-byte because minting jobs in a bound project was not its
 * mandate).
 *
 * This settles the debt the way t563's verdict prescribed: clear the
 * key (rebinding is not an option — no living connection points at the
 * EMPIAR data's host), and leave a receipt. The guard is the borrowed
 * law made strict: if the connection EVER reappears in the registry
 * (not a ghost anymore), the script refuses — clearing a LIVE binding
 * is nobody's one-liner.
 *
 * Receipt: .qa-logs/t564c-ghost-settle.json (before/after + registry
 * evidence + the API's view of the project).
 *
 * Usage: node scripts/t564c-ghost-binding-settle.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/projects.json";
const REGISTRY = "data/remote-connections.json";
const EMPIAR_ID = "cmuro2ufe000mn5nb3qkwuy49";
const GHOST_ID = "qa-t372-muro2rn5";
const RECEIPT = ".qa-logs/t564c-ghost-settle.json";

let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

const raw = readFileSync(FILE, "utf8");
const doc = JSON.parse(raw);
const meta = doc.projects?.[EMPIAR_ID];
if (!meta) {
  console.error(`FATAL: project ${EMPIAR_ID} not in ${FILE}`);
  process.exit(2);
}

/* ---- the guard: ghosts may be cleared, live bindings may not ---------- */
const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
const registryIds = (Array.isArray(registry) ? registry : (registry.connections ?? [])).map((c) => c.id);
if (registryIds.includes(GHOST_ID)) {
  console.error(`FATAL: ${GHOST_ID} EXISTS in the connection registry — this is a LIVE binding, not a ghost. Clearing it is out of bounds.`);
  process.exit(3);
}
check("ghost confirmed absent from the registry", !registryIds.includes(GHOST_ID), `registry has ${registryIds.length} connections, none is ${GHOST_ID}`);
check("the ghost key is present in the meta", meta.remote?.connectionId === GHOST_ID, JSON.stringify(meta.remote));

/* ---- settle: remove the remote key (in place, byte-minimal) ----------- */
const before = JSON.parse(JSON.stringify(meta));
delete meta.remote;
writeFileSync(FILE, JSON.stringify(doc, null, 2) + "\n");
check("remote key removed", meta.remote === undefined);

/* ---- the API's view must agree (getProjectMeta reads the disk) -------- */
const apiView = await fetch("http://localhost:3000/api/projects", {
  headers: { Origin: "http://localhost:3000", Referer: "http://localhost:3000/" },
}).then((r) => r.json());
const proj = (apiView.projects ?? []).find((p) => p.id === EMPIAR_ID);
check("API sees no remote binding", !proj?.remote || proj.remote === null, JSON.stringify(proj?.remote ?? null));
check("API still sees the project (name intact)", !!proj?.name, proj?.name);
check("active pointer untouched", doc.active === EMPIAR_ID, doc.active);

/* ---- receipt ----------------------------------------------------------- */
writeFileSync(RECEIPT, JSON.stringify({
  settledAt: new Date().toISOString(),
  project: EMPIAR_ID,
  ghost: GHOST_ID,
  before,
  after: meta,
  registryIds,
  apiRemote: proj?.remote ?? null,
}, null, 2));
console.log(`  📄 receipt: ${RECEIPT}`);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
