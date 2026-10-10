#!/usr/bin/env python3
"""t644 — one-shot mechanical wrap for scripts/t103-e2e.mjs.

Wraps everything from the Phase S marker to EOF inside `async function main() { ... }`
(2-space re-indent) and appends the t156-paradigm catch wiring:
  main().catch(async (e) => { console.error(e); try { await cleanup(); } catch {} process.exit(1); });

Idempotence guard: refuses to run if the file already declares `async function main()`.
"""
import sys

PATH = sys.argv[1] if len(sys.argv) > 1 else "/home/z/my-project/scripts/t103-e2e.mjs"
MARKER = sys.argv[2] if len(sys.argv) > 2 else "/* ---------------- Phase S: adaptive remote seeding ---------------- */"
WIRING = """
main().catch(async (e) => {
  console.error(e);
  try { await cleanup(); } catch {}
  process.exit(1);
});
"""

src = open(PATH).read()
if "async function main()" in src:
    sys.exit("REFUSING: already wrapped")
lines = src.split("\n")
idx = next(i for i, ln in enumerate(lines) if ln.strip() == MARKER)

head = lines[:idx]
body = lines[idx:]
body_indented = [("  " + ln) if ln.strip() else ln for ln in body]

out = "\n".join(head) + "\nasync function main() {\n" + "\n".join(body_indented).rstrip("\n") + "\n}\n" + WIRING
open(PATH, "w").write(out)
print(f"wrapped: head={len(head)} lines, body={len(body)} lines indented")
