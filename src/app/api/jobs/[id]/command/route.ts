import { NextRequest, NextResponse } from "next/server";
import { findEffectiveJob } from "@/lib/link";
import { lineageFor } from "@/lib/relion/dispatch";
import {
  buildArgv,
  resolveInputs,
  workdirFor,
  type EngineJobRef,
} from "@/lib/relion/engine";
import { detectRelion } from "@/lib/relion/system";
import {
  COMMAND_TEMPLATES,
  ENGINE_NATIVE_TYPES,
} from "@/lib/relion/command-templates";
// Task 179: shellJoin moved to pipeline-script.ts — one quoting
// implementation, two consumers (this preview and the project replay
// script). Same rule, same behavior, single source of truth.
import { shellJoin } from "@/lib/relion/pipeline-script";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/command — the launch contract, read-only.
 *
 * Task 170: a never-run job's inspector section used to render NOTHING —
 * the recorded argv (outputs API's `cmd`) only exists after a spawn, so
 * the single most common question an idle job's card begs ("what will
 * launching this actually run?") had no answer anywhere. This route
 * answers it in three honest tiers:
 *
 *   1. engine-native types (import/manualpick/select/…) → the template's
 *      "engine-native: …" description verbatim (runRealJob's native
 *      branch is the executor; there is no argv to render).
 *   2. CLI types with resolvable inputs → the REAL argv, built by the
 *      SAME buildArgv the local runner and the sbatch dry-run use
 *      (paths substituted, exec resolution included). Rendered, not run.
 *   3. CLI types whose inputs are missing/waiting (or RELION undetected)
 *      → the engine's own actionable message + the canonical template
 *      as the fallback contract.
 *
 * THE READ-ONLY CONTRACT (probe-pinned): no mkdirSync, no spawn, no
 * state writes — previewing a command must never create the workdir it
 * names (runRealJob's mkdirSync is a launch side effect, not a preview
 * one; a preview that litters disk is a leak with a UI face).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const template = COMMAND_TEMPLATES[job.type] ?? null;
    const ref: EngineJobRef = {
      id: job.id,
      projectId: job.projectId,
      type: job.type,
      params: JSON.parse(JSON.stringify(job.params ?? {})) as Record<
        string,
        number | string | boolean
      >,
    };

    // ---- tier 1: engine-native --------------------------------------
    if (ENGINE_NATIVE_TYPES.has(job.type)) {
      return NextResponse.json({
        jobId: job.id,
        jobType: job.type,
        native: true,
        template,
        workdir: workdirFor(ref),
      });
    }

    // ---- RELION presence (cache-backed — no full host sweep) ---------
    const status = await detectRelion();
    if (!status.found || !status.path) {
      return NextResponse.json({
        jobId: job.id,
        jobType: job.type,
        native: false,
        error:
          "RELION not detected — install it (or expose it in WSL) and press Re-detect in the top bar; multiple installs are switchable there",
        template,
        workdir: workdirFor(ref),
      });
    }

    // ---- tier 2/3: inputs resolve → argv; else the honest wait -------
    const upstream = await lineageFor(job.id);
    const resolved = resolveInputs(job.type, upstream, ref.params);
    if (resolved.missing) {
      return NextResponse.json({
        jobId: job.id,
        jobType: job.type,
        native: false,
        missing: resolved.missing,
        ...(resolved.wait ? { wait: resolved.wait } : {}),
        template,
        workdir: workdirFor(ref),
      });
    }

    const ctx = {
      binDir: status.path,
      workdir: workdirFor(ref),
      inputs: resolved.inputs,
      job: ref,
      upstream,
      // WSL-bridge hosts preview the native-resolution argv (bridge null):
      // the exec resolution inside buildArgv is the only bridge-sensitive
      // piece, and this sandbox world runs native. Documented honest edge.
      bridge: null,
    } as unknown as Parameters<typeof buildArgv>[0];

    const built = await buildArgv(ctx);
    if (!Array.isArray(built)) {
      const err = built as { error: string };
      return NextResponse.json({
        jobId: job.id,
        jobType: job.type,
        native: false,
        error: err.error,
        template,
        workdir: workdirFor(ref),
      });
    }

    const argv = built as string[];
    return NextResponse.json({
      jobId: job.id,
      jobType: job.type,
      native: false,
      argv,
      command: shellJoin(argv),
      template,
      workdir: workdirFor(ref),
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/command failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
