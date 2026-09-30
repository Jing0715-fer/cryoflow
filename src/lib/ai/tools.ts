/**
 * CryoFlow — AI assistant tool surface (SERVER ONLY).
 *
 * t419 — the agent's hands. Every tool is the SAME server logic the UI's
 * own doors run (POST /api/jobs' scalar param filter, POST /api/edges'
 * port/cycle validation, startJob's dispatch, the classes route's
 * occupancy) — the assistant never gets a private mutation path the
 * product doesn't already trust.
 *
 * Design laws:
 *  - SCALAR PARAM FILTER: unknown keys drop silently on create/update —
 *    the same security posture the POST route earned (the `interpreter`
 *    leak lesson); the tool result SAYS what was dropped.
 *  - CONFIRM GATES: delete_job refuses completed/running jobs without
 *    confirm:true; run_job's summary names the wipe semantics of a re-run.
 *  - HONEST RESULTS: every tool answers {ok, summary, detail} — the agent
 *    narrates from summaries, never from imagination.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  CARD_W,
  JOB_TYPES,
  coerceParam,
  defaultParams,
  defaultPorts,
  jobType,
  nextStepsFor,
} from "@/lib/workflow";
import { findEffectiveJob } from "@/lib/link";
import { allAdjacency, portsValid } from "@/lib/edge-ports";
import { findCycle } from "@/lib/graph-cycle";
import { ensureDefaultWorkspace, toJobDTO } from "@/lib/seed";
import { fmtBytes } from "@/lib/relion/disk-usage";
import { computeStorageReport, type StorageResponse } from "@/lib/relion/storage-report";
import { fmtDuration } from "@/lib/duration";
import { walkTimeline, timelineLedger, timelineSharePct } from "@/lib/timeline-walk";
import { getActiveProject, projectRemoteTarget } from "@/lib/projects";
import {
  graveRowsOf,
  readJobTombstone,
} from "@/lib/job-tombstone";
import { restoreJobRows, type RestoreJobInput } from "@/lib/job-restore";
import { getConnection, loadConnections } from "@/lib/remote/connections";
import { startJob } from "@/lib/relion/dispatch";
import { getRun, latestIterationDataStar, stopRun } from "@/lib/relion/engine";
import {
  connectionRunResume,
  remoteInfoFor,
  remoteStopRun,
} from "@/lib/remote/remote-run";
import {
  CONTINUE_FAMILY_TYPES,
  continueSourcesFor,
} from "@/lib/relion/continue-sources";
import {
  checkpointOf,
  continueLaneOf,
  continuePlanOf,
  continueParamWrites,
  iterKnobOf,
  moreOptionsFor,
  selfScanErrorOf,
} from "@/lib/convergence-continue";
import { fetchRemoteFileIntoWorkdir } from "@/lib/remote/remote-files";
import { renderClassSheetPng } from "@/lib/mrc";
import { parseStar } from "@/lib/starfile";
import { RELION_DIR } from "@/lib/paths";
import { resolveAssistant } from "./settings";
import { visionOnce } from "./wire";
import type { ToolSchema } from "./wire";
import { resolveJobTypeKey, typeResolutionNote } from "./type-aliases";
import {
  funnelDoorCandidate,
  funnelLedgerOf,
  funnelLedgerText,
} from "@/lib/particle-funnel";
import {
  joinByName,
  pairedDeltas,
  verdict as pairedVerdict,
  topMovers,
  fmtDelta,
  pairVerdictText,
  DEFAULT_WORDS,
  type LensSpec,
  type VerdictWords,
} from "@/lib/paired-compare";
import { CTF_LENSES, defocusAgreement } from "@/lib/ctf-compare";
import { MOTION_LENSES } from "@/lib/motion-compare";
import {
  CLASS_LENSES,
  CLASS_DEFAULT_LENS,
  CLASS_WORDS,
  classRunRow,
  concentrationCensus,
} from "@/lib/class-compare";
import { ctfMicrographRows, motionCatalogueRows } from "@/lib/compare-rows";
import {
  arcPresentationOf,
  arcSummary as arcSummaryOf,
  arcVerdict as arcVerdictOf,
  biggestJump,
  resolutionArcOf,
} from "@/lib/resolution-arc";
import {
  defaultRoundPair,
  movingCensus,
  roundLabel,
} from "@/lib/convergence";
import {
  resolutionArcFromWorkdir,
  roundOccupancy,
  workdirRounds,
} from "@/lib/convergence-rows";
import {
  loadFsc,
  loadGuinier,
  loadAngDist,
  loadCtf,
  loadMotion,
  loadTopazTraining,
  ChartJobNotFound,
} from "@/lib/chart-data";
import { fmtAngstrom, fmtMicron, reportedPassport } from "@/lib/chart-rows";
// t501 — the agent reads the landscape: the inventory's OWN arithmetic
// (peak/agreement/weakest/delta), the walk's OWN constants, the listing's
// OWN well — imports all, no second derivation anywhere.
import {
  contestedCrown,
  curveVerdictOf,
  CURVE_KIND_LABELS,
  deltaVsWinner,
  localAgreement,
  outlierRowIdx,
  peakPctNumOf,
  peakPctOf,
  shapeAgreement,
  weakestBand,
  weakestCellOf,
  buildSweepReport,
  type SessionSweepState,
} from "@/lib/qc-report";
import { MAP_BRIEF_CAP, MAIN_MAP_RE, VOLUME_CAPABLE_RE } from "@/lib/map-walk";
import { probesForType } from "@/lib/curve-walk"; // t503 — the verdicts walk drinks the same probe map
import { walkWorkdir } from "@/lib/relion/outputs-list";
import { isMrcPath, poolProfile, readMrcAxisProfiles, readMrcHeader } from "@/lib/mrc";
import { resolveInsideJobWorkdir } from "@/lib/relion/jobfile";
import { readPathrefTarget } from "@/lib/relion/pathref";
import { cachedCompute } from "@/lib/relion/statcache";

export interface AiToolResult {
  ok: boolean;
  summary: string;
  detail?: unknown;
}

export interface AgentCtx {
  /** The active project id (resolved once per iteration). */
  projectId: string;
  /** t508 — the client's last sweep race (session memory; null when no
   *  race ran this session). The sweep tool quotes it verbatim. */
  sweep?: SessionSweepState | null;
}

/* ------------------------------------------------------------------ */
/* Tool catalog                                                         */
/* ------------------------------------------------------------------ */

export const AI_TOOLS: ToolSchema[] = [
  {
    name: "list_job_types",
    description:
      "List every job type this app can create: key, label, description, category, input/output ports, and each type's legal NEXT steps (the RELION pipeline canon). Call this before building a chain you are unsure about.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_job_params",
    description:
      "Full parameter schema of ONE job type: key, label, type, default, options (for selects), tab, and whether advanced. Call before setting non-trivial params — keys must match the schema exactly.",
    parameters: {
      type: "object",
      properties: { job_type: { type: "string", description: "Job type key, e.g. class2d" } },
      required: ["job_type"],
      additionalProperties: false,
    },
  },
  {
    name: "get_workflow_state",
    description:
      "The active project's canvas: project info (name, mode, cluster binding), workspaces, every job (id, type, name, status, progress, position, result line) and every wire (from → to with ports). ALWAYS call this first when the user refers to existing jobs.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_clusters",
    description:
      "Read the SSH cluster registry — the Remote clusters dialog's own roll call: each saved connection's name, host, auth shape (booleans only, never secrets), remote root, Slurm flag, default RELION module, its LAST probe's truth (reachable / probe-failed with the error line / never-tested — each probe block carries checkedAt; quote the timestamp when health matters, clusters are probed when tested or dispatched, never by this read), whether the ACTIVE project is bound to it, and its dispatch résumé (total/completed/failed runs the ledger remembers, with the 3 newest — what has this cluster done for me). Pass fullHistory:true to open the WHOLE ledger instead of the 3-newest reading line (up to 50 entries, newest first) — the tool for 'show me everything this cluster has run / 这台集群的完整历史'. Also answers 'which cluster would run_job mode:'cluster' dispatch to?' via the project binding.",
    parameters: {
      type: "object",
      properties: {
        fullHistory: {
          type: "boolean",
          description:
            "Open the complete dispatch ledger instead of the 3-newest reading line — up to 50 entries, newest first. Omit for the default résumé.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "list_deleted",
    description:
      "Read the graveyard — every deleted job's tombstone, newest first: its id, type and name (when the grave remembers them), when it was deleted, what its run record says (done/exit code/result line — each row also carries runLine, the run's own one-line verdict: finished clean / failed / was stopped), what its surviving workdir still weighs on disk (bytes — a deleted job keeps its run directory until the grave is cleared, so the deleted still occupy space), and whether it can be restored from here (a grave with a row snapshot restores under its ORIGINAL id — workdir, run record and wires re-attach; a grave without one restores only from the canvas's undo). The mirror read for delete_job.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "restore_deleted",
    description:
      "Bring a deleted job back to the canvas from its graveyard tombstone, under its ORIGINAL id — its workdir, run record and wires re-attach as if the delete never happened (a re-run would have wiped them). Pass the job_id of a grave from list_deleted. Only graves WITH a row snapshot can be restored from here; a restored 'running' job comes back idle (its process was stopped at delete time).",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The deleted job's id — a grave named by list_deleted.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_funnel_chain",
    description:
      "Read the particle funnel LEDGER of a chain — the same cross-job story the UI's funnel dialog and its Copy-ledger button export: per-station counts (micrographs/picks/particles, class counts), the edge verbs BETWEEN stations (carry / shed with percentages / gain with factors / transform), the off-mainline census, and the closing postprocess resolution when one ends the chain. THE tool for '我的粒子都去哪了 / why did my particle count drop / summarize what this chain produced' — read the ledger before answering any count question, never arithmetic from per-job receipts. Omit job_id to read the crown chain (the deepest finished funnel verb on the canvas); pass job_id to read the chain around a specific verb (unfinished stations honestly report their status instead of counts).",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "Optional — a verb on the chain to read (any status). Omit for the crown chain.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "compare_jobs",
    description:
      "Paired A/B verdict between two completed runs of the SAME stage — the compare dialog's own brain, read by the agent: CTF fit quality (ctffind), Motion drift (motioncorr) or 2D/3D class occupancy (class2d/class3d). The domain is detected from the two jobs' type; the lens defaults per domain (fom / total drift / occupancy share) or pass lens explicitly. Returns the verdict counts in the domain's OWN words (improved/regressed/unchanged for quality; gained/lost/held for occupancy — a class that gained particles did not 'improve', the population moved), the median delta, the named top movers, the unpaired non-voters and the pairing's health line. THE tool for '哪次跑更好 / did my new params help / 比较 / which run is better' — a compare question is a READ, never arithmetic from two receipts.",
    parameters: {
      type: "object",
      properties: {
        job_a: {
          type: "string",
          description: "The A run's job id (get_workflow_state lists ids).",
        },
        job_b: {
          type: "string",
          description: "The B run's job id — the SAME stage as A.",
        },
        lens: {
          type: "string",
          description: "Optional lens key: ctf fom|maxres|astig · motion total|early|late · class share. Defaults per domain (fom / total / share).",
        },
      },
      required: ["job_a", "job_b"],
      additionalProperties: false,
    },
  },
  {
    name: "check_convergence",
    description:
      "One run compared with ITSELF across its own iterations — the convergence family's reading, read by the agent (the class-convergence dialog's census + the resolution-arc dialog's plateau verdict, t454/t456/t459): did the classification settle (which classes still move particles between two rounds), and is the estimate still sharpening (per-round resolution arc — gold FSC for refine3d, the model's own estimate for class2d/class3d). The default pair is the run's WHOLE arc (earliest vs latest round); pass round_a/round_b to ask any two. Returns the census in the domain's own words (gained/lost/held + 'settled / mostly settled / still re-shuffling') and the arc's verdict ('plateaued / still improving / still moving'). THE tool for '收敛了吗 / did it converge / has it settled / is it still improving / plateau' — a convergence question is a READ of the run's own rounds, never arithmetic from two receipts. For comparing two DIFFERENT runs use compare_jobs instead.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The run's job id (get_workflow_state lists ids).",
        },
        round_a: {
          type: "number",
          description: "Optional earlier round (iteration number). Default: the run's first round.",
        },
        round_b: {
          type: "number",
          description: "Optional later round (iteration number). Default: the run's last round.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_job",
    description:
      "Create one job on the canvas. Pass connect_from (an upstream job id) to draw the wire automatically (ports auto-picked, cycle-safe). params may carry schema keys only (unknown keys drop). Position is auto-computed right of the source / right of the canvas content.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", description: "Job type key (from list_job_types; Chinese stage names like 运动/CTF/挑选 resolve to canonical keys), e.g. motioncorr" },
        name: { type: "string", description: "Optional custom name (≤120 chars)" },
        connect_from: { type: "string", description: "Upstream job id to wire from (draws the edge)" },
        params: {
          type: "object",
          description: "Param overrides keyed by the type's schema (get_job_params)",
          additionalProperties: true,
        },
        x: { type: "number", description: "Optional explicit canvas x" },
        y: { type: "number", description: "Optional explicit canvas y" },
      },
      required: ["type"],
      additionalProperties: false,
    },
  },
  {
    name: "update_job",
    description:
      "Update a job's params (merged with current values; schema keys only), name, or note.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        params: { type: "object", additionalProperties: true },
        name: { type: "string" },
        note: { type: "string", description: "Free-text annotation (≤500 chars)" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "connect_jobs",
    description:
      "Wire job A's output to job B's input (ports auto-picked when omitted). Refuses port mismatches, cycles, cross-project pairs and duplicates.",
    parameters: {
      type: "object",
      properties: {
        from_job_id: { type: "string" },
        to_job_id: { type: "string" },
        from_port: { type: "string" },
        to_port: { type: "string" },
      },
      required: ["from_job_id", "to_job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "build_pipeline",
    description:
      "Create a whole CHAIN of jobs in ONE call: steps are created in order and wired head-to-tail (ports auto-picked, cycle-safe). Prefer this over repeated create_job when the user asks for a multi-job flow ('搭一个完整流程'). All types are validated BEFORE anything is created; a refused wire (no compatible port pair) is reported per step and the chain keeps building.",
    parameters: {
      type: "object",
      properties: {
        steps: {
          type: "array",
          maxItems: 12,
          description: "Ordered chain steps, e.g. [motioncorr, ctffind, manualpick, extract, class2d]. Chinese stage names (导入/运动/CTF/挑选/2D分类…) resolve to their canonical keys.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", description: "Job type key (from list_job_types)" },
              name: { type: "string", description: "Optional custom name (≤120 chars)" },
              params: {
                type: "object",
                additionalProperties: true,
                description: "Param overrides keyed by the type's schema (get_job_params)",
              },
            },
            required: ["type"],
          },
        },
        connect_from: { type: "string", description: "Optional upstream job id to wire the FIRST step from" },
      },
      required: ["steps"],
      additionalProperties: false,
    },
  },
  {
    name: "wait_for_jobs",
    description:
      "Wait for jobs to SETTLE (leave running/pending) up to a timeout, then report each job's status, progress and result line. Call after run_job to catch quick completions and immediate failures within the same conversation turn. Jobs still running at the timeout are reported honestly with progress — never claim a job finished while it runs; check later with inspect_job.",
    parameters: {
      type: "object",
      properties: {
        job_ids: { type: "array", items: { type: "string" }, maxItems: 10 },
        timeout_sec: { type: "number", description: "Max seconds to wait (default 45, max 180)" },
      },
      required: ["job_ids"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_job",
    description:
      "Remove a job (and its wires) from the canvas. REFUSES completed or running jobs unless confirm:true — ask the user first, then confirm.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        confirm: { type: "boolean", description: "true = the user confirmed destroying this job's results" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "run_job",
    description:
      "Start a job's REAL run. mode: 'local' forces the local RELION lane; 'cluster' uses the project's bound SSH cluster; omitted picks the project's default. Re-running a completed job WIPES its previous results — only run what the user asked for; to extend a finished refine-family run use continue_run instead (it resumes from the checkpoint instead of wiping). Downstream pending jobs auto-start when their upstream completes.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        mode: { type: "string", enum: ["local", "cluster"] },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "continue_run",
    description:
      "Continue a finished refine-family run (class2d/class3d/refine3d/initialmodel/multibody) with MORE iterations — RELION's own restart idiom: the run resumes from its NEWEST COMPLETE checkpoint (run_itNNN_optimiser.star) and the --iter total extends to current + more, clamped to the form's ceiling. This is NOT run_job: a re-run WIPES the previous results, a continue RESUMES from them — when check_convergence says 'still improving' and the user asks for more rounds ('还要继续跑', 'continue with more iterations'), this is the verb. The lane is the job's OWN lane (a cluster checkpoint continues on the cluster that wrote it). Refuses honestly when the run directory holds no complete optimiser family, the dialect has no --iter knob (RELION's auto-refine owns its own convergence), or the type is outside the refine family.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The finished run's job id (check_convergence's subject).",
        },
        more: {
          type: "number",
          description:
            "Optional — how many MORE iterations (default: the convergence dialog's first chip — 5 EM epochs or 50 VDAM mini-batches). RELION's --iter is the TOTAL: the written value is current + more.",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "stop_job",
    description: "Stop a running job (SIGTERM/SIGKILL locally, scancel on the cluster). Checkpoints stay for refine-family re-runs.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "inspect_job",
    description:
      "One job in depth: status, result line, key non-default params, run record (lane, cluster, phase), last log lines, and — for classifications — the class occupancy table. Use before judging or troubleshooting.",
    parameters: {
      type: "object",
      properties: { job_id: { type: "string" } },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "judge_2d_classes",
    description:
      "THE VISION TOOL for 2D classification results: renders the class-average sheet (one grid image, all classes), reads per-class occupancy AND per-class estimated resolution from the model star, sends them with the image to a vision model, and returns a per-class keep/maybe/reject verdict with reasons plus overall advice. Call whenever the user asks which 2D classes are good.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "A class2d job (completed or with results)" },
        question: { type: "string", description: "Optional focus, e.g. '只挑大于5000粒子的类'" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "select_classes",
    description:
      "Act on a judged classification: create a selection job wired to the chosen classes (default select2d 'Particle Selection'; class3d/refine3d/initialmodel also accept class selections). classes are 1-based class numbers.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "The class2d (or class3d) job to select from" },
        classes: { type: "array", items: { type: "number" }, description: "1-based class numbers to keep" },
        target_type: {
          type: "string",
          enum: ["select2d", "initialmodel", "class3d", "refine3d"],
          description: "The downstream job type to create (default select2d)",
        },
      },
      required: ["job_id", "classes"],
      additionalProperties: false,
    },
  },
  {
    name: "get_job_curves",
    description:
      "Read a job's RESULT CURVES — the science behind the results charts. kinds picks which: fsc (gold-standard resolution: FSC 0.143/0.5 crossings, RELION's reported final resolution, B-factor/pixel size when postprocessed), guinier (the amplitude falloff that validates the applied B-factor), angdist (orientation coverage: direction bins, concentration factor, symmetry), ctf (per-micrograph CTF fit quality of a CtfFind job: mean defocus, worst astigmatism, mean figure-of-merit, worst fit resolution), motion (per-micrograph accumulated drift of a MotionCorr job: mean/worst total drift, the early/late split that tells settling-late from drifting-to-the-end), topaz (per-epoch picker training curve: train/test loss, precision/recall — is the picker good enough to pick). Returns compact summaries with sampled points, not raw tables. Use when the ask is how GOOD or how RESOLVED a map or 3D run is, whether orientations are even, whether the CTF fits are clean, whether movies drift too much, or whether a trained picker is ready ('到多少埃', 'how resolved is it', 'is the map trustworthy', '取向均匀吗', 'CTF 拟合怎么样', '漂移大吗', 'motion big?', 'topaz 训练好了吗') — inspect_job reads status, params and logs but never the curves; check_convergence reads iteration-to-iteration stability, this reads the curve itself.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["fsc", "guinier", "angdist", "ctf", "motion", "topaz"],
          },
          maxItems: 6,
          description: "Which curves to read (default: all six)",
        },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
  },
  {
    name: "get_map_landscape",
    description:
      "The session's MAP LANDSCAPE in one read — the Session QC report's Map QC inventory, read by the agent: every completed job whose workdir holds a true 3D volume (newest first, the same walk the paper obeys), each owner's main map, that map's density-landscape PEAK (where the mass concentrates along depth, as % of depth), the Δ against the winner (the newest owner — the row the deep report rides), the SHAPE AGREEMENT r with the winner (Pearson on the shared 0–100% fraction scale, both resampled to the finer grid; the winner's own row lands at 1.00 through the same arithmetic, no special case) and the WEAKEST quarter band (where the shape parts ways, Q1–Q4 with the band's own r). Candidates with no readable volume, no on-disk workdir or a refused profile are honestly skipped, never guessed; the roster cap is the paper's own (24). THE tool for 'which job produced the best map / 哪张 map 最好 / which classification won / is the session's map geography sane / 全景如何' — a landscape question is a WALK over the whole roster: get_job_curves reads ONE job's curves, compare_jobs reads two runs of the same stage, this reads the session's geography.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_curve_verdicts",
    description:
      "The session's CURVE VERDICTS in one read — the Session QC report's Curve verdicts table, read by the agent: walk the completed roster (newest first, the paper's own order and cap) and for every completed job probe the chart kinds its type predicts (a PostProcess speaks FSC + Guinier, a 3D run speaks FSC + angular distribution, CtfFind speaks CTF fit, MotionCorr speaks drift, a picker job speaks training epochs), then word each answer through the paper's OWN verdict builder — so every row is the table's wording byte for byte, never a paraphrase. Probes whose workdir holds no such curve are honestly skipped (counted, never guessed); a probe whose data refused marks the walk wounded and the walk goes on (partial truth over silence). Zero knobs: the walk is the paper's walk, not a filtered one. THE tool for '这个会话的曲线判读如何 / what did the session's curves say / summarize the curve verdicts / 哪些曲线还没量' — a session-wide verdict question is a WALK over the whole roster: get_job_curves reads ONE job's curves with full sampled data, this reads every curve's ONE-LINE verdict at once.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_session_timeline",
    description:
      "The session's TIME in one read — the analytics page's own Gantt as data: every run's HONEST window ([startedAt → startedAt+duration]; the engine stamps startedAt when a job flips to running and writes the measured elapsed into duration on completion — updatedAt is NOT a window, every poll touches it), a live run stretching to now, in the bars' own chronological order. Per run: id, name, type, status, workspace, started/ended ISO stamps, duration (ms + the inspector's own human words), share of the session span; plus the aggregates the bars keep: the session window (first start → last end), the LONGEST runs (top 3 — the read for '哪一步最耗时'), total busy time (windows summed — parallel runs double-count, the number says so), the still-running list and the never-started absentees (counted, never invented). Zero knobs. THE tool for '哪一步最耗时 / how long did this take / when did X run / what ran in parallel / show the timeline' — a time question is a READ over honest windows, never arithmetic from receipts.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_sweep_verdict",
    description:
      "The session's LAST HPC scheduling sweep in one read — the same profile-comparison verdict the Session QC report binds VERBATIM: per-profile makespan / utilization / queue wait / GPU-hours, the winner with its margin over the slowest contestant, failed profiles kept visible (a report that drops a contestant lies). THE tool for '哪个 HPC 配置赢了 / which profile should I submit with / how did the race go / compare the cluster profiles'. Session memory, not a database: a race lives in the client's session and a reload starts a new one — with no race on record the tool says so and points at the HPC queue panel's Compare profiles (it never invents a winner). Zero knobs: the verdict is the report's own words, word for word.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_storage_report",
    description:
      "The active project's DISK WEIGHT in one read — the Storage dialog's own ledger as data: every run directory physically walked under data/relion/<projectId>/ (per-dir bytes + files, the six-category split maps/stacks/tables/logs/plots/other), the heaviest jobs and heaviest files by bytes, the totals. THE tool for '这个项目占了多少磁盘 / what is eating my disk / which job is the heaviest / 磁盘还剩多少 / what can be cleaned up'. Physical truth, not DB belief: a directory whose job row is gone still counts (an orphan, said so) — the disk fills regardless of what the database thinks. Read-only LOCATOR: it names the whales and the categories, it never deletes or cleans anything — the Storage dialog's Clean doors stay the only writers. Zero knobs: the walk is the dialog's walk, not a filtered one.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
  },
];

/* ------------------------------------------------------------------ */
/* Pure helpers (bench-covered)                                        */
/* ------------------------------------------------------------------ */

/** The POST /api/jobs scalar filter, verbatim semantics (import keeps empiarData). */
export function filterParamsForSpec(
  type: string,
  incoming: unknown
): { filtered: Record<string, number | string | boolean>; dropped: string[] } {
  const spec = jobType(type);
  const out: Record<string, number | string | boolean> = {};
  const dropped: string[] = [];
  if (!spec) return { filtered: out, dropped };
  const allowed = new Set((spec.params ?? []).map((p) => p.key));
  if (type === "import") allowed.add("empiarData");
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return { filtered: out, dropped };
  }
  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (allowed.has(key) && (typeof value === "number" || typeof value === "string" || typeof value === "boolean")) {
      out[key] = value;
    } else if (allowed.has(key)) {
      dropped.push(`${key}(wrong type)`);
    } else {
      dropped.push(key);
    }
  }
  return { filtered: out, dropped };
}

/** Canvas position for a new job: right of its source, or right of everything. */
export function nextPositionFor(
  from: { x: number; y: number } | null,
  content: { x: number; y: number }[]
): { x: number; y: number } {
  if (from) {
    return {
      x: from.x + CARD_W + 100,
      y: from.y + Math.round(Math.random() * 40 - 20),
    };
  }
  if (content.length === 0) return { x: 140 + Math.round(Math.random() * 60), y: 200 + Math.round(Math.random() * 60) };
  const maxX = Math.max(...content.map((j) => j.x));
  const nearRight = content.filter((j) => j.x > maxX - 400);
  const avgY = nearRight.reduce((s, j) => s + j.y, 0) / Math.max(1, nearRight.length);
  return { x: maxX + CARD_W + 100, y: Math.round(avgY + (Math.random() * 80 - 40)) };
}

/** The class-averages stack dialect (mirror of the classes route's canon). */
const STACK_NAME_PATTERNS = [
  /^(?:run_it|_it)\d+_classes\.mrcs?$/i,
  /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$/i,
  /^run_unmasked_classes\.mrcs?$/i,
];

export function pickClassStackName(names: string[]): string | null {
  const stacks = names.filter((n) => STACK_NAME_PATTERNS.some((re) => re.test(n)));
  const unmasked = stacks.find((n) =>
    /^(?:run_it|_it)\d+_unmasked_classes\.mrcs?$|^run_unmasked_classes\.mrcs?$/i.test(n)
  );
  if (unmasked) return unmasked;
  let bestIter = -1;
  let best: string | null = null;
  for (const n of stacks) {
    const m = n.match(/(?:run_it|_it)(\d+)_classes/i);
    if (m && Number(m[1]) > bestIter) {
      bestIter = Number(m[1]);
      best = n;
    }
  }
  return best;
}

export interface ClassStat {
  cls: number;
  count: number;
  fraction: number;
  /** Å, from the model star's rlnEstimatedResolution (null when absent). */
  resolution: number | null;
}

/** Occupancy from the latest settled data star + resolution from the model star. */
export function classStatsFromWorkdir(workdir: string): {
  iteration: number | null;
  classes: ClassStat[];
  total: number;
  stackFile: string | null;
} {
  let names: string[] = [];
  try {
    names = readdirSync(workdir);
  } catch {
    return { iteration: null, classes: [], total: 0, stackFile: null };
  }
  const stackFile = pickClassStackName(names);
  const best = latestIterationDataStar(workdir);
  if (!best) return { iteration: null, classes: [], total: 0, stackFile };

  // occupancy — count _rlnClassNumber rows in the particles loop
  let counts = new Map<number, number>();
  let total = 0;
  try {
    const file = parseStar(readFileSync(path.join(workdir, best.file), "utf8"));
    let loop = null as { columns: string[]; rows: string[][] } | null;
    for (const b of file.blocks) {
      if (b.loop && b.loop.columns.includes("_rlnClassNumber")) {
        loop = b.loop;
        break;
      }
    }
    if (!loop) {
      for (const b of file.blocks) {
        if (b.loop && b.loop.columns.some((c) => c.startsWith("_rlnClassNumber"))) {
          loop = b.loop;
          break;
        }
      }
    }
    if (loop) {
      const col = loop.columns.findIndex((c) => c.startsWith("_rlnClassNumber"));
      for (const row of loop.rows) {
        const cls = parseInt(row[col] ?? "", 10);
        if (Number.isFinite(cls) && cls > 0) {
          counts.set(cls, (counts.get(cls) ?? 0) + 1);
          total++;
        }
      }
    }
  } catch {
    /* unreadable data star → occupancy stays empty */
  }

  // per-class resolution — the model star's classes loop
  const resolutions = new Map<number, number>();
  const modelCandidates = [
    best.file.replace(/_data\.star$/i, "_model.star"),
    best.file.replace(/_data\.star$/i, "_half1_model.star"),
  ];
  for (const cand of modelCandidates) {
    if (!names.includes(cand)) continue;
    try {
      const file = parseStar(readFileSync(path.join(workdir, cand), "utf8"), 5000);
      for (const b of file.blocks) {
        const loop = b.loop;
        if (!loop || !loop.columns.includes("_rlnEstimatedResolution")) continue;
        const resCol = loop.columns.findIndex((c) => c.startsWith("_rlnEstimatedResolution"));
        loop.rows.forEach((row, i) => {
          const res = parseFloat(row[resCol] ?? "");
          if (Number.isFinite(res)) resolutions.set(i + 1, res);
        });
        break;
      }
    } catch {
      /* unreadable model star → resolutions stay empty */
    }
    if (resolutions.size > 0) break;
  }

  const classes: ClassStat[] = [...counts.entries()]
    .map(([cls, count]) => ({
      cls,
      count,
      fraction: total > 0 ? count / total : 0,
      resolution: resolutions.get(cls) ?? null,
    }))
    .sort((a, b) => a.cls - b.cls);
  return { iteration: best.iteration, classes, total, stackFile };
}

/** Extract the JSON verdict from a VLM answer (fences, prose, or raw). */
export interface JudgeVerdict {
  classes: { cls: number; verdict: string; reason: string }[];
  advice: string;
}
export function parseJudgeVerdict(text: string): JudgeVerdict | null {
  if (!text) return null;
  const candidates: string[] = [];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenced.exec(text))) candidates.push(m[1]);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const cand of candidates) {
    try {
      const parsed = JSON.parse(cand.trim()) as {
        classes?: unknown;
        advice?: unknown;
      };
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.classes)) continue;
      const classes = parsed.classes
        .map((c) => {
          const r = c as { cls?: unknown; verdict?: unknown; reason?: unknown };
          return {
            cls: Number(r.cls),
            verdict: String(r.verdict ?? "").toLowerCase(),
            reason: String(r.reason ?? ""),
          };
        })
        .filter((c) => Number.isFinite(c.cls) && c.cls > 0);
      if (classes.length === 0) continue;
      return { classes, advice: typeof parsed.advice === "string" ? parsed.advice : "" };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Executors                                                            */
/* ------------------------------------------------------------------ */

type PrismaJob = Awaited<ReturnType<typeof db.job.findFirst>>;

async function findJobInProject(jobId: string, projectId: string): Promise<PrismaJob> {
  const job = await db.job.findFirst({ where: { id: jobId, projectId } });
  if (!job) {
    // links resolve to their original (the same door every jobs/[id] route uses)
    const linked = await findEffectiveJob(jobId);
    if (linked && linked.projectId === projectId) return linked;
  }
  return job;
}

function truncate(s: string | null | undefined, max = 200): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AgentCtx
): Promise<AiToolResult> {
  try {
    switch (name) {
      case "list_job_types":
        return listJobTypes();
      case "get_job_params":
        return getJobParams(String(args.job_type ?? ""));
      case "get_workflow_state":
        return await getWorkflowState(ctx);
      case "list_clusters":
        return await listClustersTool(ctx, (args as { fullHistory?: boolean }).fullHistory === true);
      case "list_deleted":
        return await listDeletedTool(ctx);
      case "restore_deleted":
        return await restoreDeletedTool(ctx, (args as { job_id?: string }).job_id);
      case "get_funnel_chain":
        return await getFunnelChain(ctx, typeof args.job_id === "string" ? args.job_id : "");
      case "compare_jobs":
        return await compareJobs(ctx, args);
      case "check_convergence":
        return await checkConvergence(ctx, args);
      case "create_job":
        return await createJob(ctx, args);
      case "build_pipeline":
        return await buildPipeline(ctx, args);
      case "wait_for_jobs":
        return await waitForJobs(ctx, args);
      case "update_job":
        return await updateJob(ctx, args);
      case "connect_jobs":
        return await connectJobs(ctx, args);
      case "delete_job":
        return await deleteJob(ctx, args);
      case "run_job":
        return await runJobTool(ctx, args);
      case "continue_run":
        return await continueRunTool(ctx, args);
      case "stop_job":
        return await stopJobTool(ctx, args);
      case "inspect_job":
        return await inspectJob(ctx, String(args.job_id ?? ""));
      case "judge_2d_classes":
        return await judge2dClasses(ctx, String(args.job_id ?? ""), typeof args.question === "string" ? args.question : undefined);
      case "get_job_curves":
        return await getJobCurves(ctx, String(args.job_id ?? ""), Array.isArray(args.kinds) ? args.kinds.map(String) : undefined);
      case "get_map_landscape":
        return await getMapLandscape(ctx);
      case "get_session_timeline":
        return await getSessionTimeline(ctx);
      case "get_sweep_verdict":
        return getSweepVerdict(ctx);
      case "get_storage_report":
        return await getStorageReport(ctx);
      case "get_curve_verdicts":
        return await getCurveVerdicts(ctx);
      case "select_classes":
        return await selectClasses(ctx, args);
      default:
        return { ok: false, summary: `Unknown tool: ${name}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, summary: `Tool ${name} failed: ${truncate(message, 400)}` };
  }
}

/* ---- list_job_types ------------------------------------------------ */

function listJobTypes(): AiToolResult {
  const rows = JOB_TYPES.map((t) => {
    const next = nextStepsFor(t.key).map((s) => s.type);
    return {
      key: t.key,
      label: t.label,
      category: t.category,
      group: t.group,
      description: t.description,
      tier: t.tier,
      inputs: t.inputs.map((i) => ({ name: i.name, accepts: i.accepts ?? ["*"], multiple: i.multiple ?? false })),
      outputs: t.outputs.map((o) => ({ name: o.name, kind: o.kind ?? "star" })),
      next_steps: next,
    };
  });
  return {
    ok: true,
    summary: `${JOB_TYPES.length} job types across ${rows.filter((r) => r.group === "SPA").length} SPA + ${rows.filter((r) => r.group === "Tomography").length} tomography entries (with legal successors)`,
    detail: { job_types: rows },
  };
}

/* ---- get_job_params ------------------------------------------------ */

function getJobParams(type: string): AiToolResult {
  const resolved = resolveJobTypeKey(type);
  const spec = resolved.key ? jobType(resolved.key) : undefined;
  if (!spec) return { ok: false, summary: `Unknown job type: ${type} — call list_job_types for the catalog` };
  const params = spec.params.slice(0, 120).map((p) => ({
    key: p.key,
    label: p.label,
    type: p.type,
    default: p.default,
    ...(p.options ? { options: p.options } : {}),
    ...(p.min != null ? { min: p.min } : {}),
    ...(p.max != null ? { max: p.max } : {}),
    tab: p.tab ?? "Additional",
    ...(p.advanced ? { advanced: true } : {}),
    ...(p.hint ? { hint: truncate(p.hint, 180) } : {}),
  }));
  return {
    ok: true,
    summary: `${spec.key}: ${params.length} params across tabs ${[...new Set(params.map((p) => p.tab))].join(", ")}${typeResolutionNote(resolved)}`,
    detail: { job_type: spec.key, params },
  };
}

/* ---- get_workflow_state -------------------------------------------- */

async function getWorkflowState(ctx: AgentCtx): Promise<AiToolResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, summary: "No active project" };
  const [jobs, workspaces] = await Promise.all([
    db.job.findMany({ where: { projectId: ctx.projectId }, orderBy: { createdAt: "asc" } }),
    db.workspace.findMany({ where: { projectId: ctx.projectId }, orderBy: { order: "asc" } }),
  ]);
  const edges = await db.edge.findMany({ where: { projectId: ctx.projectId } });
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));
  let clusterName: string | null = null;
  if (active.meta.remote?.connectionId) {
    const conn = getConnection(active.meta.remote.connectionId);
    clusterName = conn ? (conn.name || `${conn.username}@${conn.host}`) : active.meta.remote.connectionId;
  }
  return {
    ok: true,
    summary: `Project "${active.project.name}": ${jobs.length} jobs, ${edges.length} wires, ${workspaces.length} workspaces`,
    detail: {
      project: {
        name: active.project.name,
        mode: active.meta.mode,
        cluster: clusterName,
      },
      workspaces: workspaces.map((w) => ({ id: w.id, name: w.name })),
      jobs: jobs.map((j) => ({
        id: j.id,
        type: j.type,
        name: j.name,
        status: j.status,
        progress: j.progress,
        workspace: (j.workspaceId ? wsName.get(j.workspaceId) : undefined) ?? "Main",
        result: truncate(j.result, 200),
        note: truncate(j.note, 120),
        x: j.x,
        y: j.y,
      })),
      wires: edges.map((e) => ({ from: e.fromJobId, to: e.toJobId })),
    },
  };
}

/* ---- list_clusters ------------------------------------------------- */

async function listClustersTool(ctx: AgentCtx, fullHistory = false): Promise<AiToolResult> {
  const conns = loadConnections();
  const active = await getActiveProject();
  const boundId = active?.meta.remote?.connectionId ?? null;
  const boundConn = boundId ? conns.find((c) => c.id === boundId) ?? null : null;

  if (conns.length === 0) {
    return {
      ok: true,
      summary: boundId
        ? `No clusters in the registry — the project still points at connection ${boundId}, which no longer exists`
        : "No clusters in the registry — save one in the Remote clusters dialog first",
      detail: {
        projectBinding: boundId ? { connectionId: boundId, missing: true } : null,
        roster: [],
        note: "runs can still go mode:'local' — the cluster roster is empty",
      },
    };
  }

  // t476 — the résumé joins the roll: each row also answers "what has this
  // cluster done for me" from the SAME aggregate the dialog's résumé card
  // reads (connectionRunResume — the ≤3 reading line; the panorama is the
  // records dialog's wide aperture, not this read). A connection with zero
  // dispatches wears NO block — "no résumé" stays honest the same way the
  // list route omits the field (t270's omission law).
  // t484 — the whole book: fullHistory:true reopens the same aggregate
  // under opts.all (the records route's own aperture since t272) — the
  // agent can finally answer "show me everything this cluster has run"
  // without leaving the tool lane. The cap keeps a huge ledger from
  // flooding the context, and says so when it bites (cappedAt), so a
  // truncated read never pretends to be the whole book.
  const LEDGER_CAP = 50;
  const resumeOpts = fullHistory ? { all: true } : undefined;
  const roster = (await Promise.all(
    conns.map(async (c) => {
      const p = c.lastProbe;
      const resume = await connectionRunResume(c.id, resumeOpts);
      const shown = resume.recent.slice(0, LEDGER_CAP);
      return {
        id: c.id,
        name: c.name || `${c.username}@${c.host}`,
        host: `${c.username}@${c.host}:${c.port}`,
        // the dialog DTO's secret shape: booleans only, never the secrets
        auth: { method: c.authMethod, hasPassword: !!c.password, hasPassphrase: !!c.passphrase },
        remoteRoot: c.remoteRoot,
        useSlurm: c.useSlurm,
        defaultModule: c.defaultModule,
        projectBound: c.id === boundId,
        probe: p
          ? {
              // the dialog rail's three-word law (t268's probeDot): reachable /
              // probe-failed / never-tested — a probe's truth has a birthday
              state: p.ok ? "reachable" : "probe-failed",
              checkedAt: p.checkedAt,
              durationMs: p.durationMs ?? null,
              error: p.ok ? null : (p.error ?? "the probe failed without a reason line"),
              moduleSystem: p.moduleSystem,
              relionModules: p.relionModules,
              slurm: p.slurm === true,
              gpus: p.gpus?.length ?? 0,
            }
          : null,
        ...(resume.total > 0
          ? {
              dispatches: {
                total: resume.total,
                completed: resume.completed,
                failed: resume.failed,
                lastRunAt: resume.lastRunAt,
                ...(fullHistory && resume.recent.length > LEDGER_CAP
                  ? { cappedAt: LEDGER_CAP }
                  : {}),
                recent: shown.map((e) => ({
                  jobId: e.jobId,
                  jobType: e.jobType,
                  done: e.done,
                  exitCode: e.exitCode,
                  startedAt: e.startedAt,
                  // t272's three honest states, compressed to what a read
                  // needs: does the job still live on a canvas, and which
                  // project's canvas — or the ledger remembers a gone job
                  exists: e.exists ?? false,
                  ...(e.projectName ? { projectName: e.projectName } : {}),
                })),
              },
            }
          : {}),
      };
    }),
  )) satisfies Array<Record<string, unknown>>;

  const reachable = roster.filter((r) => r.probe?.state === "reachable").length;
  const boundName = boundConn ? boundConn.name || `${boundConn.username}@${boundConn.host}` : null;
  const boundResume = boundConn ? await connectionRunResume(boundConn.id, resumeOpts) : null;
  const summary =
    `${roster.length} cluster${roster.length === 1 ? "" : "s"} in the registry, ${reachable} reachable by last probe; ` +
    (boundName
      ? `the active project dispatches to "${boundName}" (run_job mode:'cluster')`
      : boundId
        ? `the project still points at connection ${boundId}, which no longer exists — rebind in the project panel before dispatching`
        : "the active project has no cluster bound (mode:'cluster' would refuse)") +
    // t476 — the bound cluster's résumé earns a clause in the spoken line;
    // unbound clusters' histories stay in their detail rows (zero-noise for
    // the clusters nobody asked about)
    (boundResume && boundResume.total > 0 && boundName
      ? `; "${boundName}" carries ${boundResume.total} recorded dispatch${boundResume.total === 1 ? "" : "es"} (${
          // t484 — the spoken line follows the aperture: the résumé says
          // "3 newest in detail", the full ledger says "all N in detail"
          fullHistory ? `all ${boundResume.recent.length} in detail` : `${boundResume.recent.length} newest in detail`
        })`
      : "");

  return {
    ok: true,
    summary,
    detail: {
      projectBinding: boundId ? { connectionId: boundId, name: boundName, missing: !boundConn } : null,
      roster,
      note: `probe facts are the LAST probe's truth — quote checkedAt when health matters; a fresh probe is the dialog's Test button or the dispatch's own gate, not this read. Dispatch records are the LEDGER's truth, not the canvas's — a record outlives its job: exists:false means the job is gone from every canvas while the ledger still remembers the run; ${
        // t484 — the panorama's address follows the aperture
        fullHistory
          ? "this read opened the WHOLE ledger (capped at 50, newest first) — older entries beyond the cap still live in the records dialog"
          : "the full history (and the bulk forget) lives in the records dialog — or re-read with fullHistory:true"
      }`,
    },
  };
}

/* ---- list_deleted / restore_deleted --------------------------------- */

/**
 * t477 — the graveyard's roll call. delete_job has spoken since t341; its
 * mirror read was mute: "我之前删掉的任务还能找回吗" had no door. This read
 * names every grave from the SAME tombstones the restore path consumes
 * (listJobTombstones — zero private snapshots), and each row answers the
 * only question that matters: can this grave come back from here?
 *   - a grave WITH a row snapshot (t477 deletes) → restorable, self-sufficient
 *   - a grave whose id is taken (already restored / re-created) → says so
 *   - a row-less grave (t341-era: the row lived in the client's undo stack
 *     and died with the page) → honest about needing the canvas's undo
 */
async function listDeletedTool(ctx: AgentCtx): Promise<AiToolResult> {
  // t478 — the rows come from graveRowsOf, the SAME brain the storage
  // dialog's graveyard drawer reads: one roll call, two faces, zero drift
  const rows = await graveRowsOf();
  if (rows.length === 0) {
    return {
      ok: true,
      summary: "The graveyard is empty — nothing has been deleted, nothing to restore",
      detail: { graves: [] },
    };
  }

  const named = rows.filter((r) => r.restorable).length;
  // t479 — the graveyard's weight: what the deleted still occupy on disk.
  // The clause only speaks when there IS weight — an emptied graveyard
  // (the sweeps took the workdirs) stays silent about bytes.
  const totalBytes = rows.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
  const weight =
    totalBytes > 0
      ? ` (${rows.filter((r) => r.bytes !== undefined).length} workdir${rows.filter((r) => r.bytes !== undefined).length === 1 ? "" : "s"} still on disk, ${fmtBytes(totalBytes)})`
      : "";
  return {
    ok: true,
    summary:
      `${rows.length} deleted job${rows.length === 1 ? "" : "s"} in the graveyard${weight}, ${named} restorable from here ` +
      `(restore_deleted with its id; the rest need the canvas's undo or a re-create)`,
    detail: {
      graves: rows,
      note: "a restore puts the job back under its ORIGINAL id — its workdir, run record and wires re-attach; a restored 'running' grave comes back idle (the process was stopped at delete time). A grave's bytes are its surviving workdir — the bulk clear (and the reclaimed bytes) lives in the Project storage dialog's Recently-deleted section",
    },
  };
}

/**
 * t477 — the restore verb. The grave's own row snapshot feeds the SAME
 * restoreJobRows the canvas's undo button runs (lib/job-restore.ts) —
 * same workspace guard, same scalar param filter, same running→idle
 * coercion, same tombstone re-apply. No private mutation path: the agent
 * restores exactly what the product's restore restores.
 */
async function restoreDeletedTool(ctx: AgentCtx, jobId: unknown): Promise<AiToolResult> {
  const id = typeof jobId === "string" ? jobId.trim() : "";
  if (!id) {
    return {
      ok: false,
      summary: 'restore_deleted needs job_id — call list_deleted to see the graves and pass one of their ids.',
    };
  }
  const tomb = readJobTombstone(id);
  if (!tomb) {
    return {
      ok: false,
      summary: `No tombstone for id "${truncate(id, 48)}" — call list_deleted to see the graveyard's actual residents.`,
    };
  }
  if (!tomb.row) {
    return {
      ok: false,
      summary:
        "This grave holds only the run record and wires — its name and params were snapshotted client-side at delete time and are gone. Restore it from the canvas's delete-toast Undo while the session remembers it, or recreate it with create_job.",
    };
  }

  const active = await getActiveProject();
  if (!active) {
    return { ok: false, summary: "No active project — a restore has no canvas to come back to." };
  }
  // the row snapshot IS the restore body (restoreJobRows re-validates every
  // field — the same sanitizer, never a verbatim trust)
  const body: RestoreJobInput = {
    id: tomb.id,
    type: tomb.row.type,
    name: tomb.row.name,
    x: tomb.row.x,
    y: tomb.row.y,
    params: tomb.row.params,
    workspaceId: tomb.row.workspaceId ?? undefined,
    note: tomb.row.note ?? undefined,
    status: tomb.row.status,
    progress: tomb.row.progress,
    result: tomb.row.result ?? undefined,
    startedAt: tomb.row.startedAt ?? undefined,
    duration: tomb.row.duration,
    linkedJobId: tomb.row.linkedJobId ?? undefined,
  };
  const outcome = await restoreJobRows([body], active.project.id);

  if (outcome.restored.length === 0) {
    const why = outcome.failed[0]?.error ?? "the restore failed without a reason line";
    return {
      ok: false,
      summary: `The grave did not come back: ${why}`,
      detail: outcome,
    };
  }
  const r = outcome.restored[0];
  const coercedLine = r.coerced
    ? " It was running when deleted, so it came back idle — the process was stopped at delete time; run_job when you want it to go again."
    : "";
  const recordLine = outcome.recordRestored.includes(r.id)
    ? " Its run record (outputs, results) re-attached, so downstream jobs can consume it again."
    : "";
  const edgeLine =
    outcome.edges.length > 0
      ? ` ${outcome.edges.length} wire${outcome.edges.length === 1 ? "" : "s"} re-attached.`
      : "";
  return {
    ok: true,
    summary: `"${tomb.row.name}" is back on the canvas under its original id ${r.id} — its workdir re-attached as if the delete never happened.${coercedLine}${recordLine}${edgeLine}`,
    detail: outcome,
  };
}

/* ---- get_funnel_chain ------------------------------------------------- */

/**
 * t468 — the agent reads the LEDGER. The funnel dialog and its Copy-ledger
 * button are the UI's own doors onto the cross-job story (t460–t463); this
 * tool runs the SAME pure brains on the SAME DB shape the funnel route
 * fetches — the assistant never gets a private read path the product
 * doesn't already trust (t419 design law).
 *
 * Door semantics mirror the canvas door (funnelDoorCandidate): no job_id →
 * the crown chain (deepest finished funnel verb, deterministic); a named
 * job_id → the chain around that verb, ANY status — unfinished stations
 * speak as honest status rows (the pure brain's own contract), so the
 * agent can read a chain while it runs and never invents a receipt.
 */
async function getFunnelChain(ctx: AgentCtx, jobId: string): Promise<AiToolResult> {
  const [jobs, edges] = await Promise.all([
    db.job.findMany({
      where: { projectId: ctx.projectId },
      select: { id: true, type: true, name: true, status: true, result: true, updatedAt: true },
    }),
    db.edge.findMany({ where: { projectId: ctx.projectId }, select: { fromJobId: true, toJobId: true } }),
  ]);

  const named = jobId.trim();
  let enteredId: string;
  let picked: "crown" | "named";
  // the pure brains speak ISO strings (the store's dialect) — Prisma rows
  // carry Date, so the translation happens once, here at the boundary
  const funnelJobs = jobs.map((j) => ({
    id: j.id,
    type: j.type,
    name: j.name,
    status: j.status,
    result: j.result,
    updatedAt: j.updatedAt ? j.updatedAt.toISOString() : null,
  }));
  if (named) {
    if (!jobs.some((j) => j.id === named)) {
      return {
        ok: false,
        summary: `No job with id "${truncate(named, 48)}" on this canvas — call get_workflow_state first and pass a real job id.`,
      };
    }
    enteredId = named;
    picked = "named";
  } else {
    const door = funnelDoorCandidate(funnelJobs, []);
    if (door.kind === "blocked") {
      return { ok: false, summary: door.line };
    }
    enteredId = door.job.id;
    picked = "crown";
  }

  const ledger = funnelLedgerOf({ jobs, edges, enteredId });
  if (!ledger || ledger.rows.length === 0) {
    return {
      ok: false,
      summary: "No funnel reads from that verb — it sits outside every wire's lineage on this canvas.",
    };
  }

  const entered = jobs.find((j) => j.id === enteredId)!;
  const ledgerText = funnelLedgerText(ledger, entered.name);
  const statusById = new Map(jobs.map((j) => [j.id, j.status]));
  const unfinished = ledger.rows
    .filter((r) => statusById.get(r.jobId) !== "completed")
    .map((r) => ({ id: r.jobId, name: r.name, type: r.type, status: statusById.get(r.jobId) ?? "unknown" }));

  const countRows = ledger.rows.filter((r) => r.kind === "ok" && r.count != null);
  const head = `Funnel of "${entered.name}" [${entered.type}] — ${ledger.headline} (${countRows.length} counted station${countRows.length === 1 ? "" : "s"} on the mainline${ledger.offMainline.length ? `, ${ledger.offMainline.length} off-mainline` : ""})`;
  const summary = unfinished.length
    ? `${head} — ${unfinished.length} station${unfinished.length === 1 ? " has" : "s have"} no receipt yet: ${unfinished.map((u) => `${u.name} (${u.status})`).join(", ")}. The numbers below cover finished stations only.`
    : head;

  return {
    ok: true,
    summary,
    detail: {
      picked,
      entered: { id: entered.id, type: entered.type, name: entered.name, status: entered.status },
      ledgerText,
      headline: ledger.headline,
      note: ledger.note,
      stations: ledger.rows.map((r) => ({
        id: r.jobId,
        type: r.type,
        name: r.name,
        kind: r.kind,
        count: r.count,
        unit: r.unit,
        classes: r.classes,
        perMic: r.perMic,
        edge: r.delta?.line ?? null,
      })),
      offMainline: ledger.offMainline,
      closing: ledger.closing,
      ...(unfinished.length ? { unfinished } : {}),
    },
  };
}

/* ---- compare_jobs ----------------------------------------------------- */

/** The compare family's domains, spoken by type. The dialog's own
 *  typeGates (run-compare-dialog): /ctffind|ctf/, /motioncorr|motion/,
 *  /class2d|class3d/ — the agent detects the SAME domain from the SAME
 *  type, never from the user's phrasing. */
function compareDomainOf(type: string): "ctf" | "motion" | "class" | null {
  if (/ctffind|ctf/i.test(type)) return "ctf";
  if (/motioncorr|motion/i.test(type)) return "motion";
  if (/class2d|class3d/i.test(type)) return "class";
  return null;
}

interface CompareDomainShape<R> {
  label: string;
  lenses: Record<string, LensSpec<R>>;
  defaultLens: string;
  words: VerdictWords;
  rowsOf(workdir: string): R[];
  /** The pairing's own health check, pre-formatted (null hides — the
   *  motion domain's count chips are its health, it has no line). */
  trustLine?(pairs: { a: R; b: R }[]): string | null;
}

/** One shape per domain — each field is the DIALOG's own spec value,
 *  imported from the domain modules, never re-typed here. */
const COMPARE_DOMAINS: Record<string, CompareDomainShape<never>> = {
  ctf: {
    label: "CTF",
    lenses: CTF_LENSES,
    defaultLens: "fom",
    words: DEFAULT_WORDS,
    // CtfMicrograph is a superset of CtfRunRow — the dialog feeds route
    // rows straight in, the tool feeds lib rows the same way
    rowsOf: (wd) => ctfMicrographRows(wd) as never[],
    trustLine: (pairs) => {
      const v = defocusAgreement(pairs as never[]);
      return `Defocus agreement: median |Δ| = ${
        Number.isFinite(v) ? `${v.toFixed(3)} µm` : "—"
      } across ${pairs.length} paired micrographs — the pairing's own health check.`;
    },
  },
  motion: {
    label: "Motion",
    lenses: MOTION_LENSES,
    defaultLens: "total",
    words: DEFAULT_WORDS,
    rowsOf: (wd) => motionCatalogueRows(wd).micrographs as never[],
  },
  class: {
    label: "Class",
    lenses: CLASS_LENSES,
    defaultLens: CLASS_DEFAULT_LENS,
    words: CLASS_WORDS,
    rowsOf: (wd) =>
      classStatsFromWorkdir(wd).classes.map((c) =>
        classRunRow({ cls: c.cls, count: c.count, fraction: c.fraction }),
      ) as never[],
    trustLine: (pairs) => concentrationCensus(pairs as never[]),
  },
};

/**
 * t469 — the agent reads the PAIR VERDICT. The compare dialog (t439/t440/
 * t453) is the UI's own door onto "did my new params help"; this tool runs
 * the SAME brain on the SAME rows: the shared join/deltas/verdict/movers
 * (lib/paired-compare.ts), the domains' own lenses and word laws
 * (ctf/motion/class-compare.ts), the rows from the ONE shared grammar
 * (lib/compare-rows.ts — the same functions the ctf/motion routes call).
 * No private brain, no private read path (t419 law, third read tool).
 *
 * Door semantics mirror the dialog's guard: both runs completed, same
 * type, a compare domain exists — every refusal says WHY and names the
 * fix, never a fabricated verdict.
 */
async function compareJobs(
  ctx: AgentCtx,
  args: { job_a?: unknown; job_b?: unknown; lens?: unknown },
): Promise<AiToolResult> {
  const aId = typeof args.job_a === "string" ? args.job_a.trim() : "";
  const bId = typeof args.job_b === "string" ? args.job_b.trim() : "";
  if (!aId || !bId) {
    return {
      ok: false,
      summary:
        "compare_jobs needs BOTH job ids — call get_workflow_state first and pass two real job ids.",
    };
  }

  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { id: true, type: true, name: true, status: true, projectId: true },
  });
  const a = jobs.find((j) => j.id === aId);
  const b = jobs.find((j) => j.id === bId);
  if (!a || !b) {
    const missing = !a ? aId : bId;
    return {
      ok: false,
      summary: `No job with id "${truncate(missing, 48)}" on this canvas — call get_workflow_state first and pass real job ids.`,
    };
  }
  if (aId === bId) {
    return {
      ok: false,
      summary: `"${a.name}" cannot pair with itself — one run against itself is the convergence question (inspect_job reads its iterations), while compare_jobs speaks pairs of runs.`,
    };
  }

  const domA = compareDomainOf(a.type);
  const domB = compareDomainOf(b.type);
  if (!domA || !domB || domA !== domB) {
    return {
      ok: false,
      summary: `These two jobs do not share a compare domain — "${a.name}" is ${a.type}, "${b.name}" is ${b.type}. The compare family speaks CTF (ctffind), Motion (motioncorr) and class occupancy (class2d/class3d); pair two completed runs of the SAME stage.`,
    };
  }
  const domain = COMPARE_DOMAINS[domA] as unknown as CompareDomainShape<Record<string, unknown> & { name: string }>;

  // the dialog's door guard: entries render nothing unless the host is a
  // completed run of the domain's type AND a completed sibling exists
  for (const j of [a, b]) {
    if (j.status !== "completed") {
      return {
        ok: false,
        summary: `"${j.name}" is ${j.status} — the pair verdict speaks only between two COMPLETED runs (a running run has no receipts to pair). Check again with inspect_job or wait_for_jobs.`,
      };
    }
  }

  // the same workdir resolution inspect_job speaks: engine record first,
  // then the computed RELION_DIR layout (dispatched-but-persisted jobs)
  const workdirOf = (j: { id: string; type: string; projectId: string }) => {
    const run = getRun(j.id);
    return (
      run?.workdir ?? path.join(RELION_DIR, j.projectId, `${j.type}_${j.id.slice(-8)}`)
    );
  };

  const rowsA = domain.rowsOf(workdirOf(a));
  const rowsB = domain.rowsOf(workdirOf(b));
  if (rowsA.length === 0 || rowsB.length === 0) {
    const cold = rowsA.length === 0 ? a : b;
    return {
      ok: false,
      summary: `"${cold.name}" has no ${domain.label} rows in its workdir (status completed, but the ${domain.label} outputs are missing${getRun(cold.id)?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The verdict needs two finished runs' outputs.`,
    };
  }

  const lensKey = typeof args.lens === "string" && args.lens.trim() ? args.lens.trim() : domain.defaultLens;
  const lens = domain.lenses[lensKey] as LensSpec<{ name: string }> | undefined;
  if (!lens) {
    const keys = Object.keys(domain.lenses).join("|");
    return {
      ok: false,
      summary: `Lens "${truncate(args.lens as string, 32)}" is not one of the ${domain.label} domain's lenses (${keys}) — retry with one of those, or omit lens for the default (${domain.defaultLens}).`,
    };
  }

  const join = joinByName(rowsA, rowsB);
  if (join.pairs.length === 0) {
    return {
      ok: false,
      summary: `No shared names between the two runs — ${rowsA.length} rows in "${a.name}", ${rowsB.length} in "${b.name}", none paired. A pair verdict joins on the row name; these runs saw different inputs, so there is nothing to compare.`,
    };
  }

  const deltas = pairedDeltas(join.pairs as never, lens as never);
  const v = pairedVerdict(deltas);
  const movers = topMovers(deltas);
  const verdictText = pairVerdictText({
    domainLabel: domain.label,
    nameA: a.name,
    nameB: b.name,
    lensLabel: lens.label,
    unit: lens.unit,
    digits: lens.digits,
    higherIsBetter: lens.higherIsBetter,
    words: domain.words,
    verdict: v,
    movers,
    onlyA: join.onlyA,
    onlyB: join.onlyB,
  });
  const trustLine = domain.trustLine?.(join.pairs as never) ?? null;

  const summary = `"${a.name}" vs "${b.name}" — ${join.pairs.length} paired · ${v.improved} ${domain.words.better} / ${v.regressed} ${domain.words.worse} / ${v.tied} ${domain.words.same} · median Δ ${fmtDelta(v.medianDelta, lens.digits)}${lens.unit} (${lens.label})`;

  return {
    ok: true,
    summary,
    detail: {
      domain: domA,
      lens: lens.key,
      runs: [a, b].map((j) => ({ id: j.id, name: j.name, type: j.type, status: j.status })),
      verdict: v,
      movers: {
        improvers: movers.improvers.map((d) => ({ name: d.name, a: d.a, b: d.b, delta: d.delta })),
        regressors: movers.regressors.map((d) => ({ name: d.name, a: d.a, b: d.b, delta: d.delta })),
      },
      unpaired: { onlyA: join.onlyA.length, onlyB: join.onlyB.length },
      trustLine,
      verdictText,
    },
  };
}

/* ---- check_convergence ----------------------------------------------- */

/**
 * t470 — the agent reads the SETTLED QUESTION. The convergence family's
 * two faces (t454's class census, t456/t459's resolution arc) compare ONE
 * run with ITSELF at two of its own rounds. This tool runs the SAME brains
 * on the SAME rows: the class-convergence dialog's chain (joinByName +
 * pairedDeltas on the share lens + verdict/topMovers + movingCensus) and
 * the resolution-arc route's own scan (convergence-rows.ts) + the plateau
 * law. No private brain, no private read path (t419 law, fourth read tool).
 *
 * Door semantics mirror the dialogs' guards: a COMPLETED run of a type the
 * arc family speaks (refine3d gold; class2d/class3d serial), at least two
 * settled rounds on the ladder, two DISTINCT real rounds. The census is
 * the classification domain's question only (the dialog never opened for
 * refine3d — a refinement's single-class data star has no population to
 * move); the arc answers the refinement. Every refusal says WHY and names
 * the fix.
 */
async function checkConvergence(
  ctx: AgentCtx,
  args: { job_id?: unknown; round_a?: unknown; round_b?: unknown },
): Promise<AiToolResult> {
  const jobId = typeof args.job_id === "string" ? args.job_id.trim() : "";
  if (!jobId) {
    return {
      ok: false,
      summary:
        "check_convergence needs a job id — call get_workflow_state first and pass a real job id.",
    };
  }
  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { id: true, type: true, name: true, status: true, projectId: true },
  });
  const job = jobs.find((j) => j.id === jobId);
  if (!job) {
    return {
      ok: false,
      summary: `No job with id "${truncate(jobId, 48)}" on this canvas — call get_workflow_state first and pass a real job id.`,
    };
  }

  const presentation = arcPresentationOf(job.type);
  if (!presentation) {
    return {
      ok: false,
      summary: `"${job.name}" is ${job.type} — the convergence family speaks refinement (refine3d, the gold-standard FSC arc) and classification (class2d/class3d, the occupancy census plus the model's own estimate). A run cannot converge where there is no per-round arc.`,
    };
  }
  if (job.status !== "completed") {
    return {
      ok: false,
      summary: `"${job.name}" is ${job.status} — the convergence reading speaks a run's SETTLED rounds (a running run's rounds are still being written). Check again with inspect_job or wait_for_jobs, then ask.`,
    };
  }

  // the same workdir resolution inspect_job and compare_jobs speak
  const run = getRun(job.id);
  const workdir =
    run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);

  // each dialect's door is its OWN dialog's door: the census gate reads
  // the data-star ladder (the convergence dialog's rounds), the arc gate
  // reads the model stars (the resolution-arc dialog's points)
  const rounds = workdirRounds(workdir);
  const arc = resolutionArcOf(resolutionArcFromWorkdir(workdir));
  const arcVerdict = arcVerdictOf(arc);

  if (presentation.dialect === "gold") {
    if (arc.length < 2) {
      return {
        ok: false,
        summary:
          rounds.length > 0
            ? `"${job.name}" wrote ${rounds.length} data-star rounds but no model stars with _rlnCurrentResolution — the refinement's arc has no estimates to read. The run's outputs are missing their model family.`
            : `"${job.name}" has no iteration rounds and no model stars with _rlnCurrentResolution in its workdir (status completed${run?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The refinement's arc has no estimates to read.`,
      };
    }
    if (
      (typeof args.round_a === "number" && Number.isFinite(args.round_a)) ||
      (typeof args.round_b === "number" && Number.isFinite(args.round_b))
    ) {
      return {
        ok: false,
        summary: `"${job.name}" is a refinement — its arc reads the run's WHOLE journey (the plateau law watches the last moves); round pairs are the classification census's question. Call again without round_a/round_b.`,
      };
    }
  } else {
    if (rounds.length === 0) {
      return {
        ok: false,
        summary: `"${job.name}" has no iteration rounds in its workdir (status completed, but no run_itNNN_data.star landed${run?.remote ? " — this run lived on a cluster and its mirror is cold" : ""}). The convergence reading reads the run's own rounds; there are none to read.`,
      };
    }
    if (rounds.length < 2) {
      return {
        ok: false,
        summary: `"${job.name}" has only one settled round (${roundLabel(rounds[0])}) — a convergence reading needs at least two iterations to compare.`,
      };
    }
  }

  // the census — the classification domain's own question. The default
  // pair is the run's WHOLE arc (the dialog's own law); explicit rounds
  // override that end. Gold speaks the arc alone — no pair, no census.
  let census: {
    verdict: { improved: number; regressed: number; tied: number; medianDelta: number };
    movers: { improvers: { name: string; delta: number }[]; regressors: { name: string; delta: number }[] };
    unpaired: { onlyA: number; onlyB: number };
    censusLine: string | null;
    censusText: string;
  } | null = null;
  let roundA = 0;
  let roundB = 0;

  if (presentation.dialect === "serial") {
    const def = defaultRoundPair(rounds)!;
    const wantA = typeof args.round_a === "number" && Number.isFinite(args.round_a) ? args.round_a : def.a;
    const wantB = typeof args.round_b === "number" && Number.isFinite(args.round_b) ? args.round_b : def.b;
    for (const want of [wantA, wantB]) {
      if (!rounds.includes(want)) {
        const ladder = rounds.map((r) => roundLabel(r)).join(", ");
        return {
          ok: false,
          summary: `${roundLabel(want)} is not one of this run's rounds — the ladder holds ${rounds.length} rounds: ${ladder}. Pick two of those as round_a/round_b, or omit both for the whole arc (${roundLabel(def.a)} vs ${roundLabel(def.b)}).`,
        };
      }
    }
    if (wantA === wantB) {
      return {
        ok: false,
        summary: `${roundLabel(wantA)} paired with itself has no arc — a convergence reading needs two DISTINCT rounds of one run. The run's ladder spans ${roundLabel(rounds[0])} to ${roundLabel(rounds[rounds.length - 1])}.`,
      };
    }
    [roundA, roundB] = wantA < wantB ? [wantA, wantB] : [wantB, wantA];

    const occA = roundOccupancy(workdir, roundA);
    const occB = roundOccupancy(workdir, roundB);
    const dead = !occA || !occB || occA.classes.length === 0 || occB.classes.length === 0;
    if (dead) {
      const which = !occA || occA.classes.length === 0 ? roundLabel(roundA) : roundLabel(roundB);
      return {
        ok: false,
        summary: `${which}'s data star holds no class rows (the round may have died mid-write) — the census refuses rather than guess. Try a different pair of the run's ${rounds.length} rounds.`,
      };
    }
    const join = joinByName(occA.classes, occB.classes);
    if (join.pairs.length === 0) {
      return {
        ok: false,
        summary: `No shared class numbers between ${roundLabel(roundA)} and ${roundLabel(roundB)} — a convergence reading joins the same classes across two rounds of ONE run; these rounds hold different class inventories (${occA.classes.length} vs ${occB.classes.length}), so there is nothing to pair.`,
      };
    }
    const lens = CLASS_LENSES.share as LensSpec<{ name: string }>;
    const deltas = pairedDeltas(join.pairs as never, lens as never);
    const v = pairedVerdict(deltas);
    const movers = topMovers(deltas);
    const censusLine = movingCensus(deltas as never, { aRound: roundA, bRound: roundB });
    const censusText =
      pairVerdictText({
        domainLabel: "Class occupancy",
        nameA: roundLabel(roundA),
        nameB: roundLabel(roundB),
        lensLabel: lens.label,
        unit: lens.unit,
        digits: lens.digits,
        higherIsBetter: lens.higherIsBetter,
        words: CLASS_WORDS,
        verdict: v,
        movers,
        onlyA: join.onlyA,
        onlyB: join.onlyB,
      }) + (censusLine ? `\n${censusLine}` : "");
    census = {
      verdict: v,
      movers: {
        improvers: movers.improvers.map((d) => ({ name: d.name, delta: d.delta })),
        regressors: movers.regressors.map((d) => ({ name: d.name, delta: d.delta })),
      },
      unpaired: { onlyA: join.onlyA.length, onlyB: join.onlyB.length },
      censusLine,
      censusText,
    };
  }

  // the arc — the estimate per round, gold or serial by the type's dialect
  const arcReading =
    arc.length >= 2
      ? {
          points: arc.length,
          from: { iteration: arc[0].iteration, resolution: arc[0].resolution },
          to: {
            iteration: arc[arc.length - 1].iteration,
            resolution: arc[arc.length - 1].resolution,
          },
          best: arc.reduce((b, p) => (p.resolution < b.resolution ? p : b), arc[0]),
          verdictWord: arcVerdict?.word ?? null,
          verdictDetail: arcVerdict?.detail ?? null,
          summary: arcSummaryOf(arc),
          biggestJump: (() => {
            const j = biggestJump(arc);
            return j
              ? {
                  from: j.from.iteration,
                  to: j.to.iteration,
                  delta: Number(j.delta.toFixed(2)),
                }
              : null;
          })(),
          estimateLabel: presentation.estimateLabel,
        }
      : null;

  if (presentation.dialect === "serial" && !arcReading) {
    // the census alone is a complete reading (t454's face had no arc);
    // the honest note says why the second half stays silent
    if (census) census.censusText += "\nNo model stars with _rlnCurrentResolution — this run wrote no per-round estimates, so there is no arc to read alongside the census.";
  }

  // the summary — one line, the domain's own words
  const arcNote = arcReading
    ? `${arcReading.summary}${arcReading.verdictWord ? ` (${arcReading.verdictWord})` : ""}`
    : null;
  const censusEnding = census?.censusLine
    ? census.censusLine.replace(/^.* — /, "").replace(/\.$/, "")
    : "";
  const summary = census
    ? `"${job.name}" ${presentation.noun} — ${census.verdict.improved} ${CLASS_WORDS.better} / ${census.verdict.regressed} ${CLASS_WORDS.worse} / ${census.verdict.tied} ${CLASS_WORDS.same} between ${roundLabel(roundA)} and ${roundLabel(roundB)} (${censusEnding})${arcNote ? ` · arc ${arcNote}` : ""}`
    : `"${job.name}" ${presentation.noun} — ${arcNote ?? "no arc"}`;

  return {
    ok: true,
    summary,
    detail: {
      job: { id: job.id, name: job.name, type: job.type, status: job.status },
      dialect: presentation.dialect,
      noun: presentation.noun,
      rounds,
      pair: presentation.dialect === "serial" ? { a: roundA, b: roundB } : null,
      census,
      arc: arcReading,
    },
  };
}

/* ---- create_job ----------------------------------------------------- */

/** What one job creation produced — shared by create_job and build_pipeline. */
interface CreateOneOutcome {
  ok: boolean;
  summary: string;
  jobId: string | null;
  jobName: string | null;
  /** True when a connect_from was requested AND the wire landed. */
  wired: boolean;
  dropped: string[];
  /** The created row (null when refused) — create_job DTOs it. */
  job: PrismaJob | null;
}

async function createOneJob(
  ctx: AgentCtx,
  opts: {
    type: string;
    name?: string;
    params?: unknown;
    connectFromId?: string | null;
    x?: number;
    y?: number;
  }
): Promise<CreateOneOutcome> {
  const fail = (summary: string): CreateOneOutcome => ({
    ok: false,
    summary,
    jobId: null,
    jobName: null,
    wired: false,
    dropped: [],
    job: null,
  });
  // t463 — the alias ladder: models (and users) say "ctf" / "2d分类" / "motion"
  // for the canonical keys. Resolve here so create_job AND build_pipeline
  // both recover instead of refusing; the resolution note rides every summary.
  const resolved = resolveJobTypeKey(opts.type);
  const spec = resolved.key ? jobType(resolved.key) : undefined;
  if (!spec) return fail(`Unknown job type: ${opts.type} — call list_job_types for the catalog`);
  const typeKey = spec.key;
  const typeNote = typeResolutionNote(resolved);

  const { filtered, dropped } = filterParamsForSpec(typeKey, opts.params);

  let connectFrom: PrismaJob = null;
  if (opts.connectFromId) {
    connectFrom = await findJobInProject(opts.connectFromId, ctx.projectId);
    if (!connectFrom) {
      return fail(
        `connect_from job not found in this project: ${opts.connectFromId} — call get_workflow_state for the real ids`
      );
    }
  }

  // workspace: the source's workspace (chains stay together), else the first
  let workspaceId = connectFrom?.workspaceId ?? null;
  if (!workspaceId) {
    const first = await db.workspace.findFirst({
      where: { projectId: ctx.projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    workspaceId = first?.id ?? (await ensureDefaultWorkspace(ctx.projectId));
  }

  const content = await db.job.findMany({
    where: { projectId: ctx.projectId },
    select: { x: true, y: true },
  });
  const auto = nextPositionFor(connectFrom ? { x: connectFrom.x, y: connectFrom.y } : null, content);
  const x = typeof opts.x === "number" && Number.isFinite(opts.x) ? opts.x : auto.x;
  const y = typeof opts.y === "number" && Number.isFinite(opts.y) ? opts.y : auto.y;

  const count = await db.job.count({ where: { projectId: ctx.projectId, type: typeKey } });
  const customName =
    typeof opts.name === "string" && opts.name.trim() ? opts.name.trim().slice(0, 120) : null;

  const storedParams: Record<string, unknown> = {
    ...defaultParams(typeKey),
    ...filtered,
  };

  const job = await db.job.create({
    data: {
      projectId: ctx.projectId,
      workspaceId,
      type: typeKey,
      name: customName ?? `${spec.label} ${count + 1}`,
      x,
      y,
      params: JSON.stringify(storedParams),
      duration: spec.duration,
    },
  });

  // the wire — same validations the edges route enforces. A refused wire
  // does NOT fail the creation: the job stands, the report says why.
  let wired = false;
  let wireNote = "";
  if (connectFrom) {
    const ports = defaultPorts(connectFrom.type, typeKey);
    if (!portsValid(connectFrom.type, ports.fromPort, typeKey, ports.toPort)) {
      wireNote = ` — the wire ${connectFrom.name} → ${job.name} was refused (no compatible port pair; wire it manually via connect_jobs)`;
    } else {
      const duplicate = await db.edge.findUnique({
        where: { fromJobId_toJobId: { fromJobId: connectFrom.id, toJobId: job.id } },
      });
      if (!duplicate) {
        await db.edge.create({
          data: { projectId: ctx.projectId, fromJobId: connectFrom.id, toJobId: job.id },
        });
        wired = true;
        wireNote = `, wired from ${connectFrom.name} (${ports.fromPort} → ${ports.toPort})`;
      }
    }
  }

  return {
    ok: true,
    summary: `Created ${job.name} [${job.id}]${wireNote}${typeNote}${dropped.length > 0 ? ` (dropped unknown params: ${dropped.join(", ")})` : ""}`,
    jobId: job.id,
    jobName: job.name,
    wired,
    dropped,
    job,
  };
}

async function createJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const out = await createOneJob(ctx, {
    type: String(args.type ?? ""),
    name: typeof args.name === "string" ? args.name : undefined,
    params: args.params,
    connectFromId: typeof args.connect_from === "string" ? args.connect_from : null,
    x: typeof args.x === "number" ? args.x : undefined,
    y: typeof args.y === "number" ? args.y : undefined,
  });
  if (!out.ok) return { ok: false, summary: out.summary };
  const dto = out.job ? toJobDTO(out.job) : null;
  if (dto) dto.engine = "relion";
  return {
    ok: true,
    summary: out.summary,
    detail: { job: dto, wired: out.wired, dropped: out.dropped },
  };
}

/* ---- build_pipeline -------------------------------------------------- */

const PIPELINE_STEP_CAP = 12;

/**
 * t463 — the canonical bridge between chain steps that don't port-match.
 * The field shape: users say「挑选 → 2D 分类」(pick → classify) and RELION's
 * own law inserts Extract between them (coords must become particles
 * before any classification). The law is deliberately NARROW — a bridge
 * is offered only when the upstream truly produces coords AND the
 * downstream truly consumes particles AND extract port-matches both
 * sides; anything else keeps its honest refusal instead of a dead chain
 * (import → class2d must NOT grow an extract with no coords to feed it).
 */
const BRIDGE_CANDIDATES = ["extract"];

export function bridgeBetween(a: string, b: string): string | null {
  const from = jobType(a);
  const to = jobType(b);
  if (!from || !to) return null;
  const direct = defaultPorts(a, b);
  if (portsValid(a, direct.fromPort, b, direct.toPort)) return null;
  const aOutputsCoords = from.outputs.some((o) => o.kind === "coords");
  const bWantsParticles = to.inputs.some((i) => (i.accepts ?? []).includes("particles"));
  if (!aOutputsCoords || !bWantsParticles) return null;
  for (const mid of BRIDGE_CANDIDATES) {
    const up = defaultPorts(a, mid);
    const down = defaultPorts(mid, b);
    if (portsValid(a, up.fromPort, mid, up.toPort) && portsValid(mid, down.fromPort, b, down.toPort)) {
      return mid;
    }
  }
  return null;
}

export interface BridgedSteps {
  steps: { type: string; name?: string; params?: unknown }[];
  inserted: { after: string; bridge: string }[];
}

/** Pre-pass: insert bridges where adjacent steps don't port-match. Pure. */
export function bridgePipelineSteps(
  steps: { type: string; name?: string; params?: unknown }[]
): BridgedSteps {
  const out: { type: string; name?: string; params?: unknown }[] = [];
  const inserted: { after: string; bridge: string }[] = [];
  for (let i = 0; i < steps.length; i++) {
    out.push(steps[i]);
    if (i + 1 < steps.length) {
      const bridge = bridgeBetween(steps[i].type, steps[i + 1].type);
      if (bridge && steps.length + inserted.length < PIPELINE_STEP_CAP) {
        out.push({ type: bridge });
        inserted.push({ after: steps[i].type, bridge });
      }
    }
  }
  return { steps: out, inserted };
}

export function normalizePipelineSteps(
  raw: unknown
): { steps: { type: string; name?: string; params?: unknown }[]; error: string | null } {
  if (!Array.isArray(raw)) return { steps: [], error: "steps must be an ordered array of {type, name?, params?}" };
  if (raw.length === 0) return { steps: [], error: "steps is empty — pass the chain's job types in pipeline order" };
  if (raw.length > PIPELINE_STEP_CAP)
    return { steps: [], error: `too many steps (${raw.length}) — the cap is ${PIPELINE_STEP_CAP} per call; split the chain` };
  const steps: { type: string; name?: string; params?: unknown }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s || typeof s !== "object" || Array.isArray(s))
      return { steps: [], error: `step ${i + 1} is not an object` };
    const type = String((s as { type?: unknown }).type ?? "");
    if (!type) return { steps: [], error: `step ${i + 1} is missing its type` };
    const rec: { type: string; name?: string; params?: unknown } = { type };
    const name = (s as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) rec.name = name;
    const params = (s as { params?: unknown }).params;
    if (params && typeof params === "object" && !Array.isArray(params)) rec.params = params;
    steps.push(rec);
  }
  return { steps, error: null };
}

async function buildPipeline(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const { steps, error } = normalizePipelineSteps(args.steps);
  if (error) return { ok: false, summary: error };

  // validate every type BEFORE creating anything — a typo in step 5
  // must not leave half a chain on the canvas. t463: the alias ladder runs
  // here too, so a model that says "ctf"/"2d分类" builds the chain instead
  // of dying at the gate — the canonical key replaces the step in place.
  const interpreted: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const resolved = resolveJobTypeKey(steps[i].type);
    if (!resolved.key) {
      return {
        ok: false,
        summary: `step ${i + 1}: unknown job type "${steps[i].type}" — nothing was created (call list_job_types for the catalog)`,
      };
    }
    if (resolved.key !== steps[i].type) {
      interpreted.push(`step ${i + 1}: "${steps[i].type}" → ${resolved.key}`);
      steps[i].type = resolved.key;
    }
  }

  // t463 — the bridge pre-pass: adjacent steps that don't port-match get
  // the canonical connector (pick → classify grows an extract). The chain
  // the user asked for stays THEIR chain — the bridge is the road RELION
  // itself would pave, and the summary names every stone that was added.
  const bridged = bridgePipelineSteps(steps);
  if (bridged.inserted.length > 0) {
    steps.splice(0, steps.length, ...bridged.steps);
  }

  let prevId: string | null = typeof args.connect_from === "string" ? args.connect_from : null;
  if (prevId) {
    const prev = await findJobInProject(prevId, ctx.projectId);
    if (!prev) {
      return {
        ok: false,
        summary: `connect_from job not found in this project: ${prevId} — call get_workflow_state for the real ids`,
      };
    }
    prevId = prev.id;
  }

  const created: { step: number; id: string; name: string; type: string; wired: boolean }[] = [];
  const refusedWires: { step: number; reason: string }[] = [];
  const dropped: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const out = await createOneJob(ctx, {
      type: steps[i].type,
      name: steps[i].name,
      params: steps[i].params,
      connectFromId: prevId,
    });
    if (!out.ok) {
      return {
        ok: false,
        summary: `step ${i + 1} (${steps[i].type}) failed: ${out.summary} — the ${created.length} job(s) before it stay on the canvas`,
        detail: { created, refusedWires, dropped },
      };
    }
    created.push({ step: i + 1, id: out.jobId!, name: out.jobName!, type: steps[i].type, wired: out.wired });
    if (prevId && !out.wired) {
      refusedWires.push({ step: i + 1, reason: `no compatible port pair with step ${i} — wire manually via connect_jobs` });
    }
    for (const d of out.dropped) dropped.push(`step${i + 1}:${d}`);
    prevId = out.jobId;
  }

  const chain = created.map((c) => c.type).join(" → ");
  const wireSummary =
    refusedWires.length === 0
      ? "fully wired"
      : `${refusedWires.length} wire(s) refused (see refusedWires)`;
  return {
    ok: true,
    summary: `Built ${created.length}-job chain: ${chain} — ${wireSummary}${interpreted.length > 0 ? `; interpreted stage names: ${interpreted.join("; ")}` : ""}${bridged.inserted.length > 0 ? `; auto-inserted ${bridged.inserted.map((b) => `${b.bridge} after ${b.after}`).join(", ")} (the port law's own connector)` : ""}${dropped.length > 0 ? `; dropped unknown params: ${dropped.join(", ")}` : ""}`,
    detail: {
      jobs: created.map((c) => ({ id: c.id, name: c.name, type: c.type })),
      head: created[0]?.id ?? null,
      tail: created[created.length - 1]?.id ?? null,
      refusedWires,
      dropped,
      interpreted,
      inserted: bridged.inserted,
      next: `run_job on the head (${created[0]?.name ?? "?"}) — downstream pending jobs auto-start`,
    },
  };
}

/* ---- wait_for_jobs --------------------------------------------------- */

const WAIT_POLL_MS = 1500;
const WAIT_DEFAULT_SEC = 45;
const WAIT_MAX_SEC = 180;

/** Clamp a caller-supplied wait budget to [1, 180] seconds (bench-covered). */
export function clampWaitSeconds(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return WAIT_DEFAULT_SEC;
  return Math.min(WAIT_MAX_SEC, Math.max(1, Math.round(v)));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function waitForJobs(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const ids = Array.isArray(args.job_ids) ? args.job_ids.map((x) => String(x)).filter(Boolean) : [];
  if (ids.length === 0) return { ok: false, summary: "job_ids is empty" };
  if (ids.length > 10) return { ok: false, summary: `too many jobs (${ids.length}) — the cap is 10 per call` };

  // resolve through the same link-aware door every tool uses
  const resolved = new Map<string, NonNullable<PrismaJob>>();
  for (const id of ids) {
    const job = await findJobInProject(id, ctx.projectId);
    if (!job) return { ok: false, summary: `job not found in this project: ${id}` };
    resolved.set(id, job);
  }
  const realIds = [...new Set([...resolved.values()].map((j) => j.id))];
  const argOfReal = new Map<string, string>();
  for (const [argId, job] of resolved) argOfReal.set(job.id, argId);

  const timeoutSec = clampWaitSeconds(args.timeout_sec);
  const deadline = Date.now() + timeoutSec * 1000;
  const unsettled = (rows: { status: string }[]) => rows.filter((r) => r.status === "running" || r.status === "pending");

  let rows = await db.job.findMany({
    where: { id: { in: realIds } },
    select: { id: true, status: true, progress: true },
  });
  let waitedMs = 0;
  while (unsettled(rows).length > 0 && Date.now() < deadline) {
    await sleep(WAIT_POLL_MS);
    waitedMs = Date.now() - (deadline - timeoutSec * 1000);
    rows = await db.job.findMany({
      where: { id: { in: realIds } },
      select: { id: true, status: true, progress: true },
    });
  }

  const final = await db.job.findMany({ where: { id: { in: realIds } } });
  const byReal = new Map(final.map((j) => [j.id, j]));
  const report = ids.map((argId) => {
    const j = resolved.get(argId)!;
    const row = byReal.get(j.id) ?? j;
    return {
      id: argId,
      name: row.name,
      status: row.status,
      progress: row.progress,
      result: truncate(row.result, 200),
    };
  });
  const stillUnsettled = report.filter((r) => r.status === "running" || r.status === "pending");
  const allSettled = stillUnsettled.length === 0;
  const lines = report.map(
    (r) => `${r.name}: ${r.status}${r.status === "running" ? ` (${Math.round(r.progress * 100)}%)` : r.result ? ` — ${r.result}` : ""}`
  );
  return {
    ok: true,
    summary: allSettled
      ? `${report.length}/${report.length} settled in ${(waitedMs / 1000).toFixed(1)}s — ${lines.join("; ")}`
      : `still ${stillUnsettled.length} running/pending after ${timeoutSec}s — ${lines.join("; ")} — check again with inspect_job or wait_for_jobs later`,
    detail: {
      jobs: report,
      waitedMs,
      timeoutSec,
      allSettled,
      ...(argOfReal.size !== realIds.length ? { note: "some job ids resolved through soft links" } : {}),
    },
  };
}

/* ---- update_job ----------------------------------------------------- */

async function updateJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.linkedJobId) return { ok: false, summary: `${job.name} is a soft link — edit its original instead` };

  const data: Record<string, unknown> = {};
  const changes: string[] = [];

  if (args.params && typeof args.params === "object" && !Array.isArray(args.params)) {
    const { filtered, dropped } = filterParamsForSpec(job.type, args.params);
    if (Object.keys(filtered).length > 0) {
      const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
      const spec = jobType(job.type);
      for (const [key, value] of Object.entries(filtered)) {
        const p = spec?.params.find((sp) => sp.key === key);
        stored[key] = p ? coerceParam(p, value) : value;
        changes.push(`${key}=${String(value)}`);
      }
      data.params = JSON.stringify(stored);
    }
    if (dropped.length > 0) {
      changes.push(`dropped: ${dropped.join(", ")}`);
    }
  }
  if (typeof args.name === "string" && args.name.trim()) {
    data.name = args.name.trim().slice(0, 120);
    changes.push(`name → ${data.name}`);
  }
  if (typeof args.note === "string") {
    data.note = args.note.trim() ? args.note.trim().slice(0, 500) : null;
    changes.push("note updated");
  }
  if (Object.keys(data).length === 0) {
    return { ok: true, summary: `Nothing to update on ${job.name} (no valid fields in the request)` };
  }
  const updated = await db.job.update({ where: { id: job.id }, data });
  return {
    ok: true,
    summary: `Updated ${updated.name}: ${changes.join("; ")}`,
    detail: { job: toJobDTO(updated) },
  };
}

/* ---- connect_jobs --------------------------------------------------- */

async function connectJobs(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const fromId = String(args.from_job_id ?? "");
  const toId = String(args.to_job_id ?? "");
  const [fromJob, toJob] = await Promise.all([
    findJobInProject(fromId, ctx.projectId),
    findJobInProject(toId, ctx.projectId),
  ]);
  if (!fromJob || !toJob) {
    return { ok: false, summary: `Job not found: ${!fromJob ? fromId : toId}` };
  }
  if (fromJob.id === toJob.id) {
    return { ok: false, summary: "Cannot connect a job to itself" };
  }
  const ports =
    args.from_port && args.to_port
      ? { fromPort: String(args.from_port), toPort: String(args.to_port) }
      : defaultPorts(fromJob.type, toJob.type);
  if (!portsValid(fromJob.type, ports.fromPort, toJob.type, ports.toPort)) {
    return {
      ok: false,
      summary: `Port mismatch: ${fromJob.type}:${ports.fromPort ?? "?"} cannot feed ${toJob.type}:${ports.toPort ?? "?"} — check list_job_types for the ports`,
    };
  }
  const duplicate = await db.edge.findUnique({
    where: { fromJobId_toJobId: { fromJobId: fromJob.id, toJobId: toJob.id } },
  });
  if (duplicate) {
    return { ok: true, summary: `${fromJob.name} → ${toJob.name} is already wired` };
  }
  // cycle check — the same detector the edges route uses
  const adj = await allAdjacency();
  const nodes = new Set(adj.keys());
  nodes.add(fromJob.id);
  nodes.add(toJob.id);
  const pairs: { from: string; to: string }[] = [];
  for (const [f, ts] of adj) for (const t of ts) pairs.push({ from: f, to: t });
  pairs.push({ from: fromJob.id, to: toJob.id });
  if (findCycle([...nodes], pairs) !== null) {
    return { ok: false, summary: `Refused: wiring ${fromJob.name} → ${toJob.name} would close a cycle` };
  }
  const edge = await db.edge.create({
    data: { projectId: ctx.projectId, fromJobId: fromJob.id, toJobId: toJob.id },
  });
  return {
    ok: true,
    summary: `Wired ${fromJob.name} → ${toJob.name} (${ports.fromPort} → ${ports.toPort})`,
    detail: { edgeId: edge.id, from: fromJob.id, to: toJob.id },
  };
}

/* ---- delete_job ------------------------------------------------------ */

async function deleteJob(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const confirm = args.confirm === true;
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if ((job.status === "completed" || job.status === "running") && !confirm) {
    return {
      ok: false,
      summary: `${job.name} is ${job.status} — deleting destroys its results. Ask the user, then call again with confirm:true`,
    };
  }
  // stop a running job first (the same branch order the project-delete fix t418 taught)
  if (job.status === "running") {
    const rec = getRun(job.id);
    if (rec?.remote) await remoteStopRun(job.id);
    else await stopRun(job.id);
  }
  await db.edge.deleteMany({ where: { OR: [{ fromJobId: job.id }, { toJobId: job.id }] } });
  await db.job.delete({ where: { id: job.id } });
  return { ok: true, summary: `Deleted ${job.name} (workdir kept on disk — the tombstone semantics)` };
}

/* ---- run_job --------------------------------------------------------- */

async function runJobTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.status === "running") {
    return { ok: false, summary: `${job.name} is already running (progress ${(job.progress * 100).toFixed(0)}%)` };
  }
  if (job.linkedJobId) {
    return { ok: false, summary: `${job.name} is a soft link — run its original instead` };
  }
  const mode = args.mode === "local" || args.mode === "cluster" ? args.mode : undefined;

  let remote: ReturnType<typeof projectRemoteTarget> = null;
  if (mode === "cluster" || !mode) {
    remote = projectRemoteTarget(ctx.projectId);
    if (!remote && mode === "cluster") {
      return {
        ok: false,
        summary: "This project has no bound cluster — bind one in the project settings or run with mode 'local'",
      };
    }
  }

  const reRunNote =
    job.status === "completed" ? " NOTE: this re-run WIPES the previous results (previous rounds are archived on the cluster)." : "";
  const outcome = await startJob(job, remote ? { remote } : {});
  if (outcome.error) {
    return { ok: false, summary: `Start refused: ${outcome.error}${reRunNote}` };
  }
  if (outcome.busy) {
    return {
      ok: false,
      summary: `Busy (${outcome.busyKind}): ${outcome.busy}`,
    };
  }
  if (outcome.waiting) {
    return {
      ok: true,
      summary: `${job.name} is waiting: ${outcome.waiting} — it starts automatically when its upstream completes`,
    };
  }
  const lane = outcome.job.status === "running" ? "started" : `status now ${outcome.job.status}`;
  return {
    ok: true,
    summary: `${job.name} ${lane}${remote ? " (cluster lane)" : " (local lane)"}${reRunNote}`,
    detail: { status: outcome.job.status, progress: outcome.job.progress },
  };
}

/* ---- continue_run ----------------------------------------------------- */

/**
 * t471 — the convergence verdict's verb, read by the agent (the 18th
 * tool). The UI's continue verb (t455, continue-verb-row.tsx) fires the
 * same three moves: checkpointOf → continuePlanOf → continueParamWrites,
 * then saveJob + run on the job's OWN lane. This tool is that row's
 * server face — the same shared brains (convergence-continue.ts), the
 * same data plane (continueSourcesFor — the picker's route), the same
 * dispatch (startJob), zero private mutation path.
 *
 * Laws mirrored, never invented:
 *  - THE LANE IS THE JOB'S OWN: continueLaneOf reads the runRemote
 *    ledger (remoteInfoFor — the DTO's own projection) because a cluster
 *    checkpoint is a CLUSTER path; run_job's project-binding default
 *    would be a category error here.
 *  - THE ARC'S HEAD IS THE CHECKPOINT: checkpointOf — the newest
 *    COMPLETE self round, live over archived; the verdict's reading
 *    pair is never a continue target.
 *  - --iter IS THE TOTAL (RELION's restart law), clamped to the form's
 *    ceiling, and the clamp is SAID.
 *  - NO CHECKPOINT, NO VERB; NO KNOB, NO VERB — the row's honest whys,
 *    verbatim.
 *  - THE WRITES RIDE THE SPEC: fn_cont + the knob key are legal spec
 *    params; the merge is update_job's own (coerceParam), then startJob
 *    reads explicitContinueOf from the updated row — the product's own
 *    resume path (the fresh-start wipe keeps the run_it family alive
 *    for an explicit in-workdir target, engine t394 law).
 */
async function continueRunTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  if (!jobId) {
    return { ok: false, summary: "continue_run needs a job id — pass the finished run's job id (get_workflow_state lists ids)" };
  }
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) {
    return { ok: false, summary: `Job not found: ${jobId} — get_workflow_state lists the canvas's ids` };
  }
  if (job.status === "running") {
    return { ok: false, summary: `${job.name} is already running (progress ${(job.progress * 100).toFixed(0)}%) — a continue resumes a SETTLED run; let it finish or stop it first` };
  }
  if (job.linkedJobId) {
    return { ok: false, summary: `${job.name} is a soft link — continue its original instead` };
  }
  if (!CONTINUE_FAMILY_TYPES.has(job.type)) {
    return {
      ok: false,
      summary: `${job.type} jobs have no continue — only the refine family (class2d, class3d, refine3d, initialmodel, multibody) carries RELION's fn_cont restart idiom`,
    };
  }

  const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
  const knob = iterKnobOf(job.type, stored);
  if (!knob) {
    return {
      ok: false,
      summary:
        job.type === "refine3d"
          ? "RELION's auto-refine owns this run's convergence — it stops on its own criterion, and a written --iter would be dead. The continue verb speaks only the manual dialect."
          : "This run's dialect carries no --iter knob — the continue verb has nothing to extend.",
    };
  }

  // the picker's own data plane (the route's brain, server-side import —
  // never a private scan)
  const sources = await continueSourcesFor({
    id: job.id,
    name: job.name,
    type: job.type,
    projectId: job.projectId,
  });
  const checkpoint = checkpointOf(sources);
  if (!checkpoint) {
    const scanError = selfScanErrorOf(sources);
    return {
      ok: false,
      summary: scanError
        ? `The run directory could not be read (${scanError}) — the continue verb stays absent rather than guessing.`
        : "No complete checkpoint in this run's own directory — RELION --continue needs the optimiser.star family (run_itNNN_optimiser.star with its data/model/sampling siblings). The verdict stays a reading.",
    };
  }

  const chips = moreOptionsFor(knob.vdam);
  let more = chips[0] ?? 5;
  if (args.more !== undefined) {
    const m = typeof args.more === "number" ? args.more : Number(args.more);
    if (!Number.isFinite(m) || m <= 0) {
      return {
        ok: false,
        summary: `more must be a positive number of iterations — the convergence dialog's chips are ${chips.join("/")} (${knob.vdam ? "VDAM mini-batches" : "EM epochs"})`,
      };
    }
    more = Math.round(m);
  }

  const plan = continuePlanOf({ type: job.type, params: stored, checkpoint, more });
  if (!plan) {
    return { ok: false, summary: "the continue plan could not be assembled (no --iter knob for this dialect)" };
  }
  const lane = continueLaneOf({ runRemote: remoteInfoFor(job.id) });

  // the writes ride the spec (update_job's own merge law): fn_cont +
  // the knob key are legal curated params, coerced through the schema
  const spec = jobType(job.type);
  const merged: Record<string, unknown> = { ...stored };
  for (const [k, v] of Object.entries(continueParamWrites(plan))) {
    const p = spec?.params.find((sp) => sp.key === k);
    merged[k] = p ? coerceParam(p, v) : v;
  }
  const updated = await db.job.update({
    where: { id: job.id },
    data: { params: JSON.stringify(merged) },
  });

  const archivedNote = plan.checkpoint.archived ? " (archived generation)" : "";
  const planLine = `${roundLabel(plan.checkpoint.iteration)}${archivedNote}: ${knob.key} ${knob.current} + ${more} → ${plan.totalIter} (--iter is the TOTAL${plan.clamped ? ", reaching the form's ceiling" : ""})`;
  const detail = {
    jobId: job.id,
    jobName: job.name,
    type: job.type,
    checkpoint: { round: plan.checkpoint.iteration, path: plan.checkpoint.path, archived: plan.checkpoint.archived },
    paramKey: plan.paramKey,
    currentIter: knob.current,
    more,
    totalIter: plan.totalIter,
    clamped: plan.clamped,
    lane: lane ? "cluster" : "local",
    fnCont: plan.fnCont,
  };

  const outcome = await startJob(updated, lane ? { remote: lane } : {});
  if (outcome.error) {
    return {
      ok: false,
      summary: `Start refused: ${outcome.error} — the continue plan is written on ${job.name} (${planLine}, fn_cont=${plan.fnCont}) — fix the start problem and fire continue_run again, or clear fn_cont with update_job to abandon the continue`,
      detail,
    };
  }
  if (outcome.busy) {
    return { ok: false, summary: `Busy (${outcome.busyKind}): ${outcome.busy}`, detail };
  }
  if (outcome.waiting) {
    return {
      ok: true,
      summary: `${job.name} is waiting: ${outcome.waiting} — the continue plan is written (${planLine}); it fires when its upstream completes`,
      detail,
    };
  }
  return {
    ok: true,
    summary: `${job.name} continues from ${roundLabel(plan.checkpoint.iteration)}${archivedNote} — its newest complete checkpoint — ${plan.paramKey} ${knob.current} + ${more} → ${plan.totalIter} total (--iter is the TOTAL${plan.clamped ? ", reaching the form's ceiling" : ""}) on ${lane ? "its own cluster lane" : "the local lane"}`,
    detail: { ...detail, status: outcome.job.status, progress: outcome.job.progress },
  };
}

/* ---- stop_job --------------------------------------------------------- */

async function stopJobTool(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.status !== "running") {
    return { ok: false, summary: `${job.name} is not running (status: ${job.status})` };
  }
  const rec = getRun(job.id);
  const outcome = rec?.remote
    ? await remoteStopRun(job.id)
    : await stopRun(job.id);
  return {
    ok: outcome.stopped,
    summary: outcome.stopped
      ? `${job.name} stopped (${outcome.message})`
      : `Stop failed: ${outcome.message}`,
  };
}

/* ---- inspect_job ------------------------------------------------------ */

async function inspectJob(ctx: AgentCtx, jobId: string): Promise<AiToolResult> {
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  const run = getRun(job.id);

  // key non-default params (the honest set the inspector's Overview shows)
  const spec = jobType(job.type);
  const stored = JSON.parse(job.params || "{}") as Record<string, unknown>;
  const nonDefault: Record<string, unknown> = {};
  for (const p of spec?.params ?? []) {
    if (stored[p.key] !== undefined && String(stored[p.key]) !== String(p.default)) {
      nonDefault[p.key] = stored[p.key];
    }
  }

  // log tail (the last ~25 lines of the local mirror)
  let logTail: string[] = [];
  if (run?.logFile && existsSync(run.logFile)) {
    try {
      const text = readFileSync(run.logFile, "utf8");
      logTail = text.split("\n").filter(Boolean).slice(-25);
    } catch {
      /* unreadable log → empty tail */
    }
  }

  const detail: Record<string, unknown> = {
    job: {
      id: job.id,
      type: job.type,
      name: job.name,
      status: job.status,
      progress: job.progress,
      result: truncate(job.result, 300),
      note: truncate(job.note, 200),
      nonDefaultParams: nonDefault,
    },
    run: run
      ? {
          lane: run.remote ? "cluster" : "local",
          ...(run.remote
            ? {
                host: run.remote.host,
                workdir: run.remote.remoteWorkdir,
                slurmId: run.remote.slurmId ?? null,
              }
            : {}),
          done: run.done ?? null,
          exitCode: run.exitCode ?? null,
        }
      : null,
    logTail,
  };

  // classifications carry their class occupancy
  if (job.type === "class2d" || job.type === "class3d") {
    const workdir =
      run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
    const stats = classStatsFromWorkdir(workdir);
    if (stats.classes.length > 0) {
      detail.classes = stats.classes.map((c) => ({
        cls: c.cls,
        particles: c.count,
        fraction: Number((c.fraction * 100).toFixed(1)),
        ...(c.resolution != null ? { resolutionA: c.resolution } : {}),
      }));
      detail.iteration = stats.iteration;
      return {
        ok: true,
        summary: `${job.name} (${job.status}): ${stats.classes.length} classes at iteration ${stats.iteration}, ${stats.total} particles${logTail.length > 0 ? `, log tail available` : ""}`,
        detail,
      };
    }
  }
  return {
    ok: true,
    summary: `${job.name} — ${job.type} (${job.status}${job.status === "completed" && job.result ? `: ${truncate(job.result, 120)}` : ""})`,
    detail,
  };
}

/* ---- get_job_curves (the science read, t486) -------------------------- */

const CURVE_KINDS = [
  "fsc",
  "guinier",
  "angdist",
  "ctf",
  "motion",
  "topaz",
] as const;
type CurveKind = (typeof CURVE_KINDS)[number];

/** ≤12 uniform samples, first and last always kept — the low-res head and
 *  the high-res tail carry the verdict, the middle only carries shape. */
export function sampleSeries<T>(rows: T[], max = 12): T[] {
  if (rows.length <= max) return rows.slice();
  const out: T[] = [];
  for (let i = 0; i < max; i++) {
    out.push(rows[Math.round((i * (rows.length - 1)) / (max - 1))]);
  }
  return out;
}

/* t490 — the rounding rules moved to the shared surface (chart-rows'
 * fmtAngstrom / fmtMicron) so the report's curve family and the tool
 * quote the same digits by construction; these aliases keep the tool
 * face's call sites byte-identical. */
const fmtAng = fmtAngstrom;
const fmtUm = fmtMicron;

/* ---- get_map_landscape --------------------------------------------- */

/** t501 — the agent reads the landscape. The Session QC report's Map QC
 *  inventory has been a paper face (t211), a door family (t213) and a CSV
 *  grid (t232); this is its AGENT face. One walk over the completed
 *  roster in the paper's OWN queue (volume-capable types ride the
 *  front, each tier byRecency, the paper's cap — lib/map-walk keeps
 *  all three honest), the listing from the outputs route's ONE well (lib/relion/outputs-list),
 *  each owner's main map profiled through the map-profile route's own
 *  chain (resolve → pathref-defensive → header → statcache), and every
 *  number worded through qc-report's OWN arithmetic — peakPctOf,
 *  deltaVsWinner, shapeAgreement, localAgreement + weakestBand +
 *  weakestCellOf — so the spoken landscape and the paper's inventory can
 *  never drift (one well; twins fork, imports don't). The winner is the
 *  newest owner whose landscape spoke, and every row (the winner's own
 *  included) reads its r through shapeAgreement against it — the
 *  reference lands at 1.00 the honest way, no special case. Skips speak
 *  their counts: no volume, no workdir, refused profile — silence with
 *  a receipt, never a guess. */
async function getMapLandscape(ctx: AgentCtx): Promise<AiToolResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, summary: "No active project" };
  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
  });
  const completed = jobs.filter((j) => j.status === "completed");
  // The paper's OWN queue (session-report-dialog's walk law, t155/t211):
  // volume-capable types ride the front so the cap lands on real map
  // owners, each tier sorted byRecency — the dialog's three-way
  // comparator (updatedAt desc; the id tiebreak keeps same-instant
  // stamps — a gallery restore writes them all at once — deterministic).
  // A landscape question answered from a different order is a landscape
  // lied about: the winner (the queue's head) MUST be the row the deep
  // report rides.
  const byRecency = (a: (typeof completed)[number], b: (typeof completed)[number]) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const candidates = [
    ...completed.filter((j) => VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
    ...completed.filter((j) => !VOLUME_CAPABLE_RE.test(j.type)).sort(byRecency),
  ].slice(0, MAP_BRIEF_CAP);

  const heard: { jobId: string; jobName: string; main: string; bins: number[] }[] = [];
  let skippedNoWorkdir = 0;
  let skippedNoVolume = 0;
  let skippedRefused = 0;

  for (const job of candidates) {
    const run = getRun(job.id);
    let dirOk = false;
    if (run?.workdir) {
      try {
        dirOk = statSync(run.workdir).isDirectory();
      } catch {
        dirOk = false;
      }
    }
    if (!run?.workdir || !dirOk) {
      skippedNoWorkdir += 1;
      continue;
    }
    const { files } = walkWorkdir(run.workdir);
    const volumes = files.filter((f) => f.kind === "mrc" && Array.isArray(f.dims));
    if (volumes.length === 0) {
      skippedNoVolume += 1;
      continue;
    }
    const sorted = [...volumes].sort(
      (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
    );
    const main = sorted[0];
    const resolved = resolveInsideJobWorkdir(run.workdir, main.path);
    if ("error" in resolved) {
      skippedRefused += 1;
      continue;
    }
    let abs = resolved.abs;
    // pathref markers: engine-written only; maps live in workdirs so this
    // is defensive — the same posture the map-profile route takes.
    if (resolved.name.endsWith(".pathref")) {
      const target = readPathrefTarget(abs);
      if (!target) {
        skippedRefused += 1;
        continue;
      }
      abs = target;
    }
    if (!isMrcPath(path.basename(abs))) {
      skippedRefused += 1;
      continue;
    }
    const header = readMrcHeader(abs);
    if (!header) {
      skippedRefused += 1;
      continue;
    }
    const profiles = cachedCompute(abs, "map-profile:v1", () => readMrcAxisProfiles(abs, header));
    const bins = profiles ? poolProfile(profiles.z) : null;
    if (!Array.isArray(bins) || bins.length === 0) {
      skippedRefused += 1;
      continue;
    }
    heard.push({ jobId: job.id, jobName: job.name, main: main.label ?? main.name, bins });
  }

  if (heard.length === 0) {
    return {
      ok: true,
      summary:
        completed.length === 0
          ? "No completed jobs yet — the landscape is empty."
          : `Walked ${candidates.length} completed candidates (newest first): none holds a readable 3D volume (skipped: ${skippedNoVolume} without a volume, ${skippedNoWorkdir} without an on-disk workdir, ${skippedRefused} with a refused profile).`,
    };
  }

  const winner = heard[0];
  const winnerPct = peakPctNumOf(winner.bins);
  const rows = heard.map((h) => {
    const pct = peakPctNumOf(h.bins);
    const bands = localAgreement(winner.bins, h.bins);
    return {
      jobId: h.jobId,
      job: h.jobName,
      main: h.main,
      peak: peakPctOf(h.bins),
      pct,
      delta: deltaVsWinner(pct, winnerPct),
      r: shapeAgreement(winner.bins, h.bins),
      weakest: weakestCellOf(weakestBand(bands)),
    };
  });
  const outlier = outlierRowIdx(rows.map((r) => ({ peakPct: r.pct })));
  const contested = contestedCrown(rows.map((r) => ({ peakPct: r.pct })));

  const lines: string[] = [];
  lines.push(
    `${rows.length} volume owner${rows.length === 1 ? "" : "s"} (the paper's queue: capable types first, newest within each tier${completed.length > candidates.length ? `, roster capped at ${MAP_BRIEF_CAP}` : ""}). Winner (the queue's head): ${winner.jobName} — main map ${winner.main}, peak ${peakPctOf(winner.bins)} of depth, agreement r 1.00.`,
  );
  for (const r of rows) {
    if (r.jobId === winner.jobId) continue;
    lines.push(
      `${r.job} — main map ${r.main}, peak ${r.peak} of depth (Δ ${r.delta ?? "—"}), agreement r ${r.r != null ? r.r.toFixed(2) : "—"}, weakest ${r.weakest}.`,
    );
  }
  if (contested) {
    lines.push(
      `The crown is contested: ${contested.indices.map((i) => rows[i].job).join(" and ")} share the largest |Δ| (${contested.abs.toFixed(1)}) — no unique outlier, the paper hides its amber edge (t220).`,
    );
  } else if (outlier >= 0) {
    lines.push(`The row farthest from the winner: ${rows[outlier].job} (the paper wears this one amber).`);
  }
  if (skippedNoVolume + skippedNoWorkdir + skippedRefused > 0) {
    lines.push(
      `Skipped honestly: ${skippedNoVolume} without a 3D volume, ${skippedNoWorkdir} without an on-disk workdir, ${skippedRefused} with a refused profile.`,
    );
  }

  return {
    ok: true,
    summary: lines.join(" "),
    detail: {
      winner: { jobId: winner.jobId, job: winner.jobName, main: winner.main },
      owners: rows.map((r) => ({
        jobId: r.jobId,
        job: r.job,
        main: r.main,
        peak: r.peak,
        deltaVsWinner: r.delta,
        shapeR: r.r,
        weakestBand: r.weakest,
      })),
    },
  };
}

/* ---- get_curve_verdicts --------------------------------------------- */

/** One kind's data through the chart-data well (t486) — the same loaders
 *  the routes serve and get_job_curves reads. curveVerdictOf's switch
 *  consumes exactly this union. */
async function loadCurveData(
  kind: CurveKind,
  jobId: string,
): Promise<Parameters<typeof curveVerdictOf>[1]> {
  switch (kind) {
    case "fsc":
      return loadFsc(jobId);
    case "guinier":
      return loadGuinier(jobId);
    case "angdist":
      return loadAngDist(jobId);
    case "ctf":
      return loadCtf(jobId);
    case "motion":
      return loadMotion(jobId);
    case "topaz":
      return loadTopazTraining(jobId);
  }
}

/** t503 — the agent reads the verdicts. The Session QC report's Curve
 *  verdicts table has been a paper face (t494), a door family (t494), a
 *  CSV grid (t498) and a compass pulse (t499); this is its AGENT face —
 *  the same sister-task get_map_landscape (t501) did for the Map QC
 *  inventory. One walk over the completed roster in the paper's OWN
 *  order (newest first — the curve walk never re-queues by volume
 *  capability; that is the MAP walk's law, not this one's) with the
 *  paper's OWN cap (lib/map-walk's MAP_BRIEF_CAP) and the paper's OWN
 *  probe map (lib/curve-walk — one birthplace, two walkers). Each
 *  probe's data comes from the chart-data well (t486: the routes' own
 *  loaders — no HTTP self-fetch, no second derivation) and is worded
 *  through curveVerdictOf BEFORE it travels to the model, so a spoken
 *  verdict and the paper's row are byte-for-byte the same sentence by
 *  construction. An empty body (the workdir holds no such curve) is an
 *  honest skip — counted; a refused read (job gone mid-walk, unreadable
 *  source) marks the walk wounded and the walk goes on — partial truth
 *  over silence, the t211 doctrine the dialog itself obeys. The curve
 *  column speaks the paper's own word (CURVE_KIND_LABELS — never a raw
 *  token), the same dialect the CSV grid (t498) already speaks. No
 *  fan-out here on purpose: the client walks learned to run (t496/t497)
 *  because wire round-trips bill per-RTT; the server walk drinks from
 *  local disk through one loader call — the slowest-probe bill doesn't
 *  apply, and a sequential loop keeps the walk order trivially the
 *  paper's order. */
async function getCurveVerdicts(ctx: AgentCtx): Promise<AiToolResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, summary: "No active project" };
  const jobs = await db.job.findMany({
    where: { projectId: ctx.projectId },
  });
  const completed = jobs.filter((j) => j.status === "completed");
  // The paper's OWN order (session-report-dialog's byRecency law):
  // newest first as a real three-way comparator — updatedAt desc, the
  // id tiebreak keeps same-instant stamps (a gallery restore writes
  // them all at once) deterministic.
  const byRecency = (a: (typeof completed)[number], b: (typeof completed)[number]) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const candidates = [...completed].sort(byRecency).slice(0, MAP_BRIEF_CAP);

  const rows: { jobId: string; job: string; curve: string; verdict: string }[] = [];
  let skippedEmpty = 0;
  let refused = 0;

  for (const job of candidates) {
    for (const kind of probesForType(job.type)) {
      try {
        const d = await loadCurveData(kind, job.id);
        const verdict = curveVerdictOf(kind, d);
        if (!verdict) {
          skippedEmpty += 1; // this workdir holds no such curve — the walk goes on
          continue;
        }
        rows.push({ jobId: job.id, job: job.name, curve: CURVE_KIND_LABELS[kind], verdict });
      } catch {
        refused += 1; // this probe's data refused — the walk goes on, wounded
      }
    }
  }

  const wounded = refused > 0;
  const capped = completed.length > candidates.length;

  if (rows.length === 0) {
    return {
      ok: true,
      summary:
        completed.length === 0
          ? "No completed jobs yet — no curve has spoken."
          : `Walked ${candidates.length} completed candidates (newest first): no curve spoke (${skippedEmpty} probes answered empty, ${refused} refused${wounded ? " — the walk went on wounded" : ""}).`,
      detail: {
        roster: candidates.length,
        verdicts: [],
        skippedEmpty,
        refused,
        wounded,
      },
    };
  }

  const lines: string[] = [];
  lines.push(
    `${rows.length} curve verdict${rows.length === 1 ? "" : "s"} (the paper's walk: completed roster, newest first${capped ? `, roster capped at ${MAP_BRIEF_CAP}` : ""}) — each row is the Curve verdicts table's own wording, byte for byte.`,
  );
  for (const r of rows) {
    lines.push(`${r.job} — ${r.curve}: ${r.verdict}`);
  }
  const parts: string[] = [];
  if (skippedEmpty > 0) parts.push(`${skippedEmpty} probes answered empty (the workdir holds no such curve)`);
  if (refused > 0) parts.push(`${refused} probes refused (the walk went on wounded)`);
  if (parts.length > 0) lines.push(`Skipped honestly: ${parts.join("; ")}.`);

  return {
    ok: true,
    summary: lines.join(" "),
    detail: {
      roster: candidates.length,
      verdicts: rows.map((r) => ({
        jobId: r.jobId,
        job: r.job,
        curve: r.curve,
        verdict: r.verdict,
      })),
      skippedEmpty,
      refused,
      wounded,
    },
  };
}

/** t504 — the session's time, read from the same well the Gantt drinks
 *  (lib/timeline-walk): honest windows only ([startedAt → +duration], a
 *  live run stretching to now), the bars' own chronological order, and
 *  every aggregate pre-computed as a READ — a time question is never
 *  arithmetic from receipts (a duration without startedAt is half a
 *  truth; updatedAt is not a window). Human words come from the
 *  inspector's own fmtDuration — same dialect, two faces. */
/* ---- get_sweep_verdict --------------------------------------------- */

/** t508 — the sweep verdict's AGENT face. The race is client session
 *  memory (in-memory by design, a reload is a new session), so the
 *  answer quotes what the client's request handed over (ctx.sweep,
 *  already boundary-guarded by parseSweepSnapshot) and words it through
 *  the paper's OWN builder — the md the report binds, byte for byte.
 *  The summary is a LOCATOR (counts + winner name looked up by id),
 *  never a re-derivation of the verdict arithmetic: parsing or
 *  re-computing your own export is a second derivation waiting to
 *  drift. No race on record → the report's own empty-state dialect
 *  (one race, one sentence, two faces). */
function getSweepVerdict(ctx: AgentCtx): AiToolResult {
  const sweep = ctx.sweep;
  if (!sweep || sweep.rows.length === 0) {
    return {
      ok: true,
      summary:
        "No scheduling sweep has run in this session yet — open the HPC queue panel and run Compare profiles; the winner's verdict will be bound here and in the session report verbatim.",
    };
  }
  const measured = sweep.rows.filter((r) => r.r).length;
  const failed = sweep.rows.length - measured;
  const winnerName = sweep.bestId
    ? (sweep.rows.find((r) => r.p.id === sweep.bestId)?.p.name ?? null)
    : null;
  return {
    ok: true,
    summary: `The session's last sweep: ${sweep.rows.length} profiles (${measured} measured${failed > 0 ? `, ${failed} failed` : ""})${winnerName ? `, winner: ${winnerName}` : ""} — the annex below is the session report's own words, byte for byte.`,
    detail: { sweep_report_md: buildSweepReport(sweep.rows, sweep.bestId) },
  };
}

/* ---- get_storage_report -------------------------------------------- */

/** t511 — how many run rows the tool's annex carries. The dialog can
 *  scroll; an annex is read top to bottom — the heaviest twenty name
 *  every whale a project of this app's size grows, and the summary
 *  always speaks the FULL row count, so a capped annex says so instead
 *  of pretending it showed everyone. */
const STORAGE_TOOL_JOB_CAP = 20;

/** t511 — the storage overview's AGENT face. The well is the paper's
 *  own: computeStorageReport is the EXACT assembly the Storage route
 *  serves (lifted verbatim into lib/relion/storage-report — twins fork,
 *  imports don't), so the annex is the dialog's ledger byte for byte:
 *  raw digits (fmtBytes is the summary's human voice, the one formatter
 *  the app already taught), orphans visible, truncation flagged. The
 *  summary is a LOCATOR (totals + the heaviest row looked up in the
 *  pre-sorted rows — never a re-sorted, re-summed, re-derived twin).
 *  Read-only by law: naming a whale is the tool's job, cleaning it is
 *  the dialog's Clean door's. */
async function getStorageReport(ctx: AgentCtx): Promise<AiToolResult> {
  let report: StorageResponse | null = null;
  try {
    report = await computeStorageReport(ctx.projectId);
  } catch {
    report = null;
  }
  if (!report) {
    return {
      ok: false,
      summary:
        "No storage ledger could be walked for this project — the project row or its run directory is gone. Open the Project storage overview from the header to see what the dialog itself reports.",
    };
  }
  if (!report.hasRuns || report.jobs.length === 0) {
    return {
      ok: true,
      summary:
        "This project has never run a job — its run directory holds no bytes yet. The storage ledger starts writing the moment the first job runs.",
      detail: {
        jobsShown: 0,
        jobsTotal: report.jobs.length,
        storage: report,
      },
    };
  }
  const heaviest = report.jobs[0]; // rows arrive pre-sorted, heaviest first
  const orphans = report.jobs.filter((j) => j.type === "orphan").length;
  const shown = report.jobs.slice(0, STORAGE_TOOL_JOB_CAP);
  return {
    ok: true,
    summary: `${report.projectName} weighs ${fmtBytes(report.totalBytes)} across ${report.jobs.length} run ${report.jobs.length === 1 ? "directory" : "directories"} (${report.totalFiles} files)${orphans > 0 ? `, ${orphans} orphaned ${orphans === 1 ? "directory" : "directories"} included` : ""}${report.truncated ? " — the walk hit its entry cap and says so" : ""}. Heaviest: ${heaviest.name} at ${fmtBytes(heaviest.bytes)} (${heaviest.type}). The annex below is the walk's own ledger — raw digits, the Storage dialog drinks the same cup.`,
    // the honesty fields ride FIRST: the tool card's detail window is a
    // 4,000-character pane (t510), and a cap marker buried at the tail of
    // a 27k-character annex is a cap nobody ever sees — the pane's first
    // line must teach the cut before the rows begin.
    detail: {
      jobsShown: shown.length,
      jobsTotal: report.jobs.length,
      storage: {
        ...report,
        jobs: shown,
      },
    },
  };
}

async function getSessionTimeline(ctx: AgentCtx): Promise<AiToolResult> {
  const active = await getActiveProject();
  if (!active) return { ok: false, summary: "No active project" };
  // Sequential on purpose (t503's doctrine keeps its slice honest): two
  // indexed reads of a local db gain nothing from fan-out, and the walk
  // defines its OWN order (start, then name) — no db default rides in.
  const jobs = await db.job.findMany({ where: { projectId: ctx.projectId } });
  const workspaces = await db.workspace.findMany({ where: { projectId: ctx.projectId } });
  const wsName = new Map(workspaces.map((w) => [w.id, w.name]));
  const walk = walkTimeline(
    jobs.map((j) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      status: j.status,
      workspace: (j.workspaceId ? wsName.get(j.workspaceId) : undefined) ?? "Main",
      startedAt: j.startedAt, // Date | null — the well converts, never guesses
      duration: j.duration,
    })),
    Date.now(),
  );

  const iso = (ms: number): string => new Date(ms).toISOString();

  if (walk.rows.length === 0) {
    return {
      ok: true,
      summary:
        jobs.length === 0
          ? "No jobs on the canvas yet — nothing to time."
          : `No runs yet — ${walk.neverStarted} job${walk.neverStarted === 1 ? "" : "s"} the engine never started; the timeline waits for its first window.`,
      detail: {
        window: null,
        runs: [],
        longest: [],
        busyMs: 0,
        running: [],
        failed: 0,
        neverStarted: walk.neverStarted,
      },
    };
  }

  const human = (ms: number): string => fmtDuration(ms);
  // t505 — the busy total and the leaders' order moved into the well
  // (timelineLedger): the report's glance drinks the same arithmetic,
  // and twins fork, imports don't. The numbers are byte-for-byte the
  // ones the t504 executor computed by hand.
  const { busyMs, leaders } = timelineLedger(walk.rows);
  const runRows = walk.rows.map((r) => ({
    jobId: r.job.id,
    name: r.job.name,
    type: r.job.type,
    workspace: r.job.workspace,
    status: r.job.status,
    startedAt: iso(r.start),
    endedAt: r.job.status === "running" ? null : iso(r.end),
    durationMs: r.ms,
    durationHuman: human(r.ms),
    sharePct: timelineSharePct(r.ms, walk.span), // t506 — one arithmetic, the CSV drinks it too
  }));
  const longest = leaders
    .slice(0, 3)
    .map((r) => ({ jobId: r.job.id, name: r.job.name, ms: r.ms, human: human(r.ms) }));
  const runningRows = walk.rows
    .filter((r) => r.job.status === "running")
    .map((r) => ({ jobId: r.job.id, name: r.job.name, elapsedMs: r.ms, elapsedHuman: human(r.ms) }));
  const failed = walk.rows.filter((r) => r.job.status === "failed").length;

  const head = `${walk.rows.length} run${walk.rows.length === 1 ? "" : "s"} across ${human(walk.span)} (first start → last end: ${iso(walk.t0)} → ${iso(walk.t0 + walk.span)}) — the bars' own windows, chronological.`;
  const longestLine = `Longest: ${longest.map((l) => `${l.name} ${l.human}`).join(" · ")}.`;
  const busyLine = `Busy total ${human(busyMs)} (windows summed — parallel runs double-count).`;
  const liveLine =
    runningRows.length > 0 ? ` ${runningRows.length} still running (the window stretches to now).` : "";
  const failLine =
    failed > 0
      ? ` ${failed} failed run${failed === 1 ? "" : "s"} keep their windows — time spent failing is real time.`
      : "";
  const absentLine =
    walk.neverStarted > 0
      ? ` ${walk.neverStarted} job${walk.neverStarted === 1 ? " has" : "s have"} no window (never started) — counted, not invented.`
      : "";

  return {
    ok: true,
    summary: `${head} ${longestLine} ${busyLine}${liveLine}${failLine}${absentLine}`,
    detail: {
      window: {
        startedAt: iso(walk.t0),
        endedAt: iso(walk.t0 + walk.span),
        spanMs: walk.span,
        spanHuman: human(walk.span),
      },
      runs: runRows,
      longest,
      busyMs,
      busyHuman: human(busyMs),
      running: runningRows,
      failed,
      neverStarted: walk.neverStarted,
    },
  };
}

async function getJobCurves(
  ctx: AgentCtx,
  jobId: string,
  kinds?: string[]
): Promise<AiToolResult> {
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  const want = kinds && kinds.length > 0 ? kinds : [...CURVE_KINDS];
  const unknown = want.filter(
    (k) => !(CURVE_KINDS as readonly string[]).includes(k)
  );
  if (unknown.length > 0) {
    return {
      ok: false,
      summary: `Unknown curve kind: ${unknown.join(", ")} — kinds are ${CURVE_KINDS.join(", ")}`,
    };
  }

  const curves: Record<string, unknown>[] = [];
  const spoken: string[] = [];

  if (want.includes("fsc")) {
    try {
      const d = await loadFsc(job.id);
      if (d.shells.length > 0) {
        spoken.push(
          `FSC 0.143 at ${fmtAng(d.resolutionAt143)}` +
            (d.resolutionAt05 != null ? ` (0.5 at ${fmtAng(d.resolutionAt05)})` : "") +
            (d.reportedResolution != null
              ? `, RELION reports ${fmtAng(d.reportedResolution)}` +
                // t493 — the same passport the paper quotes (one
                // compression birthplace: chart-rows' reportedPassport),
                // so the spoken line and the verdict row never drift
                (reportedPassport(d.reportedLabel)
                  ? ` — ${reportedPassport(d.reportedLabel)}`
                  : "")
              : "")
        );
        curves.push({
          kind: "fsc",
          renderable: true,
          source: d.source,
          sourceFile: d.sourceFile,
          shellCount: d.shells.length,
          resolutionAt143: d.resolutionAt143,
          resolutionAt05: d.resolutionAt05,
          reportedResolution: d.reportedResolution,
          reportedLabel: d.reportedLabel,
          ...(d.postprocessGeneral
            ? { postprocessGeneral: d.postprocessGeneral }
            : {}),
          sampledShells: sampleSeries(d.shells).map((s) => ({
            res: Math.round(s.res * 10) / 10,
            fsc: s.fsc,
            ...(s.correctedFsc != null ? { correctedFsc: s.correctedFsc } : {}),
          })),
        });
      } else {
        spoken.push("FSC: none in the workdir");
        curves.push({
          kind: "fsc",
          renderable: false,
          reason:
            "no FSC source in this job's workdir (a 3D reconstruction or a postprocess writes one; 2D classifications have none)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "fsc",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("FSC: unreadable");
    }
  }

  if (want.includes("guinier")) {
    try {
      const d = await loadGuinier(job.id);
      if (d.points.length > 0) {
        spoken.push(
          `Guinier ${d.points.length} pts` +
            (d.bfactor != null ? `, B-factor ${d.bfactor.toFixed(1)} Å² (used for sharpening)` : "")
        );
        curves.push({
          kind: "guinier",
          renderable: true,
          sourceFile: d.sourceFile,
          pointCount: d.points.length,
          bfactor: d.bfactor,
          sampledPoints: sampleSeries(d.points, 8).map((p) => ({
            x: p.x,
            lnAmp: p.lnAmp,
          })),
        });
      } else {
        spoken.push("Guinier: none in the workdir");
        curves.push({
          kind: "guinier",
          renderable: false,
          reason:
            "no Guinier table in this job's workdir (a PostProcess job writes one)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "guinier",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("Guinier: unreadable");
    }
  }

  if (want.includes("angdist")) {
    try {
      const d = await loadAngDist(job.id);
      if (d.total > 0) {
        // t489 — the verdict, the rounded concentration and the hottest
        // three are BUILT in the well (interpretAngDist): the panel's
        // strip renders the very same judgment this face quotes
        const interp = d.interpretation;
        const verdict = interp?.verdict ?? "fairly even";
        const concentration = interp?.concentration ?? Math.round(d.anisotropy * 10) / 10;
        spoken.push(
          `angles: ${d.total} particles over ${d.occupied}/${d.rotBins * d.tiltBins} direction bins, concentration ${concentration} (${verdict})`
        );
        curves.push({
          kind: "angdist",
          renderable: true,
          starFile: d.starFile,
          iteration: d.iteration,
          total: d.total,
          rotBins: d.rotBins,
          tiltBins: d.tiltBins,
          occupied: d.occupied,
          hottest: d.max,
          anisotropy: d.anisotropy,
          anisotropyVerdict: verdict,
          symmetry: d.symmetry,
          hottestBins: interp?.hottestBins ?? [],
        });
      } else {
        spoken.push("angles: none in the workdir");
        curves.push({
          kind: "angdist",
          renderable: false,
          reason:
            "no particle-angle star in this job's workdir yet (a 3D classify/refine writes run_data.star or run_itXXX_data.star)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "angdist",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("angles: unreadable");
    }
  }

  if (want.includes("ctf")) {
    try {
      const d = await loadCtf(job.id);
      const s = d.summary;
      if (s) {
        spoken.push(
          `CTF fit: ${s.count} micrographs, mean defocus ${fmtUm(s.meanDefocus)}` +
            ` (range ${fmtUm(s.minDefocus)} to ${fmtUm(s.maxDefocus)})` +
            `, worst astigmatism ${fmtUm(s.maxAstigmatism)}` +
            `, mean FoM ${Math.round(s.meanFom * 100) / 100}` +
            `, worst fit resolution ${fmtAng(s.worstResolution)}`
        );
        curves.push({
          kind: "ctf",
          renderable: true,
          micrographCount: s.count,
          meanDefocusUm: Math.round(s.meanDefocus * 1000) / 1000,
          minDefocusUm: Math.round(s.minDefocus * 1000) / 1000,
          maxDefocusUm: Math.round(s.maxDefocus * 1000) / 1000,
          maxAstigmatismUm: Math.round(s.maxAstigmatism * 1000) / 1000,
          meanFom: Math.round(s.meanFom * 100) / 100,
          worstFitResolutionA: s.worstResolution > 0 ? s.worstResolution : null,
          // the worst-fitting micrographs first (fit resolution, largest
          // first) — built in the well (interpretCtf, t488): the panel's
          // strip renders the very same three rows
          worstMicrographs: d.interpretation?.worstMicrographs ?? [],
        });
      } else {
        spoken.push("CTF fit: none in the workdir");
        curves.push({
          kind: "ctf",
          renderable: false,
          reason:
            "no micrographs_ctf.star in this job's workdir (a CtfFind job writes one; a MotionCorr job estimates drift instead — try kind motion)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "ctf",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("CTF fit: unreadable");
    }
  }

  if (want.includes("motion")) {
    try {
      const d = await loadMotion(job.id);
      const s = d.summary;
      if (s) {
        // the route's own triage split, read as facts: which half of the
        // movie the drift accumulates in — no threshold is invented.
        // t488: the triage and the worst three are BUILT in the well
        // (interpretMotion) — the tool quotes them, the panel renders them
        const interp = d.interpretation;
        const triage = interp?.driftTriage ?? "even split";
        spoken.push(
          `motion: ${s.count} micrographs, mean total drift ${fmtAng(s.meanTotal)}, worst ${fmtAng(s.maxTotal)} (${s.worstName ?? "?"}) — ${triage}`
        );
        curves.push({
          kind: "motion",
          renderable: true,
          sourceFile: d.sourceFile,
          micrographCount: s.count,
          meanTotalA: Math.round(s.meanTotal * 10) / 10,
          maxTotalA: Math.round(s.maxTotal * 10) / 10,
          worstName: s.worstName,
          meanEarlyA: Math.round(s.meanEarly * 10) / 10,
          meanLateA: Math.round(s.meanLate * 10) / 10,
          driftTriage: triage,
          worstMicrographs: interp?.worstMicrographs ?? [],
        });
      } else {
        spoken.push("motion: none in the workdir");
        curves.push({
          kind: "motion",
          renderable: false,
          reason:
            "no corrected_micrographs.star in this job's workdir (a MotionCorr job writes one; a CtfFind job measures fit quality instead — try kind ctf)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "motion",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("motion: unreadable");
    }
  }

  if (want.includes("topaz")) {
    try {
      const d = await loadTopazTraining(job.id);
      if (d.epochs.length > 0) {
        const first = d.epochs[0];
        const last = d.epochs[d.epochs.length - 1];
        const fmtNum = (v: number | null): string =>
          v == null || !Number.isFinite(v) ? "?" : String(Math.round(v * 1e4) / 1e4);
        spoken.push(
          `topaz training: ${d.epochs.length} epochs (from ${d.source ?? "?"}), train loss ${fmtNum(first.trainLoss)} → ${fmtNum(last.trainLoss)}` +
            (last.precision != null || last.recall != null
              ? `, last epoch precision ${fmtNum(last.precision)} / recall ${fmtNum(last.recall)}`
              : "")
        );
        // t488 — first/last epochs come from the well (interpretTopaz) so
        // the panel's strip quotes the same pair the tool carries
        curves.push({
          kind: "topaz",
          renderable: true,
          source: d.source,
          epochCount: d.epochs.length,
          firstEpoch: d.interpretation?.firstEpoch ?? {
            it: first.it,
            trainLoss: first.trainLoss,
            testLoss: first.testLoss,
            precision: first.precision,
            recall: first.recall,
          },
          lastEpoch: d.interpretation?.lastEpoch ?? {
            it: last.it,
            trainLoss: last.trainLoss,
            testLoss: last.testLoss,
            precision: last.precision,
            recall: last.recall,
          },
          sampledEpochs: sampleSeries(d.epochs, 8).map((e) => ({
            it: e.it,
            trainLoss: e.trainLoss,
            testLoss: e.testLoss,
            precision: e.precision,
            recall: e.recall,
          })),
        });
      } else {
        spoken.push("topaz training: none in the workdir");
        curves.push({
          kind: "topaz",
          renderable: false,
          reason:
            "no topaz training log in this job's workdir (a Topaz train job leaves one in run.out or a training-named file; other jobs have none)",
        });
      }
    } catch (err) {
      if (err instanceof ChartJobNotFound)
        return { ok: false, summary: `Job not found: ${jobId}` };
      curves.push({
        kind: "topaz",
        renderable: false,
        reason: `failed to read: ${truncate(err instanceof Error ? err.message : String(err), 120)}`,
      });
      spoken.push("topaz training: unreadable");
    }
  }

  return {
    ok: true,
    summary: `Curves of "${job.name}" (${job.type}): ${spoken.join("; ")}`,
    detail: { jobId: job.id, curves },
  };
}

/* ---- judge_2d_classes (the VLM tool) ---------------------------------- */

async function judge2dClasses(
  ctx: AgentCtx,
  jobId: string,
  question?: string
): Promise<AiToolResult> {
  const job = await findJobInProject(jobId, ctx.projectId);
  if (!job) return { ok: false, summary: `Job not found: ${jobId}` };
  if (job.type !== "class2d") {
    return {
      ok: false,
      summary: `judge_2d_classes works on class2d jobs — ${job.name} is ${job.type}. For 3D maps use inspect_job + the FSC/resolution data it carries.`,
    };
  }
  const assistant = resolveAssistant();
  if (!assistant) {
    return { ok: false, summary: "The AI provider is not configured (settings → AI provider) — configure one, then ask again" };
  }

  const run = getRun(job.id);
  const workdir = run?.workdir ?? path.join(RELION_DIR, job.projectId, `${job.type}_${job.id.slice(-8)}`);
  if (!existsSync(workdir)) {
    return { ok: false, summary: `${job.name} has no results yet (status ${job.status}) — run it first` };
  }

  const stats = classStatsFromWorkdir(workdir);
  if (!stats.stackFile || stats.classes.length === 0) {
    return {
      ok: false,
      summary: `${job.name} has no class averages in its workdir yet (iteration ${stats.iteration ?? "none"}) — wait for the run to finish or check its results`,
    };
  }

  // the image — local mirror first, cluster pull when the stack stayed remote
  let stackAbs = path.join(workdir, stats.stackFile);
  if (!existsSync(stackAbs) && run?.remote) {
    const pulled = await fetchRemoteFileIntoWorkdir(run, stats.stackFile);
    if (!pulled.ok) {
      return {
        ok: false,
        summary: `The class stack stayed on the cluster and the pull failed: ${truncate(pulled.error, 200)}`,
      };
    }
  }
  if (!existsSync(stackAbs)) {
    return { ok: false, summary: `Class stack ${stats.stackFile} is not readable on this machine` };
  }
  const sheet = await renderClassSheetPng(stackAbs);
  if (!sheet) {
    return { ok: false, summary: `Could not render ${stats.stackFile} to an image (unreadable MRC?)` };
  }

  // the numbers that ride with the image
  const table = stats.classes
    .map(
      (c) =>
        `class ${c.cls}: ${(c.fraction * 100).toFixed(1)}% (${c.count} particles)${c.resolution != null ? `, estimated resolution ${c.resolution} Å` : ", resolution unknown"}`
    )
    .join("\n");
  const prompt = `You are a senior cryo-EM scientist judging 2D class averages from a RELION 2D classification (iteration ${stats.iteration ?? "?"}, ${stats.total} particles total, ${sheet.rendered} classes shown in the image, left-to-right / top-to-bottom order = class number).

Per-class statistics (class number = grid cell order):
${table}
${question ? `\nThe user asks: ${question}` : ""}

Judge each class: crisp internal structure + strong signal (α-helices, β-sheets, clear boundaries) = "keep"; decent but ambiguous = "maybe"; blurry / junk / ice / carbon / empty = "reject". Small classes can still be good; huge classes that are featureless blobs are reject. Weigh the resolution estimates: lower Å is better when present.

Answer with ONLY a JSON object:
{"classes":[{"cls":1,"verdict":"keep|maybe|reject","reason":"<short>"}],"advice":"<2-3 sentences: overall data quality + which classes to take forward and why>"}`;

  const analysis = await visionOnce({
    flavor: assistant.flavor,
    apiKey: assistant.apiKey,
    model: assistant.vlmModel,
    baseUrl: assistant.baseUrl,
    prompt,
    imageBase64: sheet.png.toString("base64"),
  });

  const verdict = parseJudgeVerdict(analysis);
  const keepCount = verdict ? verdict.classes.filter((c) => c.verdict === "keep").length : 0;
  const maybeCount = verdict ? verdict.classes.filter((c) => c.verdict === "maybe").length : 0;
  return {
    ok: true,
    summary: `Judged ${verdict?.classes.length ?? stats.classes.length} classes of ${job.name} (iteration ${stats.iteration ?? "?"}): ${keepCount} keep / ${maybeCount} maybe — ${truncate(verdict?.advice ?? analysis, 300)}`,
    detail: {
      iteration: stats.iteration,
      judgedClasses: verdict?.classes ?? null,
      advice: verdict?.advice ?? analysis,
      rawAnalysis: verdict ? analysis : undefined,
      classStats: stats.classes,
      nextStep: verdict
        ? `Call select_classes({job_id:"${job.id}", classes:[${verdict.classes.filter((c) => c.verdict === "keep").map((c) => c.cls).join(",")}]}) to wire the selection (confirm with the user first)`
        : undefined,
    },
  };
}

/* ---- select_classes --------------------------------------------------- */

async function selectClasses(ctx: AgentCtx, args: Record<string, unknown>): Promise<AiToolResult> {
  const jobId = String(args.job_id ?? "");
  const targetType =
    args.target_type === "initialmodel" || args.target_type === "class3d" || args.target_type === "refine3d"
      ? (args.target_type as string)
      : "select2d";
  const classes = Array.isArray(args.classes)
    ? args.classes.map((c) => Number(c)).filter((c) => Number.isInteger(c) && c > 0 && c <= 10000)
    : [];
  if (classes.length === 0) {
    return { ok: false, summary: "classes must be a non-empty list of class numbers" };
  }
  const source = await findJobInProject(jobId, ctx.projectId);
  if (!source || !(source.type === "class2d" || source.type === "class3d")) {
    return { ok: false, summary: `${jobId} is not a classification job of this project` };
  }
  const unique = [...new Set(classes)].sort((a, b) => a - b);
  const spec = jobType(targetType);
  if (!spec) return { ok: false, summary: `Unknown target type: ${targetType}` };

  // the source's workspace keeps the chain together
  let workspaceId = source.workspaceId ?? null;
  if (!workspaceId) {
    const first = await db.workspace.findFirst({
      where: { projectId: ctx.projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    workspaceId = first?.id ?? (await ensureDefaultWorkspace(ctx.projectId));
  }
  const count = await db.job.count({ where: { projectId: ctx.projectId, type: targetType } });

  const storedParams: Record<string, unknown> = {
    ...defaultParams(targetType),
    classStarSelection: { jobId: source.id, classes: unique },
  };
  const job = await db.job.create({
    data: {
      projectId: ctx.projectId,
      workspaceId,
      type: targetType,
      name: `${spec.label} ${count + 1}`,
      x: source.x + CARD_W + 100,
      y: source.y + Math.round(Math.random() * 40 - 20),
      params: JSON.stringify(storedParams),
      duration: spec.duration,
    },
  });
  const duplicate = await db.edge.findUnique({
    where: { fromJobId_toJobId: { fromJobId: source.id, toJobId: job.id } },
  });
  if (!duplicate) {
    await db.edge.create({
      data: { projectId: ctx.projectId, fromJobId: source.id, toJobId: job.id },
    });
  }
  return {
    ok: true,
    summary: `Created ${job.name} [${job.id}] selecting classes ${unique.join(", ")} from ${source.name} (the per-class stars auto-join on dispatch)`,
    detail: { jobId: job.id, type: targetType, classes: unique },
  };
}
