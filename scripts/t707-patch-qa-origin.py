#!/usr/bin/env python3
"""t707 — teach every saved-state-adjacent probe script the Origin door's
language. The t707 saved-state closure put isLocalRequest on camera-bookmarks
and overlay-session; headerless curl-style clients are rejected by design.
This patcher inserts the shared qa-origin shim (import + install) into every
node-fetch script that touches those routes, and adds `-H "Origin: ..."` to
the curl-string call sites in the qa45/qa54/qa57 shells. Idempotent: a file
already importing qa-origin.mjs is left untouched."""
import re
from pathlib import Path

ROOT = Path("/home/z/my-project/scripts")
MJS_FILES = [
    "t200-shots.mjs",
    "t201-shots.mjs",
    "t203-shots.mjs",
    "t208-e2e.mjs",
    "t200-e2e.mjs",
    "t280-ortho-sigma-chips.mjs",
    "t674-rename-wall-palette.mjs",
    "t675-fourth-ear.mjs",
    "t676-toast-eclipse.mjs",
]
SHIM_LINES = [
    'import { installOriginDoor } from "./lib/qa-origin.mjs";',
    "installOriginDoor(); // t707 — saved-state routes reject headerless clients (the door's language)",
]
# mjs files that hit camera-bookmarks/overlay-session via curl subprocess
CURL_FILES = ["qa45-e2e.mjs", "qa54-e2e.mjs", "qa57-e2e.mjs"]


def patch_mjs(path: Path) -> str:
    text = path.read_text()
    if "qa-origin.mjs" in text:
        return "already patched"
    # find the first statement line (import / const / let / await) that is not
    # part of the leading comment header
    stmt = re.search(r"^(import\b|const\b|let\b|var\b|await\b|async function|function\b)", text, re.M)
    if not stmt:
        return "no insertion point"
    at = stmt.start()
    block = "\n".join(SHIM_LINES) + "\n"
    path.write_text(text[:at] + block + text[at:])
    return "patched"


def patch_curl(path: Path, origin_expr: str) -> str:
    """origin_expr is the JS-template-safe Origin value: '${B}' when the
    file defines the B constant, the hardcoded literal when it does not."""
    text = path.read_text()
    if "qa-origin.mjs" in text:
        return "already patched"
    lines = text.splitlines(keepends=True)
    out = []
    n = 0
    for line in lines:
        if re.search(r"camera-bookmarks|overlay-session", line) and "curl -s" in line and "Origin:" not in line:
            if '-H "Content-Type: application/json"' in line:
                line = line.replace(
                    '-H "Content-Type: application/json"',
                    f'-H "Content-Type: application/json" -H "Origin: {origin_expr}"',
                    1,
                )
            else:
                line = re.sub(r'(curl -s --max-time \d+)', f'\\1 -H "Origin: {origin_expr}"', line, count=1)
            n += 1
        out.append(line)
    path.write_text("".join(out))
    return f"patched ({n} curl sites)"


for name in MJS_FILES:
    p = ROOT / name
    print(f"{name}: {patch_mjs(p)}")

ORIGIN_BY_FILE = {
    "qa45-e2e.mjs": "http://localhost:3000",  # no B constant — hardcoded base
    "qa54-e2e.mjs": "${B}",
    "qa57-e2e.mjs": "${B}",
}
for name, origin in ORIGIN_BY_FILE.items():
    p = ROOT / name
    if p.exists():
        print(f"{name}: {patch_curl(p, origin)}")
    else:
        print(f"{name}: MISSING")
