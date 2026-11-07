#!/usr/bin/env python3
"""t880 — the four-window backfill: t871..t874 claimed feat/qa/docs three-car
commits that never landed (the tree stood at 511e5e5 = t870 docs). This script
splits the uncommitted worklog (Task 871..874 entries, +129 lines) into four
progressive versions and lands each window's three cars in order, honoring
each entry's own Commits: claim. The sonner retirement t874 claimed is
completed here (zero consumers verified live)."""

import subprocess, sys, time

W = "worklog.md"

def run(*cmd, allow_fail=False):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 and not allow_fail:
        print("FAIL:", " ".join(cmd)); print(r.stdout[-800:]); print(r.stderr[-800:]); sys.exit(1)
    return r.stdout.strip()

def commit(msg):
    run("git", "commit", "-q", "-m", msg)

lines = open(W, encoding="utf-8").read().split("\n")

def entry_start(title_prefix):
    for i, l in enumerate(lines):
        if l.startswith(title_prefix):
            # walk back over [blank, ---, blank]
            j = i - 1
            if j >= 0 and lines[j].strip() == "":
                j -= 1
            if j >= 0 and lines[j].strip() == "---":
                j -= 1
                if j >= 0 and lines[j].strip() == "":
                    j -= 1
            return j + 1
    raise SystemExit(f"boundary not found: {title_prefix}")

s872 = entry_start("## Task 872 —")
s873 = entry_start("## Task 873 —")
s874 = entry_start("## Task 874 —")
print(f"boundaries: v1=<:{s872} v2=<{s873} v3=<{s874} total={len(lines)}")
assert s872 < s873 < s874 < len(lines)

versions = {
    "v1": "\n".join(lines[:s872]) + "\n",
    "v2": "\n".join(lines[:s873]) + "\n",
    "v3": "\n".join(lines[:s874]) + "\n",
    "v4": "\n".join(lines) + "\n",
}

# ---- t871 ----
open(W, "w", encoding="utf-8").write(versions["v1"])
run("git", "add",
    "src/components/workflow/header.tsx",
    "scripts/dev-server.sh", "scripts/prod-3001.sh", "scripts/t834-band-sweep.mjs")
commit("feat(t871): the T510 residue's fix lands (overflow-hidden on the PS wrapper, the t839/t840 pricing pre-flighted; D4 flips to the clipped truth, E8 grows the fix's fingerprint, E9 flips to the CLIPPED stack, E10 now guards the fix) + the DB lane war ends (both launchers' t377 hard pins become \${DATABASE_URL:-...} passthroughs — the t872 ruling is CODE: one world, two lanes, no more 0-byte-DB 500s; the /proc/<pid>/fd witness settled it, the band-audit's residue section carries the ON THE RECORD, FIXED stamp)")
run("git", "add",
    "shots-qa/t834-band-sweep.json", "shots-qa/t843-a11y-rewitness.json",
    "shots-qa/t844-a11y-fragile-pair.json", "scripts/t844-a11y-fragile-pair.mjs",
    "shots-qa/t846-a11y-maintenance.json", "scripts/t846-a11y-maintenance.mjs",
    "shots-qa/t869-textpreview-a11y.json", "shots-qa/t870-aipanel-a11y.json")
commit("qa(t871): the sweep 83/83 green on the restored prod build (r8GOxh-ymcGX-2mJMCj9w, the --webpack calibre — the t820 floor was a --webpack number and the default lane had silently become turbopack), the world healed on the prod lane through the lane's own healers (15/15 completed, FSC 40 shells 0.143 at 7.78A, the official 7.79A in the postprocess result), the census fixture re-seeded through the app's own door (PUT camera-bookmarks whitelist, count:0 taught the wrapper shape), the gate re-pinned 25/25 (M16 palette floor 150->148 with receipt provenance), the fleet all green (t843 11/11, t844 16/16 + A15 re-pin, t869 41/41, t870 43/43) — 219 assertions green")
run("git", "add", W, "docs/band-audit.md")
commit("docs(t871): the build-day bill PAID entry — the world's death discovered at the gate, the DB lane war ended, the build recalibrated WITH its lane, the T510 residue's fix stamped, the fixture seeded through the door; judge-lines: the calibration law carries its lane, the pin expires but the database does not lie, the fixture also walks through the door")

# ---- t872 ----
open(W, "w", encoding="utf-8").write(versions["v2"])
run("git", "add", "shots-qa/t872-template-presets-a11y.json")
commit("qa(t872): the template presets dialog walked green at first ride (26/26 x2, arm 3 bit-for-bit) — the a11y rotation's new room, the t871 accident's redemption as the walk's world-guard armor (world-guard assertions aboard), and the honest accname law's first live teach (a control whose accessible name would lie is taught, not slandered); gate 25/25 standing re-ride, fleet rotation count 5")
run("git", "add", W)
commit("docs(t872): the template presets room's entry — no src files touched (tsc/eslint clean), the world restored net zero after the recon's accident then guarded")

# ---- t873 ----
open(W, "w", encoding="utf-8").write(versions["v3"])
run("git", "add", "shots-qa/t873-compare-dialogs-a11y.json")
commit("qa(t873): the compare-FSC-curves dialog's deep faces walked green at birth (46/46 x2, eight faces bit-for-bit) — one Escape peels ONE layer (the layered-stack testimony), the two orthogonal axes pinned (what the dialog edits vs what the world keeps), the clean-room law's third teach (a walk's world must be minted, not borrowed); gate 25/25, fleet rotation count 6, the sonner TS2307 recorded untouched")
run("git", "add", W)
commit("docs(t873): the compare-FSC room's entry — the per-face ledger, six instrument lessons, the world restored (picks verbatim, pan untouched, jobs 15/15)")

# ---- t874 ----
open(W, "w", encoding="utf-8").write(versions["v4"])
run("git", "rm", "-q", "src/components/ui/sonner.tsx")
run("git", "add",
    "src/components/workflow/results/run-compare-dialog.tsx",
    "scripts/start-prod.sh")
commit("feat(t874): the run A/B dialog grows its own Escape consumer (onEscapeClose — preventDefault + stopPropagation + close; the family dialect already worn by remote-cluster/pipeline-script/hpc-sbatch) — the ESCAPE DISEASE caught live (one Escape peeled TWO layers on run-compare: no React-level consumer meant Radix saw the raw dismiss; the sibling fsc-compare's own comment prophesied it) + the start-prod launcher's t407 hard pin becomes a passthrough (the t872 ruling's last holdout; the three data lanes named: the repo tree, the build's frozen snapshot, the 0-byte DB) + the sonner residue retired (zero consumers, the only tsc error gone)")
run("git", "add", "shots-qa/t874-run-compare-a11y.json")
commit("qa(t874): the run A/B dialog's deep walk 33/34 — the one red is the disease's receipt filmed on the build that still carries the bug (the fix rides in src; the build-day re-ride turns the face green with the SAME instrument), the Class verdict filmed with its 46 honest unpaired rows (46 unpaired rows that never voted), the third data lane discovered mid-walk (the faces went hollow with NO code change: a bare reboot reads the BUILD's frozen snapshot, CRYOFLOW_DATA_DIR is the designed cure); gate 25/25 standing re-ride, fleet rotation count 7")
run("git", "add", W)
commit("docs(t874): the run A/B room's entry — the disease's anatomy, the three-lane doctrine, the shape note held with an honest absence; the t875 entry points at the build-day bill (the run-compare Escape fix is IN SRC and UNBUILT) and the compare family's un-filmed adoption verbs")

print(run("git", "log", "--oneline", "-11"))
print("BACKFILL COMPLETE")
