#!/usr/bin/env python3
"""t870 — the flip-leg siblings retarget: t258/t257's inline corpse pin
(direct DATABASE_URL=db/cryoflow.db in a spawn) learns the t868/t704 law —
.env FIRST, the frozen pin as fallback, the world named at the gate.
The same fix t870 gave t260, applied to the direct 3D-viewer family."""
import sys

RESOLVER = '''  // t870 — the DB pin resolves .env FIRST (the t868/t704 law: any leg
  // that names a DB file must not answer from the frozen 0-byte corpse;
  // the living world rides db/custom.db through .env). Prisma's own
  // rule: absolute kept, relative resolved from prisma/. The frozen pin
  // stands as fallback; the world is NAMED at the gate.
  const dbUrl = (() => {
    try {
      const m = readFileSync(".env", "utf8").match(/^DATABASE_URL=(.*)$/m);
      if (m) {
        let u = m[1].trim().replace(/^["']|["']$/g, "");
        if (!u.startsWith("file:")) u = "file:" + u;
        if (/^file:[^/]/.test(u)) u = "file:/home/z/my-project/prisma/" + u.slice(5);
        return u;
      }
    } catch { /* fall through */ }
    return "file:/home/z/my-project/db/cryoflow.db";
  })();
  console.log(`  · the flip leg rides ${dbUrl}`);
'''

CORPSE = 'DATABASE_URL="file:/home/z/my-project/db/cryoflow.db" node -e'
LIVE = 'DATABASE_URL="${dbUrl}" node -e'

for f in sys.argv[1:]:
    src = open(f).read()
    if "const dbUrl = (() =>" in src:
        print(f"{f}: already retargeted")
        continue
    if CORPSE not in src:
        print(f"{f}: no corpse spawn found")
        continue
    idx = src.find(CORPSE)
    # the spawn must sit inside an execSync( — insert the resolver before it
    head = src.rfind("execSync(", 0, idx)
    if head == -1:
        print(f"{f}: execSync wrapper not found")
        continue
    src = src[:head] + RESOLVER + src[head:]
    src = src.replace(CORPSE, LIVE, 1)
    open(f, "w").write(src)
    print(f"{f}: retargeted (.env-first)")
