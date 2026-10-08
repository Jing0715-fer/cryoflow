#!/usr/bin/env python3
"""
t710 — the five collection GET routes' real bare-toucher census (v2).

v1's lesson (this file's own first run): word-list + same-line-shape
classification mis-buckets the lane's real shapes — local helper
definitions (const api = ... => fetch(...)) hide the net call in their
bodies, execSync curls hide inside .mjs files, pure comment mentions
inflate the review bucket, and a .py local api() that SPEAKS Origin
(qa67, t259 doctrine) was called bare just because it is not qa_lib.
v2 classifies by definition-inspection and call-windows:

  A. strip full-line comments (mjs // and /* */, sh/py #)
  B. find local request-helper definitions and inspect THEIR bodies
     for Origin evidence; map helper name -> covered/bare
  C. classify every endpoint touch by the net call that serves it:
       direct fetch/urlopen/requests/curl  -> call-window Origin check
       execSync curl (inside .mjs!)        -> command Origin check
       local helper call                   -> helper's verdict
       qa_lib import + api(...)            -> covered (t532)
       installOriginDoor in file           -> everything covered
  D. verdicts: covered / bare / mixed / review-manual / clean

The bare/mixed list is the mass-shim patcher's input. Read-only, rerun
any time; JSON manifest lands beside the report.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"

ENDPOINTS = {
    "jobs": re.compile(r"api/jobs(?![/\w])"),
    "edges": re.compile(r"api/edges(?![/\w])"),
    "project": re.compile(r"api/project(?![\w/])"),
    "workspaces": re.compile(r"api/workspaces(?![/\w])"),
    "custom-template": re.compile(r"api/custom-template(?![/\w])"),
}

ACTIVE_GLOBS = ["*.mjs", "*.sh", "*.py"]
ARCHIVE_DIRS = ["diag-archive", "_retired"]

RE_ORIGIN = re.compile(r"['\"`]Origin['\"`]\s*[::]|-H\s+['\"]?Origin|\$\{?ORIGIN")
RE_FETCH = re.compile(r"\bfetch\s*\(")
RE_URLOPEN = re.compile(r"urlopen\s*\(|urllib\.request\.Request\s*\(|requests\.(?:get|post|put|patch|delete|request)\s*\(")
RE_CURL = re.compile(r"\bcurl\s")
RE_EXEC_CURL = re.compile(r"execSync\s*\(\s*[`\"']curl|exec\s*\(\s*[`\"']curl")
RE_QALIB_IMPORT = re.compile(r"from\s+qa_lib\s+import|import\s+qa_lib")
RE_PY_CALL = re.compile(r"(?<![\w.])(\w+)\s*\(")
RE_MJS_CALL = re.compile(r"(?<![\w.])(\w+)\s*\(")
RE_HELPER_DEF_MJS = re.compile(
    r"(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function\s*)?(?:\([^)]*\)|\w+)\s*=>"
    r"|(?:async\s+)?function\s+(\w+)\s*\("
)
RE_HELPER_DEF_PY = re.compile(r"def\s+(\w+)\s*\(")
RE_SHIM = re.compile(r"installOriginDoor")
RE_NET_ANY = re.compile(r"\bfetch\s*\(|urlopen\s*\(|urllib\.request\.Request\s*\(|\bcurl\s|\brequests\.(?:get|post|put|patch|delete|request)\s*\(")
RE_CURL_ANY = re.compile(r"\bcurl\s")
RE_HEADER_CONST = re.compile(
    r"(?:const|let|var)\s+(\w+)\s*=\s*[{\(][^;}]*Origin[^;}]*[}\)]",
    re.S,
)
RE_PY_HEADER_CONST = re.compile(r"^(\w+)\s*=\s*\{[^}]*Origin[^}]*\}", re.M | re.S)


def strip_comments_mjs(text: str) -> str:
    out, in_block = [], False
    for line in text.splitlines():
        s = line.strip()
        if in_block:
            if "*/" in s:
                in_block = False
            out.append("")
            continue
        if s.startswith("//") or s.startswith("/*"):
            if s.startswith("/*") and "*/" not in s:
                in_block = True
            out.append("")
            continue
        out.append(line)
    return "\n".join(out)


def strip_comments_hash(text: str) -> str:
    return "\n".join("" if l.strip().startswith("#") else l for l in text.splitlines())


def find_endpoints(line: str):
    return [n for n, rx in ENDPOINTS.items() if rx.search(line)]


def call_window(lines, start_idx, max_lines=8):
    """Grab the source window of a multi-line call starting at start_idx."""
    depth = 0
    seen_open = False
    buf = []
    for i in range(start_idx, min(start_idx + max_lines, len(lines))):
        buf.append(lines[i])
        depth += lines[i].count("(") - lines[i].count(")")
        if "(" in lines[i]:
            seen_open = True
        if seen_open and depth <= 0:
            break
    return "\n".join(buf)


def scan_mjs_helpers(lines, header_consts=()):
    """Map local helper name -> 'covered' | 'bare' by body inspection.

    v3: non-async single-expression arrows count as defs too (t601's
    `const api = (path, method = "GET") =>\n  JSON.parse(sh(curl...))`
    hid from v2), sh/subprocess curls count as net calls, and helpers
    that delegate to other helpers inherit their verdict (t708's
    api -> apiOnce chains). v5: bodies referencing Origin-bearing header
    consts (headers=SH) count as covered."""
    helpers = {}
    bodies = {}
    for i, line in enumerate(lines):
        m = RE_HELPER_DEF_MJS.search(line)
        if not m:
            continue
        name = m.group(1) or m.group(2)
        if not name or name in helpers:
            continue
        body = "\n".join(lines[i:i + 14])
        if not RE_NET_ANY.search(body):
            continue
        bodies[name] = body
        if window_speaks_origin(body, header_consts):
            helpers[name] = "covered"
        elif RE_CURL_ANY.search(body) or RE_FETCH.search(body) or RE_URLOPEN.search(body):
            helpers[name] = "bare"
    # v3 inheritance: helper -> helper delegation (two passes settle chains)
    for _ in range(2):
        for name, body in bodies.items():
            if helpers.get(name) != "bare":
                continue
            for other, verdict in helpers.items():
                if other != name and verdict == "covered" and re.search(rf"(?<![\w.]){other}\s*\(", body):
                    helpers[name] = "covered"
                    break
    return helpers


def scan_py_helpers(lines, header_consts=()):
    helpers = {}
    bodies = {}
    for i, line in enumerate(lines):
        m = RE_HELPER_DEF_PY.search(line)
        if not m:
            continue
        name = m.group(1)
        if name in helpers:
            continue
        body = "\n".join(lines[i:i + 14])
        if not RE_NET_ANY.search(body):
            continue
        bodies[name] = body
        if window_speaks_origin(body, header_consts):
            helpers[name] = "covered"
        elif RE_CURL_ANY.search(body) or RE_FETCH.search(body) or RE_URLOPEN.search(body):
            helpers[name] = "bare"
    for _ in range(2):
        for name, body in bodies.items():
            if helpers.get(name) != "bare":
                continue
            for other, verdict in helpers.items():
                if other != name and verdict == "covered" and re.search(rf"(?<![\w.]){other}\s*\(", body):
                    helpers[name] = "covered"
                    break
    return helpers


def find_header_consts(lines):
    """v5: module-level header consts carrying Origin (mjs/py SH)."""
    text = "\n".join(lines)
    names = set()
    for m in RE_HEADER_CONST.finditer(text):
        names.add(m.group(1))
    for m in RE_PY_HEADER_CONST.finditer(text):
        names.add(m.group(1))
    return names


def window_speaks_origin(win, header_consts):
    if RE_ORIGIN.search(win):
        return True
    for name in header_consts:
        if re.search(rf"headers\s*[:=]\s*[\w ]*{name}\b|\.\.\.{name}\b", win):
            return True
    return False


def classify_line_window(lines, i, kind, header_consts=()):
    """Origin verdict for the net call at/near line i (0-based)."""
    win = call_window(lines, i)
    if window_speaks_origin(win, header_consts):
        return "covered"
    # look back a couple lines (URL built on the previous line)
    back = "\n".join(lines[max(0, i - 2):i + 1])
    if window_speaks_origin(back, header_consts):
        return "covered"
    return "BARE"


def classify_mjs(path: Path):
    text = strip_comments_mjs(path.read_text(errors="replace"))
    lines = text.splitlines()
    has_shim = bool(RE_SHIM.search(text))
    header_consts = find_header_consts(lines)
    helpers = scan_mjs_helpers(lines, header_consts)
    evidence, touched = [], set()
    bare = other = False
    for i, line in enumerate(lines):
        eps = find_endpoints(line)
        if not eps:
            continue
        touched.update(eps)
        if has_shim:
            kind = "covered-shim"
        elif RE_CURL.search(line) or RE_EXEC_CURL.search(line):
            kind = classify_line_window(lines, i, "curl", header_consts)
        elif RE_FETCH.search(line):
            kind = classify_line_window(lines, i, "fetch", header_consts)
        elif RE_ORIGIN.search(line):
            # v3: the line itself speaks Origin (t695's page.request.get
            # with inline headers) — covered regardless of call shape
            kind = "covered-inline"
        else:
            m = RE_MJS_CALL.search(line)
            fn = m.group(1) if m else None
            if fn and fn in helpers:
                hv = helpers[fn]
                kind = "covered-helper" if hv == "covered" else "BARE-helper"
                if hv == "bare":
                    bare = True
            else:
                # URL-only: look ±4 lines for the serving net call
                ctx = "\n".join(lines[max(0, i - 4):i + 5])
                near = None
                for m2 in RE_MJS_CALL.finditer(ctx):
                    fn2 = m2.group(1)
                    if fn2 in helpers:
                        near = helpers[fn2]
                        break
                if near:
                    kind = "covered-helper" if near == "covered" else "BARE-helper"
                    if near == "bare":
                        bare = True
                elif RE_FETCH.search(ctx):
                    kind = classify_line_window(lines, i, "fetch-near", header_consts)
                elif RE_CURL.search(ctx):
                    kind = classify_line_window(lines, i, "curl-near", header_consts)
                else:
                    kind = "review-manual"
                    other = True
        if "BARE" in kind:
            bare = True
        evidence.append({"line": i + 1, "eps": eps, "kind": kind, "text": line.strip()[:120]})
    return verdict_of(touched, bare, other, evidence), evidence, touched


def classify_py(path: Path):
    text = strip_comments_hash(path.read_text(errors="replace"))
    lines = text.splitlines()
    has_qalib = bool(RE_QALIB_IMPORT.search(text))
    header_consts = find_header_consts(lines)
    helpers = scan_py_helpers(lines, header_consts)
    evidence, touched = [], set()
    bare = other = False
    for i, line in enumerate(lines):
        eps = find_endpoints(line)
        if not eps:
            continue
        touched.update(eps)
        if has_qalib and RE_PY_CALL.search(line) and re.search(r"(?<![\w.])api\s*\(", line):
            kind = "covered-qa_lib"
        elif RE_URLOPEN.search(line):
            kind = classify_line_window(lines, i, "urlopen", header_consts)
        elif RE_ORIGIN.search(line):
            kind = "covered-inline"
        else:
            m = RE_PY_CALL.search(line)
            fn = m.group(1) if m else None
            if fn and fn in helpers:
                hv = helpers[fn]
                kind = "covered-helper" if hv == "covered" else "BARE-helper"
                if hv == "bare":
                    bare = True
            else:
                ctx = "\n".join(lines[max(0, i - 4):i + 5])
                near = None
                for m2 in RE_PY_CALL.finditer(ctx):
                    fn2 = m2.group(1)
                    if fn2 in helpers:
                        near = helpers[fn2]
                        break
                if near:
                    kind = "covered-helper" if near == "covered" else "BARE-helper"
                    if near == "bare":
                        bare = True
                elif RE_URLOPEN.search(ctx):
                    kind = classify_line_window(lines, i, "urlopen-near", header_consts)
                else:
                    kind = "review-manual"
                    other = True
        if "BARE" in kind:
            bare = True
        evidence.append({"line": i + 1, "eps": eps, "kind": kind, "text": line.strip()[:120]})
    return verdict_of(touched, bare, other, evidence), evidence, touched


def classify_sh(path: Path):
    raw = path.read_text(errors="replace")
    # join backslash continuations so multi-line curls classify as one
    joined, buf = [], ""
    for line in raw.splitlines():
        if line.rstrip().endswith("\\"):
            buf += line.rstrip()[:-1] + " "
            continue
        joined.append(buf + line)
        buf = ""
    if buf:
        joined.append(buf)
    lines = strip_comments_hash("\n".join(joined)).splitlines()
    # v4: header-variable shapes — t453's H='...-H Origin:...' and the
    # live-surgery family's O=(-H "Origin: $BASE" ...) carry the door in
    # a variable; a bare `$H`/`"${O[@]}"` on the curl line is covered.
    file_has_origin_var = bool(re.search(r"^\s*\w+=(?:\(|['\"]).*Origin", "\n".join(lines), re.M))
    evidence, touched = [], set()
    bare = other = False
    for i, line in enumerate(lines):
        eps = find_endpoints(line)
        if not eps:
            continue
        touched.update(eps)
        if RE_CURL.search(line):
            if RE_ORIGIN.search(line):
                kind = "covered-origin"
            elif file_has_origin_var and re.search(r"\$\{?\w+[@}]?|\$H\b", line):
                kind = "covered-origin-var"
            else:
                kind = "BARE"
        else:
            kind = "review-manual"
            other = True
        if "BARE" in kind:
            bare = True
        evidence.append({"line": i + 1, "eps": eps, "kind": kind, "text": line.strip()[:120]})
    return verdict_of(touched, bare, other, evidence), evidence, touched


def verdict_of(touched, bare, other, evidence):
    if not touched:
        return "clean"
    kinds = {e["kind"] for e in evidence}
    has_bare = any("BARE" in k for k in kinds)
    has_covered = any("covered" in k for k in kinds)
    if has_bare and (other or has_covered):
        return "mixed"
    if has_bare:
        return "bare"
    if other and any(k == "review-manual" for k in kinds):
        return "review-manual"
    return "covered"


def main():
    report = {"active": [], "archive": [], "summary": {}}
    counts = {"active": {}, "archive": {}}
    for scope in ("active", "archive"):
        for ep in ENDPOINTS:
            counts[scope][ep] = 0
    all_files = []
    for pat in ACTIVE_GLOBS:
        all_files.extend(SCRIPTS.glob(pat))
    archive_files = []
    for d in ARCHIVE_DIRS:
        for pat in ACTIVE_GLOBS:
            archive_files.extend((SCRIPTS / d).rglob(pat))
    archive_files = [p for p in archive_files if p.is_file()]

    classifiers = {".mjs": classify_mjs, ".py": classify_py, ".sh": classify_sh}
    for scope, files in (("active", sorted(all_files)), ("archive", sorted(archive_files))):
        for path in files:
            cls = classifiers.get(path.suffix)
            if not cls:
                continue
            verdict, evidence, touched = cls(path)
            if not touched:
                continue
            for e in evidence:
                if "BARE" in e["kind"]:
                    for ep in e["eps"]:
                        counts[scope][ep] += 1
            report[scope].append({
                "file": str(path.relative_to(ROOT)),
                "verdict": verdict,
                "endpoints": sorted(touched),
                "n_touches": len(evidence),
                "bare_lines": [e["line"] for e in evidence if "BARE" in e["kind"]],
                "evidence": evidence,
            })

    for scope in ("active", "archive"):
        verdicts = {}
        for rec in report[scope]:
            verdicts[rec["verdict"]] = verdicts.get(rec["verdict"], 0) + 1
        report["summary"][scope] = {
            "files_touching": len(report[scope]),
            "verdicts": verdicts,
            "bare_touches_by_endpoint": counts[scope],
        }

    out = SCRIPTS / "t710-collection-touchers.json"
    out.write_text(json.dumps(report, indent=1))
    for scope in ("active", "archive"):
        s = report["summary"][scope]
        print(f"== {scope} ==")
        print(f"  files touching the five collections: {s['files_touching']}")
        print(f"  verdicts: {s['verdicts']}")
        print(f"  BARE touches by endpoint: {s['bare_touches_by_endpoint']}")
    patch = [r["file"] for r in report["active"] if r["verdict"] in ("bare", "mixed")]
    print(f"\nactive bare/mixed patch list ({len(patch)}):")
    for f in patch:
        print(f"  {f}")
    manual = [r["file"] for r in report["active"] if r["verdict"] == "review-manual"]
    if manual:
        print(f"\nactive review-manual ({len(manual)}):")
        for f in manual:
            print(f"  {f}")
    print(f"\nmanifest: {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
