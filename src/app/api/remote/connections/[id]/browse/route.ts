import { NextRequest, NextResponse } from "next/server";
import { getConnection } from "@/lib/remote/connections";
import { exec, loginShellScript } from "@/lib/remote/ssh";
import { expandRemotePath } from "@/lib/remote/remote-run";
import { listRemoteDir, REMOTE_MIC_RE } from "@/lib/remote/remote-ls";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/remote/connections/[id]/browse?path=<encoded>
 *
 * t300 — the REMOTE twin of /api/fs/browse: a read-only directory listing
 * of the CLUSTER's filesystem, over the connection's SSH exec channel, for
 * remote projects (pick micrographs folders / STAR files where the data
 * actually lives — no staging, no download). The response shape mirrors
 * the local browser exactly, so the SAME PathBrowserDialog renders both
 * worlds:
 *
 *   - path empty          → roots view: / , the login shell's $HOME, the
 *                            connection's remoteRoot (+ those as quick jumps)
 *   - path with * / ?     → WILDCARD preview: `find -name '<glob>'` on the
 *                            pattern's base directory
 *   - path <dir>          → one-level listing (shared remote-ls primitives:
 *                            GNU find -printf primary, `ls -la` fallback),
 *                            capped at 400 entries
 *
 * Safety: listing only — names/sizes/types, never file contents (those move
 * exclusively through the run staging / on-demand fetch legs). Paths travel
 * to the cluster SINGLE-QUOTED, so shell metacharacters in a pasted path
 * are inert; control characters are rejected outright because they would
 * corrupt the line protocol below. The same isLocalRequest door as every
 * other filesystem-enumerating route (drive-by + DNS-rebind).
 */

const MAX_ENTRIES = 400;

interface Entry {
  name: string;
  dir: boolean;
  size?: number;
  img?: boolean;
  abs?: string;
}

/** Control characters cannot ride the line protocol (and never name a
 * path a user can click). Everything else is legal, quoted, inert. */
function hasControlChars(p: string): boolean {
  return /[\r\n\0]/.test(p);
}

/** POSIX dirname for cluster paths ("/" stays "/" — the roots view decides). */
function posixDirname(p: string): string {
  const norm = p.replace(/\/+$/, "");
  if (!norm.includes("/") || norm === "/") return "/";
  return norm.slice(0, norm.lastIndexOf("/")) || "/";
}

/** Split a wildcard path into its base directory + glob tail. */
function splitPattern(p: string): { baseDir: string; glob: string } | null {
  const i = p.lastIndexOf("/");
  if (i < 0) return null;
  const baseDir = i === 0 ? "/" : p.slice(0, i);
  const glob = p.slice(i + 1);
  if (!baseDir.startsWith("/") || !glob) return null;
  return { baseDir, glob };
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to the cluster file browser is not allowed" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const conn = getConnection(id);
    if (!conn) {
      return NextResponse.json({ error: "Cluster connection not found" }, { status: 404 });
    }
    if (!conn.host || !conn.username) {
      return NextResponse.json({ error: "Connection has no host/username" }, { status: 400 });
    }

    const url = new URL(request.url);
    const raw = (url.searchParams.get("path") ?? "").trim();

    // ---- roots view: / + $HOME + remoteRoot --------------------------------
    if (!raw) {
      let home = conn.lastProbe?.homeDir ?? null;
      if (!home || !home.startsWith("/")) {
        const r = await exec(conn, loginShellScript("printf %s \"$HOME\""), { timeoutMs: 10_000 });
        const cand = (r.stdout ?? "").trim().split("\n").pop() ?? "";
        if (cand.startsWith("/")) home = cand;
      }
      let root = "";
      try {
        root = await expandRemotePath(conn, conn.remoteRoot || "~/cryoflow");
      } catch {
        root = ""; // an unreachable home degrades to the plain roots below
      }
      const roots: { label: string; path: string }[] = [{ label: "/ (cluster root)", path: "/" }];
      if (home) roots.push({ label: `Home · ${home}`, path: home });
      if (root) roots.push({ label: `cryoflow root · ${root}`, path: root });
      const quick: { label: string; path: string }[] = [];
      if (home) quick.push({ label: "Home", path: home });
      if (root) quick.push({ label: "cryoflow", path: root });
      return NextResponse.json({
        ok: true,
        path: "",
        parent: null,
        entries: [],
        roots,
        ...(quick.length > 0 ? { quick } : {}),
      });
    }

    if (hasControlChars(raw)) {
      return NextResponse.json(
        { error: "Path contains control characters the cluster browser cannot quote safely" },
        { status: 400 }
      );
    }

    // ---- wildcard pattern preview (RELION "File name pattern" mode) --------
    if (/[*?]/.test(raw)) {
      const split = splitPattern(raw);
      if (!split) {
        return NextResponse.json(
          { error: "Pattern must be an absolute cluster path like /data/movies/*.tiff" },
          { status: 400 }
        );
      }
      const { baseDir, glob } = split;
      const res = await listRemoteDir(id, baseDir, glob);
      if (res.notDir) {
        return NextResponse.json(
          { error: `Folder not found on the cluster: ${baseDir}` },
          { status: 400 }
        );
      }
      const entries: Entry[] = res.entries;
      return NextResponse.json({
        ok: true,
        path: raw,
        pattern: true,
        baseDir,
        parent: baseDir,
        entries,
        truncated: res.truncated,
        micrographs: entries.filter((e) => e.img).length,
        totalMatched: res.total,
      });
    }

    // ---- directory listing --------------------------------------------------
    if (!raw.startsWith("/") && !raw.startsWith("~")) {
      return NextResponse.json(
        { error: "Path must be absolute on the cluster (e.g. /data2/home/… or ~/…)" },
        { status: 400 }
      );
    }
    let dir = raw;
    if (dir.startsWith("~")) {
      try {
        dir = await expandRemotePath(conn, dir);
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Could not resolve ~ on the cluster" },
          { status: 400 }
        );
      }
    }
    const res = await listRemoteDir(id, dir, null);
    if (res.notDir) {
      return NextResponse.json(
        { error: `Folder not found on the cluster (or not a folder): ${dir}` },
        { status: 400 }
      );
    }
    const entries: Entry[] = res.entries;
    const parent = posixDirname(dir);
    return NextResponse.json({
      ok: true,
      path: dir,
      parent: parent === dir ? "" : parent,
      entries,
      truncated: res.truncated,
      micrographs: entries.filter((e) => REMOTE_MIC_RE.test(e.name) && !e.dir).length,
    });
  } catch (error) {
    console.error("GET /api/remote/connections/[id]/browse failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
