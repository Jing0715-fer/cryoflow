#!/usr/bin/env python3
"""
t871-retarget-corpse-pins — the corpse-pin fleet's idempotent retargeter.

THE LAW (docs/world-db-law.md): the t867 resurrection REVERSED the two
worlds. The living data rides db/custom.db through .env (which the
platform's start.sh owns and rewrites every boot); db/cryoflow.db is the
frozen 0-byte corpse. Every script that pins
`process.env.DATABASE_URL = .../db/cryoflow.db` answers from the corpse
one layer down (P2021, the t868 lesson's voice) — the pin must learn the
t869 armor: .env FIRST, the frozen pin as fallback, the world NAMED at
the gate.

SCOPE (conservative, line-scoped):
  * ONLY `process.env.DATABASE_URL = 'file:.../db/cryoflow.db'` and
    ``process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db` `` statement
    lines at column 0 (top level — never inside a function body, so the
    armor's `import` stays legal).
  * ONLY .mjs and .ts files under scripts/.
  * The FIRST pin per file becomes the full armor block (aliased
    collision-free import + .env-first resolver + the gate's own voice);
    any further pin lines in the same file become a comment (the armor
    already resolved the world).
  * Files already carrying the armor marker (`t869 armor`) are skipped —
    idempotent by construction.
  * .py / .sh / spawn-env / inline-execSync forms are REPORTED, not
    touched (the remaining tail; hand-work or a future window).

Usage:
  python3 scripts/t871-retarget-corpse-pins.py          # dry run
  python3 scripts/t871-retarget-corpse-pins.py --apply  # write + receipt
"""
import json
import re
import sys
from pathlib import Path

REPO = Path("/home/z/my-project")
MARKER = "t869 armor"

ARMOR_IMPORT = (
    "import { readFileSync as __t871EnvRead } from 'node:fs';\n"
)
ARMOR_BODY = """process.env.DATABASE_URL = (() => {
  try {
    const m = __t871EnvRead('/home/z/my-project/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, '');
      if (!u.startsWith('file:')) u = 'file:' + u;
      if (/^file:[^/]/.test(u)) u = 'file:/home/z/my-project/prisma/' + u.slice(5);
      return u;
    }
  } catch { /* fall through */ }
  return 'file:/home/z/my-project/db/cryoflow.db';
})();
console.log(`db pin: ${process.env.DATABASE_URL} (the t869 armor: .env-first, frozen fallback)`);"""

# two clean pin forms, both at column 0, single line:
#   process.env.DATABASE_URL = 'file:/home/z/my-project/db/cryoflow.db';
#   process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
PIN_RE = re.compile(
    r"^process\.env\.DATABASE_URL\s*=\s*(['\"`])file:(?:\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/db|/home/z/my-project/db)/cryoflow\.db\1;[ \t]*$",
    re.M,
)

RECEIPT = REPO / "shots-qa" / "t871-corpse-pin-retarget.json"


def armor_block(with_import: bool) -> str:
    head = (
        "// the t869 armor (the t871 retarget): .env FIRST, the frozen pin as\n"
        "// fallback, the world NAMED at the gate (the t867 resurrection made\n"
        "// .env -> db/custom.db the living world; the old cryoflow.db pin is a\n"
        "// 0-byte corpse — docs/world-db-law.md is the law).\n"
    )
    return head + (ARMOR_IMPORT if with_import else "") + ARMOR_BODY


def classify(paths):
    simple, tail = [], []
    for p in paths:
        text = p.read_text(encoding="utf-8", errors="replace")
        if MARKER in text and not PIN_RE.search(text):
            tail.append((p, "already armored"))
        elif p.suffix in (".mjs", ".ts") and PIN_RE.search(text):
            simple.append(p)
        else:
            tail.append((p, "complex form / non-js — hand tail"))
    return simple, tail


def retarget(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    matches = list(PIN_RE.finditer(text))
    if not matches:
        return {"file": str(p), "changed": False, "pins": 0}
    first = True
    out, last, n = [], 0, 0
    for m in matches:
        out.append(text[last : m.start()])
        if first:
            out.append(armor_block(with_import=True) + "\n")
            first = False
        else:
            out.append("// (t871 retarget: env pinned above — the armor already resolved the world)\n")
        n += 1
        last = m.end()
    out.append(text[last:])
    new = "".join(out)
    p.write_text(new, encoding="utf-8")
    return {"file": str(p), "changed": True, "pins": n}


def main():
    apply = "--apply" in sys.argv
    files = sorted([q for q in (REPO / "scripts").iterdir() if q.is_file()])
    if (REPO / "dev-server.sh").exists():
        files.append(REPO / "dev-server.sh")
    corpse = [
        q
        for q in files
        if "cryoflow.db" in q.read_text(encoding="utf-8", errors="replace")
    ]
    simple, tail = classify(corpse)

    print(f"corpse-pin fleet: {len(corpse)} files | simple-form retargetable: {len(simple)} | reported tail: {len(tail)}")
    for p, why in tail:
        print(f"  TAIL  {p.relative_to(REPO)}  ({why})")

    results = []
    for p in simple:
        rel = str(p.relative_to(REPO))
        if apply:
            r = retarget(p)
            print(f"  {'RETAG' if r['changed'] else 'SKIP '} {rel}  pins={r['pins']}")
            results.append(r)
        else:
            print(f"  WOULD {rel}  pins={len(PIN_RE.findall(p.read_text(encoding='utf-8')))}")

    if apply:
        RECEIPT.write_text(
            json.dumps(
                {
                    "instrument": "scripts/t871-retarget-corpse-pins.py",
                    "law": "docs/world-db-law.md",
                    "applied": True,
                    "retargeted": results,
                    "pins": sum(r["pins"] for r in results),
                    "tail": [
                        {"file": str(p.relative_to(REPO)), "why": why}
                        for p, why in tail
                    ],
                },
                indent=1,
            ),
            encoding="utf-8",
        )
        print(f"receipt: {RECEIPT.relative_to(REPO)}")
    else:
        print("dry run — re-run with --apply to write")


if __name__ == "__main__":
    main()
