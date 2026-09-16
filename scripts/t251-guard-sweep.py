#!/usr/bin/env python3
"""
t251 hardening sweep — add the isLocalRequest door to the 12 job-data read
routes that the outputs/file route already has (sibling-route consistency:
the unified containment policy landed in jobfile.ts, but the cross-site
DOOR only landed on file/map-profile/fsbrowse — the parsed-data siblings
stayed open). Mechanical transform per route:
  1. import { isLocalRequest } from "@/lib/http-guard";
  2. GET(_request -> GET(request
  3. guard block as the first statement inside the GET handler's try
Idempotent: routes that already carry isLocalRequest are skipped.
"""
import re
from pathlib import Path

ROUTES = [
    "outputs", "outputs/star", "log", "fsc", "guinier", "resolution",
    "angdist", "motion", "ctf", "micrographs", "classes", "picks",
    "particles",
]
BASE = Path("src/app/api/jobs/[id]")

IMPORT = 'import { isLocalRequest } from "@/lib/http-guard";\n'

GUARD = (
    "\n"
    "    // Hardening (t251, the #5 sibling closure): workdir-derived data —\n"
    "    // same drive-by door + Host pin pair as the outputs/file route\n"
    "    // (see http-guard for the threat model). Parsed or rendered, the\n"
    "    // bytes come from the job workdir — the door rides along.\n"
    "    if (!isLocalRequest(request)) {\n"
    '      return NextResponse.json(\n'
    '        { error: "Cross-site access to job data is not allowed" },\n'
    '        { status: 403 }\n'
    "      );\n"
    "    }\n"
)

changed, skipped = [], []
for r in ROUTES:
    f = BASE / r / "route.ts"
    src = f.read_text()
    if "isLocalRequest" in src:
        skipped.append(r)
        continue

    # 1. import — after the last import line
    lines = src.splitlines(keepends=True)
    last_import = max(i for i, l in enumerate(lines) if l.startswith("import "))
    lines.insert(last_import + 1, IMPORT)
    src = "".join(lines)

    # 2+3. GET signature rename + guard insertion after its try {
    def repl(m):
        return m.group(0).replace("_request", "request") + GUARD

    new_src, n = re.subn(
        r'export async function GET\(_request: NextRequest, context: RouteContext\) \{\n  try \{',
        repl,
        src,
        count=1,
    )
    if n == 0:
        # handlers that already name the param `request`
        new_src, n = re.subn(
            r'(export async function GET\(request: NextRequest, context: RouteContext\) \{\n  try \{)',
            r"\1" + GUARD,
            src,
            count=1,
        )
    if n != 1:
        raise SystemExit(f"{f}: GET pattern not matched — aborting, no write")
    f.write_text(new_src)
    changed.append(r)

print("changed:", ", ".join(changed))
print("skipped:", ", ".join(skipped) or "(none)")
