/**
 * CryoFlow — the AI verdict stamp store (SERVER ONLY).
 *
 * t565 — judge_2d_classes stamps its verdict onto the job it spoke about
 * (data/ai-verdicts.json — the same JSON-file convention the sessions
 * store and the engine's run records use: the frozen-schema doctrine).
 * One stamp per job, newest wins, atomic rename on write.
 *
 * The pure core (verdict-stamp-core.ts) owns every shape rule; this
 * module is the thin fs shell — sanitize at the door, write behind a
 * rename, and a failed stamp write must NEVER fail the judge call that
 * produced it (the caller wraps us in try/catch, the chat transcript
 * carries the verdict either way).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";
import {
  parseStampsFile,
  sanitizeStamp,
  serializeStampsFile,
  upsertStamp,
  type VerdictStamp,
} from "./verdict-stamp-core";

const STAMPS_FILE = path.join(DATA_DIR, "ai-verdicts.json");

function readFile(): VerdictStamp[] {
  if (!existsSync(STAMPS_FILE)) return [];
  try {
    return parseStampsFile(readFileSync(STAMPS_FILE, "utf8")).stamps;
  } catch {
    return [];
  }
}

function writeFile(stamps: VerdictStamp[]): void {
  mkdirSync(path.dirname(STAMPS_FILE), { recursive: true });
  const tmp = `${STAMPS_FILE}.tmp-${Date.now().toString(36)}`;
  writeFileSync(tmp, serializeStampsFile(stamps));
  renameSync(tmp, STAMPS_FILE);
}

/**
 * Stamp a judge verdict onto its job. Returns the stamp as written
 * (sanitized), or null when the payload is shape garbage — a garbage
 * payload is a programming error in the caller, so it also logs loudly.
 */
export function stampVerdict(
  input: Omit<VerdictStamp, "counts"> & { counts?: never } | Record<string, unknown>
): VerdictStamp | null {
  const stamp = sanitizeStamp(input);
  if (!stamp) {
    console.error("stampVerdict: payload failed sanitization — no stamp written", input);
    return null;
  }
  writeFile(upsertStamp(readFile(), stamp));
  return stamp;
}

/** the newest verdict stamped for a job (null = no judge ever spoke) */
export function getVerdictStamp(jobId: string): VerdictStamp | null {
  if (!jobId) return null;
  return readFile().find((s) => s.jobId === jobId) ?? null;
}
