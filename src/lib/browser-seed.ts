/**
 * CryoFlow — the path browser's seed law (t396), extracted from the dialog
 * so it can be pinned by the bench without dragging React into the run.
 *
 * The bug this module exists for: the browser restored its mode from the
 * CURRENT VALUE, and a single-path value ("folder" semantics by the
 * micrograph import's law) OVERRODE the caller's requested files mode —
 * the "Continue from here:" field passes a single optimiser.star path, so
 * once a value was set, every later Browse opened in FOLDER mode: file
 * rows rendered inert and the only action was "Select this folder"
 * (the field report: 选择文件只能选择文件夹). The seed now honors the
 * caller's intent first — a single-file browser seeds files mode (and
 * preselects the file), never folder mode.
 */

export type BrowserMode = "folder" | "files";

export interface BrowserSeed {
  mode: BrowserMode;
  selected: string[];
  cwd: string | null;
}

function dirnameOf(p: string): string | null {
  const dir = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : null;
  return dir && dir.trim() ? dir : null;
}

/**
 * PURE — split a picked value into the browser's opening state.
 *
 *   · empty value      → the caller's default (folder world; single-file
 *                        callers pass singleFile and get files mode)
 *   · multiple lines   → files mode, selection restored (multi-pick world)
 *   · wildcard pattern → files mode, listing the pattern (preview world)
 *   · single path      → singleFile ? files (path preselected, cwd = its
 *                        folder) : folder (the classic micrograph import)
 */
export function parseBrowserSeed(
  value: string,
  singleFile: boolean
): BrowserSeed {
  const v = value.trim();
  if (!v) {
    return { mode: singleFile ? "files" : "folder", selected: [], cwd: null };
  }
  const lines = v.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) {
    // previous multi-file selection — restore it, start at the first file's folder
    const first = lines.find((l) => l.includes("/")) ?? lines[0];
    const dir = first.includes("/") ? first.slice(0, first.lastIndexOf("/")) : null;
    return { mode: "files", selected: lines, cwd: dir && dir.trim() ? dir : null };
  }
  const single = lines[0];
  if (/[*?]/.test(single)) return { mode: "files", selected: [], cwd: single };
  if (singleFile) {
    // a previously picked FILE — stay in the single-file world, seated at
    // its folder (the file itself is one click away again)
    return { mode: "files", selected: [], cwd: dirnameOf(single) };
  }
  return { mode: "folder", selected: [], cwd: dirnameOf(single) };
}
