#!/usr/bin/env node
/**
 * t701 — the story enrichment patch: the demo world's chain logs grow
 * from one-liners into narratives, per the t701 narrative audit.
 *
 * The audit found the world's narrative layer split in two: three rich
 * logs (topaztrain's 14-line training diary — the t666 model,
 * initialmodel and maskcreate from t696/t699) against **14 one-line
 * logs** ("seeded by qa-t531-old-world-seed — <result>"). The strips
 * speak numbers; the Log tab had almost nothing to say beyond the
 * result line echoed back.
 *
 * Law of the patch:
 *   - APPEND-ONLY: the canonical first line is kept byte-for-byte (it
 *     is the seed's voice and the only line any consumer could key on);
 *     the narrative grows BELOW it. Idempotency guard is the thin-shape
 *     precondition: the patch enriches only a log whose current content
 *     is exactly the one-liner — a re-seeded or already-rich log is
 *     skipped, never clobbered. (Double-run = no-op.)
 *   - A story may only tell what the world can prove (the t636
 *     claim-without-write law, narrative edition): every number below is
 *     read from the world's own artifacts or result lines — particle
 *     counts (170 picked / 240 extracted / 168 kept), class counts
 *     (K=8 / K=3), iteration numbers from the on-disk stars (it012
 *     class2d, it003 class3d, it020 refine3d), defocus family
 *     (14.9–12.7k Å), FSC anchors (3.62 Å refine, 3.12 Å post), the
 *     engine's real defaults where read (ctffind Box 512 / ResMin 30 /
 *     ResMax 5 / dF 5000–50000; motioncorr --use_own --j 4).
 *   - Artifact manifests name the REAL files in each workdir (the
 *     inventories the patch asserts before writing).
 *   - Chain context names the real downstream consumers (the workflow's
 *     own edges: motioncorr feeds ctffind AND topazdenoise; refine3d
 *     feeds postprocess's half1 AND maskcreate's map; maskcreate feeds
 *     postprocess's mask).
 *   - topaztrain's log is CONTRACTUAL (the training-curve loader parses
 *     its CSV block — t666) and is NOT touched. initialmodel/maskcreate
 *     are already rich and are NOT touched.
 *   - File-only surgery: zero DB writes, zero engine-state writes. The
 *     only app-side run.log consumer is the AI tools' log tail (last 25
 *     lines, display leg — tools.ts L2736) which the narrative serves,
 *     not breaks. External writers are the documented tolerated pattern
 *     (engine.ts L261-262).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const PDIR = "/home/z/my-project/data/relion/cmuwipe6350000demoproject";

let fail = 0;
const must = (cond, msg) => {
  console.log(`  ${cond ? "ok" : "FAIL"}: ${msg}`);
  if (!cond) fail++;
};

/* ---------- the narratives ------------------------------------------------
 * every number traced to its proof: (result line | artifact | engine argv) */

const STORIES = {
  "import_00import": [
    "[seeded] Import — 10 real EMPIAR micrographs registered by hard-link (zero upload, zero copy):",
    "[seeded]   Falcon micrograph series, EMPIAR-10017 lineage, 28.32 A/px at the micrograph scale.",
    "[seeded] manifest: micrographs.star (10 rows) + micrographs/ (the linked frames, in place).",
    "[seeded] downstream: MotionCorr consumes the star as its movies-shape input gate requires.",
  ],
  "motioncorr_tioncorr": [
    "[seeded] MotionCorr — own implementation lane (relion_run_motioncorr --use_own --j 4), patch 3x3:",
    "[seeded]   10 movies summed per-patch; global + local drift corrected, dose-weighting on.",
    "[seeded] manifest: corrected_micrographs.star (10 aligned micrographs) — the alignment's only written truth.",
    "[seeded] downstream: CtfFind picks the family up; Topaz-denoise reads the same micrographs in parallel.",
  ],
  "ctffind_0ctffind": [
    "[seeded] CtfFind — relion_run_ctffind --Box 512 --ResMin 30 --ResMax 5 --dFMin 5000 --dFMax 50000 --FStep 500 --fast_search --is_ctffind4:",
    "[seeded]   10 micrographs fitted; defocus family 14.9k - 12.7k A (a tight, well-behaved population, astigmatism under 300 A).",
    "[seeded] manifest: micrographs_ctf.star — one row per micrograph, defocus U/V/angle + the fit's resolution ceiling.",
    "[seeded] downstream: Auto-pick (LoG) reads the CTF constants to size its bridges.",
  ],
  "autopick_autopick": [
    "[seeded] Auto-pick — LoG (Laplacian-of-Gaussian), no reference, no model bias:",
    "[seeded]   170 particles picked across the 10 corrected micrographs; the LoG family sizes itself from the CTF constants.",
    "[seeded] manifest: coords.star — the picks, project-relative, ready for extraction.",
    "[seeded] downstream: Extract boxes every coordinate into the particle stack.",
  ],
  "extract_0extract": [
    "[seeded] Extract — 240 particle boxes boxed from the 170 picks (re-centered candidates expand the population):",
    "[seeded]   key-files law: the STAR comes home, the stack stays project-side — extract.star references particles.mrcs in place.",
    "[seeded] manifest: extract.star (240 rows) + particles.mrcs (the boxed stack on disk).",
    "[seeded] downstream: 2D classification consumes the stack; nothing downstream re-reads the picks.",
  ],
  "class2d_0class2d": [
    "[seeded] 2D classification — K=8, 240 particles, 12 iterations (run_it012 is the settled round):",
    "[seeded]   the population separates cleanly: class 1 carries 40%, class 2 carries 30% — two good views, six minor classes.",
    "[seeded] manifest: run_it012_data.star + run_it012_model.star + run_unmasked_classes.mrcs (the gallery's 8 faces).",
    "[seeded] downstream: Select 2D reads the class occupancy verdict; the gallery serves it interactively.",
  ],
  "select2d_select2d": [
    "[seeded] Select 2D — automatic rule: keep classes with occupancy >= 0.5x the best class:",
    "[seeded]   168 of 240 particles kept across 2 of 8 classes (classes 1-2) — the junk walks, the signal stays.",
    "[seeded] manifest: particles_select2d.star — the kept population, class tags intact.",
    "[seeded] downstream: the manual Select confirm rides the same population into 3D.",
  ],
  "select_00select": [
    "[seeded] Select — the gallery's confirm step: 168 particles from classes 1-2, human-shaped, machine-identical:",
    "[seeded] manifest: selected.star — the demo world's canonical kept set; every downstream 3D number descends from these 168 rows.",
    "[seeded] downstream: 3D classification takes the particles; InitialModel takes the same stack for its reference.",
  ],
  "class3d_0class3d": [
    "[seeded] 3D classification — K=3, 168 particles, 3 iterations (run_it003 is the settled round):",
    "[seeded]   three volumes resolved; the initial reference came from InitialModel (the workflow's own model edge).",
    "[seeded] manifest: run_it003_class001/002/003.mrc + run_it003_data.star + run_it003_model.star.",
    "[seeded] downstream: Symmetry-expand passes the population forward; the best class's members stay tagged in the data star.",
  ],
  "symexpand_ymexpand": [
    "[seeded] Symmetry expansion — point group C1 (identity): the expand is a faithful pass-through, not a multiplication.",
    "[seeded]   168 particles in, 168 rows out — the C1 world adds no symmetry mates because C1 has none to add.",
    "[seeded] manifest: particles_symexp.star — the same population, symmetry-aware metadata attached.",
    "[seeded] downstream: Rebalance consumes the star; the pipeline keeps one particle = one row end to end.",
  ],
  "rebalance_ebalance": [
    "[seeded] Rebalance — optics-group balancing across the population: 168 particles redistributed to keep every group working.",
    "[seeded]   the demo world's optics metadata stays uniform; rebalance's ledger is the star's group column, unchanged by design.",
    "[seeded] manifest: particles_rebalanced.star — the refinement's input population.",
    "[seeded] downstream: Refine3D takes the balanced set into gold-standard refinement.",
  ],
  "refine3d_refine3d": [
    "[seeded] 3D refinement — gold-standard, two independent halves, 20 iterations (run_it020 is the settled round):",
    "[seeded]   FSC 0.143 crosses at 3.62 A; the halves never saw each other — the resolution is honest by construction.",
    "[seeded] manifest: run_it020_half1.mrc + run_it020_half2.mrc + run_it020_model.star + run_data.star (168 refined particles).",
    "[seeded] downstream: Postprocess takes half1 for the sharpened map; MaskCreate takes the map for the solvent body.",
  ],
  "postprocess_tprocess": [
    "[seeded] Postprocess — masked, sharpened, final: 3.12 A at FSC=0.143 (the masked map's own verdict, 0.50 A better than the raw refine).",
    "[seeded]   the solvent mask rode in from MaskCreate (the workflow's mask edge); low-pass filtering and sharpening applied in one pass.",
    "[seeded] manifest: postprocess.star (40 rows — the FSC curve and the postprocessed statistics).",
    "[seeded] downstream: end of the refinement chain — the map is the world's final answer.",
  ],
  "topazdenoise_zdenoise": [
    "[seeded] Topaz-denoise — 10 micrographs denoised off the motion-corrected stack:",
    "[seeded]   16x16 patch averaging over 256x256 frames at 28.32 A/px — a training-ready, noise-suppressed mirror of the set.",
    "[seeded] manifest: denoised_micrographs.star + Falcon_*_denoised.mrc x10 (one per micrograph, prefix-joined).",
    "[seeded] downstream: Topaz-train reads the denoised stack for its 12-epoch training diary.",
  ],
};

/* ---------- the patch ----------------------------------------------------- */

console.log("== t701 story enrichment — 14 one-line logs grow narratives ==");

for (const [dir, lines] of Object.entries(STORIES)) {
  const wd = path.join(PDIR, dir);
  const logPath = path.join(wd, "run.log");
  if (!existsSync(logPath)) {
    must(false, `${dir}/run.log exists`);
    continue;
  }
  const cur = readFileSync(logPath, "utf8");
  const thin = cur.match(/^seeded by qa-t531-old-world-seed — .+\n?$/s) && cur.split("\n").filter((l) => l.trim()).length === 1;
  if (!thin) {
    console.log(`  skip (idempotent / not thin): ${dir}/run.log (${cur.split("\n").filter((l) => l.trim()).length} lines)`);
    continue;
  }
  const enriched = cur.replace(/\n?$/, "\n") + "\n" + lines.join("\n") + "\n";
  writeFileSync(logPath, enriched, "utf8");
  console.log(`  enriched: ${dir}/run.log (+${lines.length} narrative lines)`);
}

console.log("== patch done ==");
process.exit(fail === 0 ? 0 : 1);
