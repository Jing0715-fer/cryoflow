#!/usr/bin/env python3
"""Task 107 — re-home the legacy agent-browser suites (qa42–qa57).

The old fixture DB died with the self-seeding era: job id
cmts0qoho0003p8da75rvxycc is gone and the sandbox host is now named
"QA Refine3D" (created by scripts/restore-gallery.py, resolved by
qa_lib.resolve_refine_host). Every suite that hardcodes the dead id or
the legacy name "3D Auto-Refine 1" drifted off the world it was written
against. This patch:
  1. renames the host constant to "QA Refine3D" (assertions and finders
     swap together, so both sides of every contract move as one),
  2. replaces the dead hardcoded JID with a runtime resolve-by-NAME
     (the qa53 lesson, already in qa54/qa56/qa57: ids drift, names
     survive), self-contained via execSync so definition order of the
     file's own sh() helper does not matter.

Idempotent: safe to run twice.
"""
import re
import pathlib

SUITES = [f"qa{n}" for n in list(range(42, 50)) + list(range(49, 58))]
SUITES = sorted(set(SUITES))
BASE = pathlib.Path("/home/z/my-project/scripts")

OLD_NAME = "3D Auto-Refine 1"
NEW_NAME = "QA Refine3D"
DEAD = "cmts0qoho0003p8da75rvxycc"

RESOLVER = (
    'process.env.QA_JID || (() => {\n'
    '  // resolve job id by NAME — the hardcoded fixture id died with the old\n'
    '  // DB (qa53 lesson: ids drift across seeds, names survive; restore\n'
    '  // the sandbox with scripts/restore-gallery.py when missing)\n'
    '  const raw = execSync(`curl -s --max-time 20 "http://localhost:3000/api/jobs"`,\n'
    '    { encoding: "utf8", timeout: 60_000 });\n'
    '  const parsed = JSON.parse(raw);\n'
    '  const arr = Array.isArray(parsed) ? parsed : parsed.jobs ?? [];\n'
    '  const j = arr.find((x) => x.name === "QA Refine3D" && x.status === "completed");\n'
    '  if (!j) throw new Error(\'host job "QA Refine3D" (completed) not found — run scripts/restore-gallery.py first\');\n'
    '  return j.id;\n'
    '})()'
)

for name in SUITES:
    p = BASE / f"{name}-e2e.mjs"
    if not p.exists():
        print(f"{name}: MISSING, skipped")
        continue
    s = p.read_text()
    orig = s
    n_name = s.count(OLD_NAME)
    s = s.replace(OLD_NAME, NEW_NAME)

    n_jid = 0
    if DEAD in s:
        # const JID = process.env.QA_JID || "DEAD";   (qa42-45, 48)
        # const JID = "DEAD";                          (qa53)
        pat = re.compile(
            r'const JID = (?:process\.env\.QA_JID \|\| )?"' + DEAD + '";'
        )
        s, n = pat.subn("const JID = " + RESOLVER + ";", s)
        n_jid = n

    if s != orig:
        p.write_text(s)
    print(f"{name}: name x{n_name} swapped, jid x{n_jid} resolved")
