#!/usr/bin/env python3
"""t1184 — the world-gate instrument cure: the DB byte-size check rode the
BOOT COUNT (boot-time writes regrow the freelist — 6 free pages witnessed
with NO film running), so the fingerprint now reads the world's DATA
weight: (page_count − freelist_count) × page_size — immune to freelist
churn; an honest row growth re-keys the number by name (the t1177
discipline, unit-cured). The t1183 re-key's 143360 stands as the first
honest used-pages number (41 pages, 6 free, 35 used = 143360 right now)."""
import pathlib

ROOT = pathlib.Path("/home/z/my-project/scripts")

FOOTPRINT_JS = '''/* t1184 — the fingerprint follows the world's DATA, not the file's fat:
 * the file's byte size rode the BOOT COUNT (boot-time writes regrow the
 * freelist — 6 free pages witnessed with NO film running), so the gate
 * reads the used footprint ((page_count − freelist) × page_size), the
 * rows' own page-quantized weight, immune to freelist churn. An honest
 * row growth re-keys THIS number (the t1177 discipline, unit-cured). */
const dbFootprint = Number(execFileSync("python3", ["-c", "import sqlite3; con = sqlite3.connect('file:db/cryoflow.db?mode=ro', uri=True); pc = con.execute('PRAGMA page_count').fetchone()[0]; fl = con.execute('PRAGMA freelist_count').fetchone()[0]; ps = con.execute('PRAGMA page_size').fetchone()[0]; print((pc - fl) * ps); con.close()"], { encoding: "utf8" }).trim());
ok("the DB footprint held (the used-pages high-water — the t1184 instrument cure: the file's byte size rode the boot count, its freelist churn regrowing 6 pages with NO film running; the fingerprint now reads the world's data weight — the t1183 re-key's 143360 stands as the first honest number; a future row growth re-keys it by name)", dbFootprint === 143360, `${dbFootprint}`);'''

OLD_T102X = '''const dbBytes = statSync(path.join(ROOT, "db/cryoflow.db")).size;
ok("the DB byte size held (the high-water — the t1097 re-key: the fresh t979 replant world's page-quantized size — the t1075 re-key's own precedent (155648→135168); the t1142 re-key: the WorldLedger table's landing grew the high-water (135168→143360, two pages); the t1080 147456 died with the epoch; the WORLD stands 15 — the conn-mvwf4vla replant re-key; the t1177 re-key: the merged lineage's first night of ride churn (status/output UPDATEs through the t1175/t1176 walks) split one more page — 35→36, freelist 0, a vacuum has nothing to reclaim; the t1183 re-key: the film's mint+teardown churn bloated the file to 41 pages with 6 freelist — the VACUUM reclaimed them and the t1177-era 36th page too (the rows stand 15/13/14 — the world one page lighter by honest teardowns) — 147456→143360)", dbBytes === 143360, `${dbBytes}`);'''

IMPORT_LINE = 'import { execFileSync } from "node:child_process";\nconst ROOT = process.cwd();'
ROOT_OLD = 'const ROOT = process.cwd();'

T1164_OLD = '''  const size = execFileSync("stat", ["-c", "%s", "/home/z/my-project/db/cryoflow.db"], {
    encoding: "utf8",
  }).trim();
  ok("A3 the byte face — the lane reads its canonical page-quantized size",
    size === "143360",
    `size=${size}`);'''

T1164_NEW = '''  // t1184 — the used-pages footprint (the file's byte size rode the boot
  // count; the fingerprint reads the world's data weight now)
  const size = execFileSync("python3", ["-c", "import sqlite3; con = sqlite3.connect('file:/home/z/my-project/db/cryoflow.db?mode=ro', uri=True); pc = con.execute('PRAGMA page_count').fetchone()[0]; fl = con.execute('PRAGMA freelist_count').fetchone()[0]; ps = con.execute('PRAGMA page_size').fetchone()[0]; print((pc - fl) * ps); con.close()"], {
    encoding: "utf8",
  }).trim();
  ok("A3 the byte face — the lane reads its canonical used-pages footprint",
    size === "143360",
    `size=${size}`);'''

# the four t102x units (identical shape after the t1183 re-key)
for name in ["t1021-import-fuel-unit.mjs", "t1022-fuel-face-unit.mjs",
             "t1023-watchdog-guard-unit.mjs", "t1024-dialog-fuel-unit.mjs"]:
    p = ROOT / name
    text = p.read_text()
    assert text.count(OLD_T102X) == 1, f"{name}: old ok() shape not found once"
    text = text.replace(OLD_T102X, FOOTPRINT_JS)
    assert text.count(ROOT_OLD) == 1, f"{name}: ROOT line not found once"
    text = text.replace(ROOT_OLD, IMPORT_LINE)
    p.write_text(text)
    print(f"  footprint-cured {name}")

# t1164 (the stat-based face)
p = ROOT / "t1164-takehome-proof-unit.mjs"
text = p.read_text()
assert text.count(T1164_OLD) == 1, "t1164: stat block not found once"
text = text.replace(T1164_OLD, T1164_NEW)
p.write_text(text)
print("  footprint-cured t1164-takehome-proof-unit.mjs")
print("ALL FIVE FOOTPRINT-CURED")
