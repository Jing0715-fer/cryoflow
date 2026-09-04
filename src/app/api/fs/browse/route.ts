import { NextRequest, NextResponse } from "next/server";
import { readdirSync, statSync, existsSync } from "fs";
import path from "path";
import os from "os";
import { detectRelion } from "@/lib/relion/system";
import { PROJECT_ROOT } from "@/lib/paths";
import { countImages, expandPattern, hasWildcard, userPathToHost } from "@/lib/relion/glob";

export const dynamic = "force-dynamic";

/**
 * GET /api/fs/browse?path=<encoded>
 *
 * Read-only directory listing for the import browser (the RELION GUI
 * equivalent of "Browse…"). Runs on the machine hosting this app, so it can
 * see local drives, POSIX mounts AND WSL distros (\\wsl.localhost\<distro>).
 *
 *  - path empty          → root picker (drives on Windows, / + WSL distros) + quick jumps
 *  - path with * / ?     → WILDCARD PATTERN preview (RELION import style): matched
 *                          files listed with img flags + total match count
 *  - path <dir>          → { entries, parent, micrographs } (capped at 400 entries)
 *
 * Safety: listing only — never writes, never follows into file contents.
 */

const MIC_RE = /\.(mrc|mrcs|tif|tiff|eer)$/i;
const MAX_ENTRIES = 400;

interface Entry {
  name: string;
  dir: boolean;
  size?: number;
  /** micrograph/movie image file (mrc/mrcs/tif/tiff/eer) */
  img?: boolean;
  /** absolute host path (files only) — used by the multi-select picker */
  abs?: string;
}

function statEntry(parent: string, name: string): Entry | null {
  try {
    const st = statSync(path.join(parent, name));
    if (st.isDirectory()) return { name, dir: true };
    return {
      name,
      dir: false,
      size: st.size,
      img: MIC_RE.test(name),
    };
  } catch {
    /* broken link / raced away / permission — hide rather than fail the dir */
    return null;
  }
}

/** Windows drive roots that respond (empty CD trays etc. return false). */
function windowsDrives(): string[] {
  const out: string[] = [];
  for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
    const root = `${c}:\\`;
    try {
      if (existsSync(root)) out.push(root);
    } catch {
      /* skip */
    }
  }
  return out;
}

function quickJumps(): { label: string; path: string }[] {
  const home = os.homedir();
  const jumps: { label: string; path: string }[] = [{ label: "Home", path: home }];
  for (const sub of ["Desktop", "Downloads", "Documents", "Pictures"]) {
    const p = path.join(home, sub);
    if (existsSync(p)) jumps.push({ label: sub, path: p });
  }
  jumps.push({ label: "Project", path: PROJECT_ROOT });
  return jumps;
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const raw = (url.searchParams.get("path") ?? "").trim();

    // ---- roots view ------------------------------------------------------
    if (!raw) {
      const roots: { label: string; path: string }[] = [];
      if (process.platform === "win32") {
        for (const d of windowsDrives()) roots.push({ label: d, path: d });
      } else {
        roots.push({ label: "/", path: "/" });
        roots.push({ label: "Home", path: os.homedir() });
      }
      // WSL distros — both the aggregate UNC root (lists all distros) and the
      // probed default distro directly, when WSL is available.
      const status = await detectRelion();
      if (status.wsl.available) {
        roots.push({ label: "\\\\wsl.localhost (all distros)", path: "\\\\wsl.localhost" });
        if (status.wsl.distro) {
          roots.push({
            label: `WSL · ${status.wsl.distro}`,
            path: `\\\\wsl.localhost\\${status.wsl.distro}`,
          });
        }
      }
      return NextResponse.json({ ok: true, path: "", parent: null, entries: [], roots, quick: quickJumps() });
    }

    // ---- wildcard pattern preview (RELION "File name pattern" mode) --------
    if (hasWildcard(raw)) {
      const status = await detectRelion();
      const distro = status.wsl.distro ?? null;
      const r = expandPattern(raw, (p) => userPathToHost(p, distro), MAX_ENTRIES);
      if ("error" in r) {
        return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
      }
      const entries: Entry[] = r.files.map((f) => {
        let size: number | undefined;
        try {
          size = statSync(f).size;
        } catch {
          /* raced away */
        }
        return {
          name: path.relative(r.baseDir, f).split(path.sep).join("/") || path.basename(f),
          dir: false,
          size,
          img: MIC_RE.test(path.basename(f)),
          abs: f,
        };
      });
      return NextResponse.json({
        ok: true,
        path: raw,
        pattern: true,
        baseDir: r.baseDir,
        parent: r.baseDir,
        entries,
        truncated: r.total > r.files.length,
        micrographs: countImages(r.files),
        totalMatched: r.total,
        quick: quickJumps(),
      });
    }

    // ---- directory listing -----------------------------------------------
    let dir: string;
    try {
      dir = path.resolve(raw);
      const st = statSync(dir);
      if (!st.isDirectory()) {
        return NextResponse.json(
          { ok: false, error: `Not a folder: ${raw}` },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: `Folder not found or not accessible: ${raw}` },
        { status: 400 }
      );
    }

    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      return NextResponse.json(
        { ok: false, error: `Permission denied: ${dir}` },
        { status: 400 }
      );
    }

    const entries: Entry[] = [];
    let truncated = false;
    let micrographs = 0;
    for (const name of names) {
      const e = statEntry(dir, name);
      if (!e) continue;
      if (e.img) micrographs += 1;
      if (!e.dir) e.abs = path.join(dir, name);
      entries.push(e);
    }
    // directories first, then files — both alphabetical
    entries.sort((a, b) =>
      a.dir === b.dir ? a.name.localeCompare(b.name, undefined, { numeric: true }) : a.dir ? -1 : 1
    );
    if (entries.length > MAX_ENTRIES) {
      entries.length = MAX_ENTRIES;
      truncated = true;
    }

    // parent: drive roots / UNC roots go back to the roots view
    const parsed = path.parse(dir);
    const isTopRoot =
      dir === parsed.root ||
      /^\\\\wsl(\.localhost|\$)?\\?$/i.test(dir) ||
      /^\\\\wsl(\.localhost|\$)\\[^\\]+\\?$/i.test(dir);
    const parent = isTopRoot ? "" : path.dirname(dir);

    return NextResponse.json({
      ok: true,
      path: dir,
      parent,
      entries,
      truncated,
      micrographs,
      quick: quickJumps(),
    });
  } catch (error) {
    console.error("GET /api/fs/browse failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
