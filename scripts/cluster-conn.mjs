/**
 * cluster-conn — the world's one Cluster connection, resolved by IDENTITY
 * (t1146). The t894 doctor carried the connection's id as a hardcoded
 * constant, and every epoch that re-mints the connection (a sandbox
 * recycle, a re-heal) forced a manual re-key of that constant — the
 * chore class this module retires. The id is an accident of minting; the
 * IDENTITY (the healer's own creation spec: the mock Slurm listener on
 * the loopback) is the world's actual fact.
 *
 * The epoch chain (archaeology, kept as the law's own history):
 *   conn-mv6a23lx died with the t1075 16-world's db (t1125's re-key)
 *   → conn-mvwf4vla died with the t1135 fork-landing replant
 *   → conn-mvy782td died with the t1146 recycle (the boot's thin world
 *     re-healed by the t418 healer, which minted the fresh connection)
 *   → (no further re-keys: the doctor now RESOLVES by identity, and an
 *     epoch that changes the identity — not the id — edits MOCK_CLUSTER_SPEC,
 *     ONE place, and the seat REDs if the instruments drift apart)
 *
 * Both fathers are PURE: no fs, no fetch, no process — the tests construct
 * their own rosters (the t1142 server-tier shape: the store is a parameter).
 */

/** The healer's own creation spec — the world's one Cluster by identity. */
export const MOCK_CLUSTER_SPEC = Object.freeze({
  name: "Mock Cluster",
  host: "127.0.0.1",
  port: 3022,
});

const finitePort = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * resolveClusterConnId — the ONE identity resolution.
 *
 * @param {unknown} connections  the connections roster (an array of
 *   { id, name, host, port } rows; anything else is the honest absence).
 * @param {{ name?: string, host?: string, port?: number|string }} spec
 *   defaults to MOCK_CLUSTER_SPEC.
 * @returns {string|null} the matched connection's id, or null when the
 *   world plants no such connection (the doctor's "re-plant" precondition —
 *   an honest absence, never a guessed id).
 *
 * The laws the unit pins:
 *   • EXACT name (case-sensitive — the world's one Cluster has a canonical
 *     name; a lowercase stranger is a stranger).
 *   • host AND port must match (a same-name stranger on another host or
 *     port is not this world's anchor).
 *   • port compares as a NUMBER after coercion (a JSON roster may carry
 *     "3022" as a string; a non-finite port never matches).
 *   • MULTIPLE matches → the array's LAST (the house determinism law:
 *     ties fall to the array's last, the failure scan's own rule).
 *   • junk rows (null, non-objects, id-less rows) are SKIPPED, never a throw.
 *   • an empty/foreign roster → null (the finding's precondition).
 */
export function resolveClusterConnId(connections, spec = MOCK_CLUSTER_SPEC) {
  if (!Array.isArray(connections)) return null;
  const wantPort = finitePort(spec.port);
  let found = null;
  for (const row of connections) {
    if (!row || typeof row !== "object") continue;
    if (typeof row.id !== "string" || row.id.length === 0) continue;
    if (row.name !== spec.name) continue;
    if (row.host !== spec.host) continue;
    const port = finitePort(row.port);
    if (port === null || wantPort === null || port !== wantPort) continue;
    found = row.id; // the last match wins — the house determinism law
  }
  return found;
}

/**
 * clusterBindingVerdict — the ONE three-way the doctor speaks, extracted
 * verbatim from the t894 BINDING block so the instrument and the unit
 * cannot drift apart.
 *
 * @param {string|null} activeBinding the active project's bound connection
 *   id (the registry's remote.connectionId; null when unbound).
 * @param {string|null} clusterConnId resolveClusterConnId's answer.
 * @returns {"sound"|"stomped"|"unplanted"}
 *   sound     — the binding IS the world's Cluster (nothing to do);
 *   unplanted — the world plants NO Cluster at all (re-plant before
 *               riding remote; there is no id to bind TO);
 *   stomped   — a Cluster exists but the binding holds something else
 *               (including null) — the untracked registry was rewritten
 *               behind the world's back; the doctor's heal verb (PATCH,
 *               the t979 bind law) re-points it.
 */
export function clusterBindingVerdict(activeBinding, clusterConnId) {
  if (clusterConnId === null) return "unplanted";
  return activeBinding === clusterConnId ? "sound" : "stomped";
}
