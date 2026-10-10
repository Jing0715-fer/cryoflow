/**
 * CryoFlow — AI job-type alias resolver (SERVER ONLY).
 *
 * t463 — the field failure this module exists for: a real model asked to
 * 「搭一个完整的 SPA 流程：导入 → 运动 → CTF → 挑选 → 2D 分类」 answered
 * with create_job(ctffind) alone, and weaker models invent type keys the
 * schema never had ("ctf", "pick", "2dclass", "motion"). The system prompt
 * carries the catalog, but a prompt is a suggestion — the tool surface was
 * the only place where the miss could be caught and RECOVERED instead of
 * refused.
 *
 * Resolution ladder (deterministic, bench-covered):
 *   1. exact key            "ctffind"                  → ctffind
 *   2. normalized exact     "CTF Find", "ctf_find"     → ctffind
 *   3. alias table          "ctf", "2d分类", "motion"   → ctffind / class2d / motioncorr
 *   4. fuzzy containment    "ctfestimation"            → ctffind
 *
 * Every non-exact hit is REPORTED (the tool summary says it interpreted
 * "ctf" as ctffind) — the canvas never silently disagrees with the log.
 *
 * The alias vocabulary is deliberately BILINGUAL: this assistant's main
 * audience writes Chinese, and RELION's own vocabulary is English. Both
 * arrive at the same twelve canonical SPA verbs.
 */

import { JOB_TYPES, jobType } from "@/lib/workflow";

/* ------------------------------------------------------------------ */
/* Normalization                                                        */
/* ------------------------------------------------------------------ */

/** Lowercase, strip every separator an LLM might spray into a type key. */
export function normalizeTypeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.·•/()（）]/g, "")
    .replace(/任务/g, "")
    .replace(/job/g, "");
}

/* ------------------------------------------------------------------ */
/* Alias table                                                           */
/* ------------------------------------------------------------------ */

/**
 * Canonical key ← the names humans and models actually say. Ordered by the
 * SPA pipeline; per-alias arrays keep the table flat and bench-readable.
 * The list is EXHAUSTIVE over the SPA canon + the verbs users ask for —
 * a missing alias falls to fuzzy matching, never to silence.
 */
const ALIASES: Record<string, string[]> = {
  import: ["导入", "导入数据", "导入电影", "导入显微图", "导入微图", "importmovies", "importmicrographs", "importdata", "ingest", "upload"],
  motioncorr: ["运动", "运动校正", "运动纠正", "漂移校正", "motion", "motioncorrection", "motioncorrect", "driftcorrection", "mc2", "mc", "alignframes"],
  ctffind: ["ctf", "ctf估算", "ctf估计", "ctf校正", "ctfestimation", "ctf估计任务", "gctf", "ctffind4", "ctfassessment", "defocus"],
  manualpick: ["挑选", "挑选颗粒", "手动挑选", "手选", "选颗粒", "pick", "picking", "particlepick", "manualpicking", "particleselection", "boxer", "boxing"],
  autopick: ["自动挑选", "自动选颗粒", "自动拾取", "autopicking", "lure", "crYOLO".toLowerCase()],
  topazdenoise: ["去噪", "降噪", "topazdenoising", "denoise", "denoising"],
  extract: ["提取", "抽取", "extraction", "boxextraction", "extractparticles"],
  select: ["选择", "筛选", "subset", "selectparticles", "particlesubset"],
  class2d: ["2d分类", "二维分类", "2d类别", "2dclass", "2dclassification", "class2dclassification", "classification2d", "2d平均", "2daveraging"],
  select2d: ["类选择", "选择类", "选类", "2d类选择", "selectclasses", "classselection"],
  initialmodel: ["初始模型", "3d初始模型", "initialmodelgeneration", "3dinitialmodel", "situs", "abinitio"],
  class3d: ["3d分类", "三维分类", "3dclass", "3dclassification", "classification3d"],
  refine3d: ["3d精修", "精修", "三维精修", "细化", "refine", "refinement", "refine3dclassification", "3drefinement", "autorefine"],
  maskcreate: ["蒙版", "掩膜", "mask", "maskcreation", "createmask", "maskmaker"],
  postprocess: ["后处理", "后处理锐化", "锐化", "postprocessing", "postprocesssharpening", "sharpen", "sharpening"],
  localres: ["局部分辨率", "localresolution", "localres"],
  polish: ["抛光", "粒子抛光", "particlepolish", "polishing", "bayesianpolish", "米粒抛光"],
  ctfrefine: ["ctf精修", "ctf优化", "ctfrefinement", "ctfoptimization", "高阶像差", "aberration"],
  multibody: ["多体", "多体精修", "多体分类", "多体细化", "multibodyrefinement", "multibodyrefine", "multibodyclassification"],
  symexpand: ["对称扩展", "对称展开", "symmetryexpansion", "symexpandparticles"],
  rebalance: ["重平衡", "取向重平衡", "orientationalrebalance", "rebalancing"],
};

/* ------------------------------------------------------------------ */
/* Resolution                                                            */
/* ------------------------------------------------------------------ */

export interface ResolvedTypeKey {
  /** The canonical JOB_TYPES key, or null when nothing matched. */
  key: string | null;
  /** How the match happened — "exact" answers are the boring good case. */
  via: "exact" | "normalized" | "alias" | "fuzzy" | null;
  /** The original input (echoed for honest reporting). */
  raw: string;
}

/**
 * Resolve a model-supplied (or user-supplied) type token to a canonical
 * job type key. Pure and total: garbage answers {key:null, via:null}.
 */
export function resolveJobTypeKey(raw: string): ResolvedTypeKey {
  const input = typeof raw === "string" ? raw : "";
  if (!input) return { key: null, via: null, raw: input };

  // 1. exact
  if (jobType(input.trim())) return { key: input.trim(), via: "exact", raw: input };

  const norm = normalizeTypeToken(input);
  if (!norm) return { key: null, via: null, raw: input };

  // 2. normalized exact (case / separator variants of the real keys)
  const normalizedKeys = new Map(JOB_TYPES.map((t) => [normalizeTypeToken(t.key), t.key]));
  const direct = normalizedKeys.get(norm);
  if (direct) return { key: direct, via: "normalized", raw: input };

  // 3. alias table (aliases are stored pre-normalized by construction)
  for (const [key, list] of Object.entries(ALIASES)) {
    for (const alias of list) {
      if (normalizeTypeToken(alias) === norm) return { key, via: "alias", raw: input };
    }
  }

  // 4. fuzzy containment — the token CONTAINS a key or vice versa, with a
  //    minimum length floor so "ctf" can never force-match a 2-letter key
  //    and noise like "x" can never match "extract".
  if (norm.length >= 3) {
    for (const [nkey, key] of normalizedKeys) {
      if (nkey.length >= 3 && (norm.includes(nkey) || nkey.includes(norm))) {
        return { key, via: "fuzzy", raw: input };
      }
    }
    // alias containment last (e.g. "2dclassificationjob" contains "2dclassification")
    for (const [key, list] of Object.entries(ALIASES)) {
      for (const alias of list) {
        const nalias = normalizeTypeToken(alias);
        if (nalias.length >= 4 && (norm.includes(nalias) || nalias.includes(norm))) {
          return { key, via: "fuzzy", raw: input };
        }
      }
    }
  }

  return { key: null, via: null, raw: input };
}

/**
 * The honest narration suffix for a non-exact resolution — empty string
 * for exact/normalized matches (the canvas shows the key the caller named).
 */
export function typeResolutionNote(res: ResolvedTypeKey): string {
  if (!res.key || res.via === "exact" || res.via === "normalized") return "";
  return ` (interpreted "${res.raw}" as ${res.key})`;
}
