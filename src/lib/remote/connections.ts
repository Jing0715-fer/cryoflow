/**
 * CryoFlow — remote cluster connection registry (SERVER ONLY).
 *
 * SSH cluster profiles persisted in data/remote-connections.json. The file
 * holds SECRETS (password / passphrase) — it is written 0600 and NEVER
 * projected to the client: API routes return RemoteConnectionDTO with the
 * secret fields stripped (hasPassword/hasPassphrase booleans only).
 *
 * Design mirrors hpc/slurm.ts's profile registry (a JSON file in DATA_DIR
 * rather than a Prisma model — the engine keeps its state out of the frozen
 * schema; see engine.ts's state-file notes).
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import type { RemoteConnection, RemoteConnectionDTO } from "./types";

const REGISTRY_FILE = path.join(DATA_DIR, "remote-connections.json");

/** Sanitized projection for API responses (secrets stripped). */
export function toConnectionDTO(c: RemoteConnection): RemoteConnectionDTO {
  const { password, passphrase, ...rest } = c;
  return {
    ...rest,
    hasPassword: typeof password === "string" && password.length > 0,
    hasPassphrase: typeof passphrase === "string" && passphrase.length > 0,
  };
}

/** Field-wise sanitize + default an incoming connection object. */
export function sanitizeConnection(raw: Record<string, unknown>, prev?: RemoteConnection): RemoteConnection {
  const str = (v: unknown, max = 300): string | null =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
  const auth = ["agent", "key", "password"].includes(String(raw.authMethod))
    ? (String(raw.authMethod) as RemoteConnection["authMethod"])
    : "password";
  // secrets: an explicitly-empty string MEANS "clear"; undefined/absent means
  // "keep the stored one" (the edit form never echoes secrets back)
  const secret = (v: unknown, prevVal: string | null): string | null => {
    if (typeof v === "string") return v.length > 0 ? v.slice(0, 512) : null;
    return prevVal ?? null;
  };
  const portRaw = Number(raw.port);
  const fileMb = Number(raw.maxFileMb);
  const totalMb = Number(raw.maxTotalMb);
  // t289 — sync-back policy + the key-files binary cap. Absent fields keep
  // the stored value; a brand-new connection defaults to key-files/16MB
  // (bulky maps stay on the cluster, fetchable on demand).
  const policy: RemoteConnection["syncPolicy"] =
    raw.syncPolicy === "everything" || raw.syncPolicy === "key-files"
      ? raw.syncPolicy
      : (prev?.syncPolicy ?? "key-files");
  const keyMbRaw = Number(raw.keyFileMb);
  const keyFileMb = Number.isFinite(keyMbRaw)
    ? Math.max(1, Math.min(2048, Math.round(keyMbRaw)))
    : (prev?.keyFileMb ?? 16);
  const envLines = Array.isArray(raw.envLines)
    ? raw.envLines
        .filter((l): l is string => typeof l === "string")
        .map((l) => l.slice(0, 300))
        .slice(0, 12)
    : (prev?.envLines ?? []);
  const probe =
    raw.lastProbe && typeof raw.lastProbe === "object"
      ? (raw.lastProbe as RemoteConnection["lastProbe"])
      : (prev?.lastProbe ?? null);
  return {
    id: str(raw.id, 60) ?? prev?.id ?? `conn-${Date.now().toString(36)}`,
    name: str(raw.name, 120) ?? prev?.name ?? "Cluster",
    host: str(raw.host, 200) ?? prev?.host ?? "",
    port: Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? Math.round(portRaw) : 22,
    username: str(raw.username, 60) ?? prev?.username ?? "",
    authMethod: auth,
    privateKeyPath: str(raw.privateKeyPath, 400) ?? prev?.privateKeyPath ?? null,
    passphrase: secret(raw.passphrase, prev?.passphrase ?? null),
    password: secret(raw.password, prev?.password ?? null),
    remoteRoot: str(raw.remoteRoot, 400) ?? prev?.remoteRoot ?? "~/cryoflow",
    defaultModule: str(raw.defaultModule, 200) ?? prev?.defaultModule ?? null,
    envLines,
    useSlurm: typeof raw.useSlurm === "boolean" ? raw.useSlurm : (prev?.useSlurm ?? false),
    // t297 — the sbatch partition (null = cluster default). An explicitly
    // empty string MEANS "use the default" (clearing the field), absent
    // keeps the stored value — the same three-state dialect as strings above.
    slurmPartition:
      typeof raw.slurmPartition === "string"
        ? raw.slurmPartition.trim()
          ? raw.slurmPartition.trim().slice(0, 80)
          : null
        : (prev?.slurmPartition ?? null),
    syncPolicy: policy,
    keyFileMb,
    maxFileMb: Number.isFinite(fileMb) ? Math.max(1, Math.min(8192, Math.round(fileMb))) : (prev?.maxFileMb ?? 512),
    maxTotalMb: Number.isFinite(totalMb) ? Math.max(16, Math.min(65536, Math.round(totalMb))) : (prev?.maxTotalMb ?? 2048),
    lastProbe: probe,
  };
}

export function loadConnections(): RemoteConnection[] {
  try {
    if (existsSync(REGISTRY_FILE)) {
      const parsed = JSON.parse(readFileSync(REGISTRY_FILE, "utf8"));
      if (Array.isArray(parsed)) return parsed as RemoteConnection[];
    }
  } catch {
    /* corrupt registry → start empty */
  }
  return [];
}

export function saveConnections(list: RemoteConnection[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(REGISTRY_FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
  try {
    chmodSync(REGISTRY_FILE, 0o600); // umask may have softened the create mode
  } catch {
    /* chmod best-effort (e.g. some network FS) */
  }
}

export function getConnection(id: string): RemoteConnection | null {
  return loadConnections().find((c) => c.id === id) ?? null;
}

/** Upsert by id. Returns the stored connection. */
export function upsertConnection(raw: Record<string, unknown>): RemoteConnection {
  const list = loadConnections();
  const id = typeof raw.id === "string" ? raw.id : null;
  const idx = id ? list.findIndex((c) => c.id === id) : -1;
  const conn = sanitizeConnection(raw, idx >= 0 ? list[idx] : undefined);
  if (idx >= 0) list[idx] = conn;
  else list.push(conn);
  saveConnections(list);
  return conn;
}

/** Patch selected fields (secrets keep semantics from sanitizeConnection). */
export function patchConnection(id: string, raw: Record<string, unknown>): RemoteConnection | null {
  const list = loadConnections();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return null;
  const conn = sanitizeConnection({ ...list[idx], ...raw, id }, list[idx]);
  list[idx] = conn;
  saveConnections(list);
  return conn;
}

export function deleteConnection(id: string): boolean {
  const list = loadConnections();
  const next = list.filter((c) => c.id !== id);
  if (next.length === list.length) return false;
  saveConnections(next);
  return true;
}
