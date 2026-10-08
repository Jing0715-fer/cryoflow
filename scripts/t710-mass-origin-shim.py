#!/usr/bin/env python3
"""
t710 — the mass Origin-shim installer (the t709 deferral contract's
preparatory round, part 2 of 3).

Driven by scripts/t710-collection-touchers.json (the recount that
preceded this batch — t708 law: audit ledgers are photographs, source is
the living draft). For every bare/mixed .mjs file the patcher installs
the shared qa-origin shim:

    import { installOriginDoor } from "./lib/qa-origin.mjs";
    installOriginDoor();

placed after the last existing import (or at the very top when a file
imports nothing), so every later fetch in the module speaks the door's
language. The shim is idempotent by construction and the patcher is
idempotent by inspection: a file that already mentions installOriginDoor
is skipped untouched.

For the six bare .sh files (readiness probes and cleanup curls hitting
the five collection GETs at literal localhost ports) the patcher inserts
-H "Origin: http://localhost:<port>" right after the first `curl ` on
each bare line — the port read from the line's own URL.

Run t710-collection-touchers.py first, then this, then re-run the census:
the active bare/mixed verdict should land at zero. node --check / bash -n
every patched file afterwards.
"""

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
MANIFEST = SCRIPTS / "t710-collection-touchers.json"

IMPORT_LINE = 'import { installOriginDoor } from "./lib/qa-origin.mjs";'
INSTALL_LINE = "installOriginDoor();"

RE_LAST_IMPORT = re.compile(r"^\s*import\s[^;]*;\s*$", re.M)
RE_CURL_URL_PORT = re.compile(r"curl\s")
RE_LITERAL_PORT = re.compile(r"https?://(?:localhost|127\.0\.0\.1):(\d+)/")


def patch_mjs(path: Path) -> str:
    text = path.read_text()
    if "installOriginDoor" in text:
        return "skip-already"
    lines = text.splitlines(keepends=True)
    last_import = -1
    for i, line in enumerate(lines):
        if re.match(r"^\s*import\s", line) and not line.strip().startswith("//"):
            last_import = i
    if last_import >= 0:
        insert_at = last_import + 1
        block = [IMPORT_LINE + "\n", INSTALL_LINE + "\n"]
    else:
        insert_at = 0
        block = [IMPORT_LINE + "\n", INSTALL_LINE + "\n", "\n"]
    lines[insert_at:insert_at] = block
    path.write_text("".join(lines))
    return "patched"


def patch_sh_line(line: str) -> str | None:
    """Insert -H "Origin: http://localhost:PORT" after the first curl."""
    if RE_ORIGIN_SNIPPET.search(line):
        return None  # already speaks
    m = RE_LITERAL_PORT.search(line)
    if not m:
        return None  # var-based URL — leave for hands (none expected)
    port = m.group(1)
    header = f'-H "Origin: http://localhost:{port}" '
    return RE_CURL_URL_PORT.sub(f"curl {header}", line, count=1)


RE_ORIGIN_SNIPPET = re.compile(r"-H\s+['\"]?Origin|\$\{?ORIGIN")


def patch_sh(path: Path, bare_lines) -> str:
    lines = path.read_text().splitlines(keepends=True)
    changed = 0
    # bare_lines are 1-based indices from the census (post-join numbering);
    # match by content to be robust against drift: any curl line touching a
    # five-collection endpoint without Origin gets the header.
    ENDPOINTS = re.compile(r"api/(?:jobs|edges|project|workspaces|custom-template)(?![/\w])")
    for i, line in enumerate(lines):
        if "curl" not in line or not ENDPOINTS.search(line):
            continue
        new = patch_sh_line(line)
        if new is not None and new != line:
            lines[i] = new
            changed += 1
    if changed:
        path.write_text("".join(lines))
        return f"patched({changed})"
    return "no-op"


def main():
    manifest = json.loads(MANIFEST.read_text())
    targets = [r for r in manifest["active"] if r["verdict"] in ("bare", "mixed")]
    results = {"mjs": {}, "sh": {}, "other": {}}
    patched_mjs = []
    for rec in targets:
        path = ROOT / rec["file"]
        if not path.is_file():
            results["other"][rec["file"]] = "MISSING"
            continue
        if path.suffix == ".mjs":
            results["mjs"][rec["file"]] = patch_mjs(path)
        elif path.suffix == ".sh":
            results["sh"][rec["file"]] = patch_sh(path, rec.get("bare_lines", []))
        else:
            results["other"][rec["file"]] = "manual (see census)"

    patched_mjs = [f for f, v in results["mjs"].items() if v == "patched"]
    print(f"mjs: {len(results['mjs'])} targets, {len(patched_mjs)} patched")
    print(f"sh:  {len(results['sh'])} targets -> {results['sh']}")
    if results["other"]:
        print(f"other: {results['other']}")

    # node --check every patched mjs
    bad = []
    for f in patched_mjs:
        p = subprocess.run(["node", "--check", str(ROOT / f)], capture_output=True, text=True)
        if p.returncode != 0:
            bad.append((f, p.stderr[:300]))
    print(f"node --check: {len(patched_mjs) - len(bad)}/{len(patched_mjs)} OK")
    for f, err in bad:
        print(f"  SYNTAX FAIL {f}: {err}")

    # bash -n every patched sh
    sh_patched = [f for f, v in results["sh"].items() if v.startswith("patched")]
    bad_sh = []
    for f in sh_patched:
        p = subprocess.run(["bash", "-n", str(ROOT / f)], capture_output=True, text=True)
        if p.returncode != 0:
            bad_sh.append((f, p.stderr[:300]))
    print(f"bash -n: {len(sh_patched) - len(bad_sh)}/{len(sh_patched)} OK")
    for f, err in bad_sh:
        print(f"  SYNTAX FAIL {f}: {err}")

    return 1 if (bad or bad_sh) else 0


if __name__ == "__main__":
    sys.exit(main())
