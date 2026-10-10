/**
 * CryoFlow — remote MRC header sniffer (t314, SERVER ONLY).
 *
 * One serialized SSH round trip reads the first 64 bytes of up to N input
 * files (`head -c 64 | base64`, newline-separated) and hands them to the
 * pure parser in relion/mrc-sniff. The connection's own exec queue keeps
 * it ordered behind whatever else is in flight; a timeout, a dead channel
 * or an unreadable file degrades to "unknown" verdicts — the caller then
 * ALLOWS the run with an honest note instead of refusing on a guess (the
 * t312 lesson: a filename smell is a hypothesis, the header is the fact).
 */

import { exec, shQuote } from "./ssh";
import type { RemoteConnection } from "./types";
import { sniffImageFile, type HeaderSniffer, type SniffVerdict } from "@/lib/relion/mrc-sniff";

/** bytes of an MRC header that settle nz (sections) and mode */
const SNIFF_BYTES = 64;

/**
 * Build a HeaderSniffer bound to one connection. Every verdict the sniffer
 * cannot earn comes back "unknown" — never an exception, never a refusal.
 */
export function remoteHeaderSniffer(conn: RemoteConnection): HeaderSniffer {
  return async (paths) => {
    const out: Record<string, SniffVerdict> = {};
    if (!conn || paths.length === 0) return out;
    // one line per file: base64 of the first 64 bytes ("" when unreadable —
    // `head`'s error text is dropped on purpose, the verdict says unknown)
    const loop =
      `for f in ${paths.map((p) => shQuote(p)).join(" ")}; do ` +
      `head -c ${SNIFF_BYTES} "$f" 2>/dev/null | base64 | tr -d '\\n'; printf '\\n'; done`;
    let stdout = "";
    try {
      const r = await exec(conn, loop, { timeoutMs: 15_000 });
      if (r.error) return out; // channel problem → everything stays unknown
      stdout = r.stdout ?? "";
    } catch {
      return out;
    }
    const lines = stdout.split(/\r?\n/);
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
    paths.forEach((p, i) => {
      const b64 = (lines[i] ?? "").trim();
      let buf: Buffer | null = null;
      if (b64.length > 0) {
        try {
          const b = Buffer.from(b64, "base64");
          buf = b.length >= 16 ? b : null;
        } catch {
          buf = null;
        }
      }
      out[p] = sniffImageFile(p, buf);
    });
    return out;
  };
}
