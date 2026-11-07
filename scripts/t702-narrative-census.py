#!/usr/bin/env python3
"""
t702 — the narrative census: the enforcement instrument for the t701 narrative law.

t701 legislated: a story may only tell what the world can prove (the t636
claim-without-write law, narrative edition); append-only; the canonical head
line is sacred. t699's lesson: a law without a re-runnable audit is folklore.
This census is the audit — it mechanically re-proves every claim the
demo world's narratives make, from the world's own evidence:

  Layer A — shape:  head-line echo fidelity vs the engine record's `result`
            field; narrative line counts; [seeded] prefixes; the blank
            separator; the AI log-tail consumer window (<= 25 content
            lines, tools.ts L2736); the three canonical logs (t531/t696/
            t699 lineages) and topaztrain's parseable CSV contract (t666).
  Layer B — provenance: every number in every story re-read from the
            world's own artifacts — star row counts, class distributions,
            the defocus family, FSC anchors, pixel size, CSV epochs, the
            key-files reference shape; the engine argv defaults at source
            level (engine.ts); every story's downstream consumers vs the
            DB's own Edge graph (bidirectional, leaf-ness included).
  Layer C — idempotency witness: the t701 patch re-run must skip all 14
            (thin-shape guards stand) — the world is stable under its own
            author.

Read-only: DB opened mode=ro; nothing written. World-riding: the census
reads the actual logs on disk, not a copy of the patch's text — if a log
drifts from the law, the census convicts it.
"""
import json
import os
import re
import sqlite3
import struct
import subprocess
import sys

BASE = "/home/z/my-project"
PDIR = os.path.join(BASE, "data/relion/cmuwipe6350000demoproject")
DB = os.path.join(BASE, "db/cryoflow.db")
ENGINE_TS = os.path.join(BASE, "src/lib/relion/engine.ts")
T701 = os.path.join(BASE, "scripts/t701-story-enrichment-patch.mjs")

fail = 0
n_checks = 0


def ok(cond, msg):
    global fail, n_checks
    n_checks += 1
    print(f"  {'ok' if cond else 'FAIL'}: {msg}")
    if not cond:
        fail += 1
    return cond


def section(title):
    print(f"\n== {title}")


# ---------------------------------------------------------------- parsing --

def parse_star(path):
    """RELION star parser tolerant of this world's three shapes:
    multi-data-block files, bare-loop files (no data_ header — coords.star),
    and key-value blocks (data_general). Blocks: name -> {headers, kv, rows}."""
    blocks = {}

    def blk(name):
        return blocks.setdefault(name, {"headers": [], "kv": {}, "rows": []})

    cur, inloop = "", False
    B = blk("")
    for raw in open(path, encoding="utf-8", errors="replace"):
        s = raw.strip()
        if not s or s.startswith("#"):
            continue
        if s.startswith("data_"):
            cur, inloop = s[5:], False
            B = blk(cur)
        elif s == "loop_":
            inloop = True
            B = blk(cur)
        elif s.startswith("_rln"):
            name = s.split()[0]
            if inloop:
                if name not in B["headers"]:
                    B["headers"].append(name)
            else:
                parts = s.split(None, 1)
                if len(parts) == 2:
                    B["kv"][parts[0]] = parts[1].strip()
        else:
            parts = s.split()
            if inloop and B["headers"] and len(parts) >= len(B["headers"]):
                B["rows"].append(parts)
    return blocks


def big_block(blocks):
    """The row-bearing block of a single-population star (max rows)."""
    return max(blocks.values(), key=lambda b: len(b["rows"]))


def nrows(path):
    return len(big_block(parse_star(path))["rows"])


def read_log(wd):
    return open(os.path.join(PDIR, wd, "run.log"), encoding="utf-8").read().splitlines()


# ------------------------------------------------------------- the world --

st = json.load(open(os.path.join(BASE, "data/engine-state.json"), encoding="utf-8"))
records = st.get("runs", st)
records = {k: v for k, v in records.items() if isinstance(v, dict) and v.get("type")}

con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
cur = con.cursor()
jobs = {row[0]: {"type": row[1], "name": row[2]}
        for row in cur.execute("SELECT id, type, name FROM Job").fetchall()}
edges = cur.execute("SELECT fromJobId, toJobId FROM Edge").fetchall()
imp_row = cur.execute("SELECT params FROM Job WHERE type='import'").fetchone()
imp_params = json.loads(imp_row[0]) if imp_row and imp_row[0] else {}
con.close()

type_of = {jid: j["type"] for jid, j in jobs.items()}
wd_of, result_of = {}, {}
for jid, rec in records.items():
    wd = rec.get("workdir") or ""
    if os.path.isabs(wd) and os.path.dirname(wd) == PDIR:
        wd_of[jid] = os.path.basename(wd)
    result_of[jid] = rec.get("result") or ""

completed = [jid for jid in jobs if jid in wd_of and jid in records]
section(f"world: {len(jobs)} DB jobs, {len(records)} engine records, "
        f"{len(completed)} jobs with record+workdir, {len(edges)} edges")

# ------------------------------------------------- the expected narratives --
# (from the t701 STORIES table: workdir -> number of [seeded] narrative lines)
NARRATIVE_LINES = {
    "import_00import": 4, "motioncorr_tioncorr": 4, "ctffind_0ctffind": 4,
    "autopick_autopick": 4, "extract_0extract": 4, "class2d_0class2d": 4,
    "select2d_select2d": 4, "select_00select": 3, "class3d_0class3d": 4,
    "symexpand_ymexpand": 4, "rebalance_ebalance": 4, "refine3d_refine3d": 4,
    "postprocess_tprocess": 4, "topazdenoise_zdenoise": 4,
}
CANONICAL = {"initialmodel_ialmodel": 3, "maskcreate_skcreate": 4, "topaztrain_paztrain": 15}

# =================================================================
section("Layer A — narrative shape (the law's letter)")
# =================================================================

# A0: every completed job's log exists and fits the AI log-tail window
for jid in sorted(completed, key=lambda j: type_of[j]):
    wd = wd_of[jid]
    lp = os.path.join(PDIR, wd, "run.log")
    if not ok(os.path.isfile(lp), f"{type_of[jid]}: run.log on disk ({wd})"):
        continue
    lines = [l for l in read_log(wd) if l.strip()]
    ok(len(lines) <= 25, f"{type_of[jid]}: {len(lines)} content lines fit the 25-line log-tail window (tools.ts L2736)")

# A1: head-line echo fidelity — the part after the em-dash IS the record's result.
# Exception (the seed's dual voice): topaztrain's head carries the seed's short
# log voice while its record.result is the richer CSV-provable verdict — checked
# deeper in B-topaztrain instead of by equality.
for jid in sorted(completed, key=lambda j: type_of[j]):
    wd = wd_of[jid]
    if "topaztrain" in wd:
        head = read_log(wd)[0]
        ok(head == "seeded by qa-t531-old-world-seed — Topaz model trained on the denoised stack (general-model flow)",
           "topaztrain: head is the seed's short log voice, byte-stable (append-only anchor)")
        continue
    lines = read_log(wd)
    head = lines[0] if lines else ""
    res = result_of[jid]
    if head.startswith("seeded by qa-t531-old-world-seed — "):
        echo = head.replace("seeded by qa-t531-old-world-seed — ", "", 1)
        ok(echo == res, f"{type_of[jid]}: head line echoes the record's result verbatim")
    else:
        ok(head.startswith("[seeded]"), f"{type_of[jid]}: canonical head (t531/t696/t699 lineage, [seeded] voice)")

# A2: the 14 enriched logs — head, blank separator, expected count, [seeded] prefixes
for wd, n in NARRATIVE_LINES.items():
    lines = read_log(wd)  # raw lines, blank separator must be present
    good = (
        len(lines) == 2 + n
        and lines[0].startswith("seeded by qa-t531-old-world-seed — ")
        and lines[1] == ""
        and all(l.startswith("[seeded] ") for l in lines[2:])
    )
    ok(good, f"{wd}: head + blank + {n} [seeded] narrative lines (append-only shape intact)")

# A3: the three canonical logs
lm = read_log("initialmodel_ialmodel")
ok(len(lm) == 3 and all(l.startswith("[seeded]") for l in lm),
   "initialmodel: 3-line t696 narrative, [seeded] voice throughout")
mk = read_log("maskcreate_skcreate")
ok(len(mk) == 4 and all(l.startswith("[seeded]") for l in mk),
   "maskcreate: 4-line t699 narrative, [seeded] voice throughout")
tt = read_log("topaztrain_paztrain")
tt_good = (
    len(tt) == 15
    and tt[0].startswith("seeded by qa-t531-old-world-seed — ")
    and tt[1] == ""
    and tt[2] == "# it,train_loss,test_loss,precision,recall"
    and len(tt[3:]) == 12
    and all(len(r.split(",")) == 5 for r in tt[3:])
    and [int(r.split(",")[0]) for r in tt[3:]] == list(range(12))
)
ok(tt_good, "topaztrain: head + CSV contract block (12 epochs it=0..11, 5 columns) — t666 loader shape intact")

# =================================================================
section("Layer B — provenance (the law's spirit: tell only what the world can prove)")
# =================================================================

# B-import: 10 micrographs, the 1.77 x 16 = 28.32 A/px dual scale, frames linked in place
b = parse_star(os.path.join(PDIR, "import_00import/micrographs.star"))
ok(len(b.get("micrographs", {}).get("rows", [])) == 10, "import: micrographs.star has 10 rows ('10 real EMPIAR micrographs')")
opt = b.get("optics", {})
px = float(opt["rows"][0][opt["headers"].index("_rlnMicrographPixelSize")]) if opt.get("rows") else None
ok(px == 1.77, f"import: star optics pixel {px} == 1.77 (the detector scale the DB params carry)")
dn_mrc = next(os.path.join(PDIR, "topazdenoise_zdenoise", f) for f in os.listdir(os.path.join(PDIR, "topazdenoise_zdenoise")) if f.endswith("_denoised.mrc"))
h = open(dn_mrc, "rb").read(1024)
nx, ny = struct.unpack("<2i", h[0:8])
px_mrc = struct.unpack("<f", h[40:44])[0] / nx
ok(nx == 256 and ny == 256, f"topazdenoise: denoised MRC is {nx}x{ny} ('256x256 frames')")
ok(round(px_mrc, 3) == 28.32 and abs(px - 28.32 / 16) < 1e-9,
   f"import: MRC headers carry {px_mrc:.2f} A/px == 1.77 x 16 ('28.32 A/px at the micrograph scale', binned ratio exact)")
ok(imp_params.get("pixelSize") == 1.77, f"import: DB params pixelSize {imp_params.get('pixelSize')} == the star's detector scale")
ok("empiar10017" in imp_params.get("micrographsPath", ""), f"import: DB params path '{imp_params.get('micrographsPath')}' proves the EMPIAR-10017 lineage")
frames = os.listdir(os.path.join(PDIR, "import_00import/micrographs"))
ok(len(frames) == 10, f"import: micrographs/ holds {len(frames)} linked frames (hard-link manifest, zero copy)")

# B-motioncorr: 10 corrected micrographs
ok(nrows(os.path.join(PDIR, "motioncorr_tioncorr/corrected_micrographs.star")) == 10,
   "motioncorr: corrected_micrographs.star has 10 rows ('10 movies summed')")

# B-ctffind: 10 fitted, defocus family 14.6k-12.7k A, astigmatism free
b = parse_star(os.path.join(PDIR, "ctffind_0ctffind/micrographs_ctf.star"))
dm = b.get("micrographs", {})
ok(len(dm.get("rows", [])) == 10, "ctffind: micrographs_ctf.star has 10 rows ('10 micrographs fitted')")
if dm.get("rows"):
    iu, iv = dm["headers"].index("_rlnDefocusU"), dm["headers"].index("_rlnDefocusV")
    us = [float(r[iu]) for r in dm["rows"]]
    vs = [float(r[iv]) for r in dm["rows"]]
    lo, hi = min(us + vs), max(us + vs)
    story = " ".join(l for l in read_log("ctffind_0ctffind") if "defocus family" in l)
    ok(f"{hi / 1000:.1f}k - {lo / 1000:.1f}k A" in story,
       f"ctffind: story's family '{hi / 1000:.1f}k - {lo / 1000:.1f}k A' == the artifact's [{lo:.1f}, {hi:.1f}] (the number the world proves)")
    res_rec = result_of.get(next(j for j, w in wd_of.items() if w == "ctffind_0ctffind"), "")
    ok(f"{hi / 1000:.1f}-{lo / 1000:.1f}k" in res_rec, f"ctffind: record result carries the same mechanical family '{hi / 1000:.1f}-{lo / 1000:.1f}k'")
    iast = dm["headers"].index("_rlnCtfAstigmatism") if "_rlnCtfAstigmatism" in dm["headers"] else None
    if iast is not None:
        ast_col = [float(r[iast]) for r in dm["rows"]]
        ok(max(ast_col) < 300.0, f"ctffind: the star's own CtfAstigmatism column max {max(ast_col):.1f} A < 300")
    astig = max(abs(u - v) for u, v in zip(us, vs))
    ok(astig < 300.0 and "astigmatism under 300 A" in story,
       f"ctffind: max |U-V| {astig:.1f} A < 300 ('astigmatism under 300 A' — the provable form of the claim)")

# B-autopick: 170 picks
ok(nrows(os.path.join(PDIR, "autopick_autopick/coords.star")) == 170,
   "autopick: coords.star has 170 rows ('170 particles picked')")

# B-extract: 240 boxes, stack project-side (key-files law)
b = parse_star(os.path.join(PDIR, "extract_0extract/extract.star"))
pb = big_block(b)
ok(len(pb["rows"]) == 240, "extract: extract.star has 240 rows ('240 particle boxes boxed from the 170 picks')")
refs = {r[0].split("@")[-1] for r in pb["rows"]} if pb["rows"] else set()
ok(refs == {"extract_0extract/particles.mrcs"},
   f"extract: every box references the project-side stack {refs} ('the STAR comes home, the stack stays project-side')")
iog = pb["headers"].index("_rlnOpticsGroup") if "_rlnOpticsGroup" in pb["headers"] else None
if iog is not None:
    ogs = {r[iog] for r in pb["rows"]}
    ok(ogs == {"1"}, f"extract: optics groups uniform ({ogs}) — rebalance's story: 'optics metadata stays uniform'")
ok(os.path.isfile(os.path.join(PDIR, "extract_0extract/particles.mrcs")),
   "extract: particles.mrcs on disk ('the boxed stack on disk')")

# B-class2d: K=8, 240 particles, 96/72 = 40%/30%, six minor classes
b = parse_star(os.path.join(PDIR, "class2d_0class2d/run_it012_data.star"))
cb = big_block(b)
dist = {}
for r in cb["rows"]:
    dist[r[cb["headers"].index("_rlnClassNumber")]] = dist.get(r[cb["headers"].index("_rlnClassNumber")], 0) + 1
ok(len(cb["rows"]) == 240, "class2d: run_it012_data.star has 240 rows ('240 particles')")
ok(sorted(map(int, dist)) == list(range(1, 9)), f"class2d: {len(dist)} classes == K=8 ('two good views, six minor classes')")
ok(dist.get("1") == 96, f"class2d: class 1 carries {dist.get('1')}/240 = 40% ('class 1 carries 40%')")
ok(dist.get("2") == 72, f"class2d: class 2 carries {dist.get('2')}/240 = 30% ('class 2 carries 30%')")
ok(len(cb["rows"]) - 96 - 72 == 72 and len([k for k in dist if k not in ("1", "2")]) == 6,
   "class2d: six minor classes share the remaining 72")
ok(os.path.isfile(os.path.join(PDIR, "class2d_0class2d/run_unmasked_classes.mrcs")),
   "class2d: run_unmasked_classes.mrcs on disk (the gallery's 8 faces)")
for f in ("run_it012_data.star", "run_it012_model.star"):
    ok(os.path.isfile(os.path.join(PDIR, "class2d_0class2d", f)), f"class2d: {f} on disk ('run_it012 is the settled round')")

# B-select2d / B-select: 168 kept across classes 1-2, the rule mechanically proven
ok(nrows(os.path.join(PDIR, "select2d_select2d/particles_select2d.star")) == 168,
   "select2d: particles_select2d.star has 168 rows ('168 of 240 particles kept')")
best = max(dist.values())
kept2d = {int(k): v for k, v in dist.items() if v >= 0.5 * best}
ok(kept2d == {1: 96, 2: 72} and all(v < 0.5 * best for k, v in dist.items() if k not in ("1", "2")),
   f"select2d: 'occupancy >= 0.5x best' rule re-fires on the artifact: keeps {kept2d}, drops {[k for k, v in dist.items() if v < 0.5 * best]}")
b = parse_star(os.path.join(PDIR, "select_00select/selected.star"))
sb = big_block(b)
sd = {}
for r in sb["rows"]:
    sd[r[sb["headers"].index("_rlnClassNumber")]] = sd.get(r[sb["headers"].index("_rlnClassNumber")], 0) + 1
ok(len(sb["rows"]) == 168, "select: selected.star has 168 rows ('168 particles from classes 1-2')")
ok(sd == {"1": 96, "2": 72}, f"select: class tags {sd} == classes 1-2 ('the demo world's canonical kept set')")

# B-class3d: K=3, 168 particles, three volumes on disk
b = parse_star(os.path.join(PDIR, "class3d_0class3d/run_it003_data.star"))
c3b = big_block(b)
c3 = {r[c3b["headers"].index("_rlnClassNumber")] for r in c3b["rows"]}
ok(len(c3b["rows"]) == 168, "class3d: run_it003_data.star has 168 rows ('168 particles')")
ok(sorted(c3) == ["1", "2", "3"], f"class3d: {sorted(c3)} == K=3 ('three volumes resolved')")
ok(all(os.path.isfile(os.path.join(PDIR, "class3d_0class3d", f"run_it003_class00{i}.mrc")) for i in (1, 2, 3)),
   "class3d: run_it003_class001/002/003.mrc on disk (the manifest's real names)")

# B-symexp / B-rebalance: the faithful 168 pass-through
for f, claim in [("symexpand_ymexpand/particles_symexp.star", "symexpand: 168 in, 168 rows out ('the C1 world adds no symmetry mates')"),
                 ("rebalance_ebalance/particles_rebalanced.star", "rebalance: 168 rows ('168 particles redistributed')")]:
    ok(nrows(os.path.join(PDIR, f)) == 168, claim)

# B-refine3d: gold-standard halves + 3.62 A anchor (t705: run_data.star
# dropped — it was a qa52/53 SEED artifact ("Task 52 superset") that sat in
# the workdir long enough to fossilize into furniture; the qa57 cleanup
# rightly took it and the census crashed pinning it as canonical. The 168
# number's disk evidence already lives where the chain made it: the
# rebalance pass-through above. A seed's five-day stay is not tenure.)
for f in ("run_it020_half1.mrc", "run_it020_half2.mrc", "run_it020_model.star"):
    ok(os.path.isfile(os.path.join(PDIR, "refine3d_refine3d", f)), f"refine3d: {f} on disk (the manifest's real names)")
rg = parse_star(os.path.join(PDIR, "refine3d_refine3d/run_it020_model.star"))
res20 = rg.get("model_general", {}).get("kv", {}).get("_rlnCurrentResolution")
ok(res20 == "3.620000", f"refine3d: model star _rlnCurrentResolution {res20} == 3.62 ('FSC 0.143 crosses at 3.62 A')")

# B-postprocess: 40 FSC rows, 3.12 A verdict, the mask edge named by the file itself
pp = parse_star(os.path.join(PDIR, "postprocess_tprocess/postprocess.star"))
ok(len(pp.get("fsc", {}).get("rows", [])) == 40,
   f"postprocess: data_fsc has {len(pp.get('fsc', {}).get('rows', []))} rows ('40 rows — the FSC curve')")
gen = pp.get("general", {}).get("kv", {})
ok(gen.get("_rlnFinalResolution") == "3.120000",
   f"postprocess: _rlnFinalResolution {gen.get('_rlnFinalResolution')} == 3.12 ('3.12 A at FSC=0.143')")
ok(gen.get("_rlnMaskName") == "maskcreate/mask.mrc",
   f"postprocess: _rlnMaskName {gen.get('_rlnMaskName')} — the mask edge proven by the file's own block")
ok(3.62 - 3.12 == 0.50, "postprocess: 3.62 - 3.12 = 0.50 A ('0.50 A better than the raw refine')")

# B-topazdenoise: 10 denoised micrographs, prefix-joined
ok(nrows(os.path.join(PDIR, "topazdenoise_zdenoise/denoised_micrographs.star")) == 10,
   "topazdenoise: denoised_micrographs.star has 10 rows ('10 micrographs denoised')")
dn = [f for f in os.listdir(os.path.join(PDIR, "topazdenoise_zdenoise")) if f.endswith("_denoised.mrc")]
ok(len(dn) == 10 and all(f.startswith("Falcon_") for f in dn),
   f"topazdenoise: {len(dn)} Falcon_*_denoised.mrc on disk ('one per micrograph, prefix-joined')")

# B-topaztrain: the 12-epoch diary (already shape-checked in A3; the number proven there)
ok(len(tt[3:]) == 12, "topaztrain: 12 CSV epochs ('its 12-epoch training diary' — the number topazdenoise's story cites)")
# the record's richer verdict (the seed's dual voice) must be CSV-provable:
# 'best test loss X at epoch Y' -> CSV row Y's test_loss column is X
m = re.search(r"best test loss ([\d.]+) at epoch (\d+)", result_of.get(next((j for j, w in wd_of.items() if "topaztrain" in w), ""), ""))
if ok(m is not None, "topaztrain: record verdict carries a 'best test loss X at epoch Y' claim"):
    loss, ep = float(m.group(1)), int(m.group(2))
    csv = [r.split(",") for r in tt[3:]]
    ok(ep < len(csv) and abs(float(csv[ep][2]) - loss) < 1e-9,
       f"topaztrain: CSV row {ep} test_loss {csv[ep][2]} == the record's claimed {loss} (the record's numbers live in the artifact)")
    ok(int(csv[-1][0]) == 11, "topaztrain: CSV's last it row is 11 — '12 epochs' mechanically true")

# B-argv: the engine's real defaults, at source level
src = open(ENGINE_TS, encoding="utf-8").read()
for tok, claim in [
    ('"--Box", String(num(job, "box", 512))', "ctffind --Box default 512"),
    ('"--ResMin", String(num(job, "resMin", 30))', "ctffind --ResMin default 30"),
    ('"--ResMax", String(num(job, "resMax", 5))', "ctffind --ResMax default 5"),
    ('"--dFMin", String(num(job, "dFMin", 5000))', "ctffind --dFMin default 5000"),
    ('"--dFMax", String(num(job, "dFMax", 50000))', "ctffind --dFMax default 50000"),
    ('"--FStep", "500"', "ctffind --FStep 500"),
    ('argv.push("--use_own", "--j", String(Math.max(1, Math.round(num(job, "threads", 4)))))',
     "motioncorr --use_own --j 4 (own implementation lane)"),
]:
    ok(tok in src, f"engine argv: {claim}")

# ------------------------------------------------- B-edges: downstream claims --

CONSUMERS = [  # longest-first so 'Select' never eats 'Select 2D'
    ("Symmetry-expand", "symexpand"), ("Symmetry expansion", "symexpand"),
    ("2D classification", "class2d"),
    ("3D classification", "class3d"), ("Topaz-denoise", "topazdenoise"),
    ("InitialModel", "initialmodel"), ("Topaz-train", "topaztrain"),
    ("Postprocess", "postprocess"), ("MaskCreate", "maskcreate"),
    ("Refine3D", "refine3d"), ("Rebalance", "rebalance"),
    ("MotionCorr", "motioncorr"), ("Select 2D", "select2d"),
    ("CtfFind", "ctffind"), ("Auto-pick", "autopick"),
    ("Extract", "extract"), ("Select", "select"),
]

out_edges = {}
for f, t in edges:
    out_edges.setdefault(f, set()).add(type_of.get(t))

section("Layer B-edges — every story's downstream consumers vs the DB's own graph")
for wd in sorted(NARRATIVE_LINES):
    lines = read_log(wd)
    dl = next((l for l in lines if l.startswith("[seeded] downstream: ")), None)
    jid = next((j for j, w in wd_of.items() if w == wd), None)
    if not ok(dl is not None and jid is not None, f"{wd}: a downstream line exists and the job is known"):
        continue
    text = dl.replace("[seeded] downstream: ", "")
    named = set()
    for disp, typ in CONSUMERS:
        if disp in text:
            named.add(typ)
            text = text.replace(disp, "·")
    actual = out_edges.get(jid, set())
    ok(named == actual,
       f"{wd}: story names {sorted(named)} == edges' targets {sorted(actual)} (bidirectional, no ghost consumers)")

# body-claim edges: two stories cite their INPUT edges explicitly
ok(("cmututold000initialmodel", "cmuwipe635000class3d") in {(f, t) for f, t in edges},
   "class3d body claim: 'the initial reference came from InitialModel (the workflow's own model edge)' — edge exists")
ok(("cmututold00000maskcreate", "cmuwipe6350postprocess") in {(f, t) for f, t in edges},
   "postprocess body claim: 'the solvent mask rode in from MaskCreate (the workflow's mask edge)' — edge exists")

# =================================================================
section("Layer C — idempotency witness (the world is stable under its own author)")
# =================================================================
r = subprocess.run(["node", T701], capture_output=True, text=True, timeout=60)
out = r.stdout
n_skip = out.count("skip (idempotent / not thin)")
n_enrich = out.count("enriched:")
ok(r.returncode == 0, f"t701 patch re-run exits 0 (returncode {r.returncode})")
ok(n_skip == 14 and n_enrich == 0,
   f"t701 patch re-run: {n_skip} skips, {n_enrich} enrichments — thin-shape guards stand, nothing clobbered")

# =================================================================
print(f"\n==== t702 narrative census: {n_checks - fail} pass / {fail} fail ====")
sys.exit(0 if fail == 0 else 1)
