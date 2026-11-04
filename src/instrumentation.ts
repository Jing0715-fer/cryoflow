/**
 * CryoFlow — boot instrumentation (t427).
 *
 * The dev server compiles routes ON DEMAND: after every restart, the first
 * visit to each route pays its module graph's compile — seconds for the
 * heavy API routes (the jobs sweep drags engine.ts + dispatch + the whole
 * remote SSH graph; the log tail drags the engine). The user's field
 * report: 「每次重启后好像首次log加载需要很久，即使是本地的项目」 —
 * the log tab's spinner sat through that compile on the first poll after
 * every restart, even for purely local projects.
 *
 * register() runs once per server process, BEFORE the first user request —
 * the perfect moment to warm the hot routes in the BACKGROUND: by the
 * time the browser lands, the on-demand compile has already happened (or
 * is well underway) and the first REAL visit is served from the warm
 * cache. Production servers are precompiled and simply pay four cheap
 * self-requests that double as a boot smoke test.
 *
 * Fire-and-forget ON PURPOSE: register() must never delay the listener —
 * the warmer retries quietly until the server accepts connections, then
 * walks the hot route list sequentially (parallel hits would contend for
 * the same compile workers anyway).
 *
 * The Origin header satisfies the http-guard's same-origin door
 * (server-side fetch carries no Sec-Fetch-* metadata — without it the
 * guarded routes would 403 the warmer; see lib/http-guard.ts).
 *
 * t637 — THIS FILE MUST COMPILE CLEAN FOR THE EDGE RUNTIME. Next loads
 * instrumentation.ts in BOTH runtimes, and the edge bundler follows
 * dynamic imports STATICALLY: a literal `await import("@/lib/...")`
 * inside this file drags the whole Node graph (engine + ssh + prisma)
 * into an edge bundle that can never compile. The runtime guard above
 * protects EXECUTION, not COMPILATION. The live bill for ignoring this
 * (t636's 「慢不是挂」three-judge verdict, root-caused here): every
 * request re-attempted the doomed edge compile — ~570ms of "compile:"
 * overhead on EVERY route hit (verified: three consecutive requests with
 * ZERO filesystem writes between them, inotify silent), ~48 node-module
 * errors re-emitted per request, 23,177 errors in the first 30 minutes
 * of a fresh boot (53MB / 608k lines of log fire), and warmup routes
 * never staying compiled. The fix by construction: this file imports
 * NOTHING except fetch + timers, so both runtime bundles are trivially
 * compilable. The reaper and the judge worker mount through their
 * DEFENSIVE paths instead — warmBoot's first fetches hit the routes
 * that mount them (jobs GET → ensureGlobalReconciler; the judge status
 * route → ensureJudgeWorker), so boot-time mounting is preserved, just
 * routed through a graph the edge bundler never sees.
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  void warmBoot();
}

/**
 * t533 — the global reaper story, post-t637: it mounts through the jobs
 * GET route's defensive call (ensureGlobalReconciler, jobs/route.ts:112)
 * when warmBoot's first fetch lands there — boot-time mounting preserved
 * through a graph the edge bundler never traces.
 */

async function warmBoot(): Promise<void> {
  const port = process.env.PORT ?? "3000";
  const base = `http://127.0.0.1:${port}`;
  const headers = { Origin: base };

  const get = async (path: string): Promise<Response | null> => {
    // up to 4 tries: the listener may still be binding, and dev-mode
    // compiles can take tens of seconds on the first pass (the timeout
    // must outlive them or the compile work is abandoned halfway)
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await fetch(`${base}${path}`, {
          headers,
          cache: "no-store",
          signal: AbortSignal.timeout(180_000),
        });
      } catch {
        await sleep(1500 * (attempt + 1));
      }
    }
    return null;
  };

  await sleep(1200); // let the listener bind first

  const marks: string[] = [];

  // 1. the jobs sweep — the heaviest graph (engine + dispatch + remote-run)
  const jobsRes = await get("/api/jobs");
  marks.push(`/api/jobs ${jobsRes?.status ?? "x"}`);

  // 2. a real job's LOG route — the exact "first log load" the user filed;
  //    any id compiles the graph (a 404 still pays the compile)
  let logId: string | null = null;
  try {
    const body = (await jobsRes?.json()) as { jobs?: { id?: string }[] } | undefined;
    logId = body?.jobs?.find((j) => typeof j?.id === "string")?.id ?? null;
  } catch {
    /* the warm id is best-effort — a placeholder still compiles the route */
  }
  const logRes = await get(`/api/jobs/${logId ?? "warmup"}/log`);
  marks.push(`/log ${logRes?.status ?? "x"}`);

  // 3. the project list — the API lane ONLY. t1170 — the whale strike:
  //    this list once warmed "/" too ("the page itself (the canvas's own
  //    graph)"), and the warm-up sank the box it warmed: the canvas page's
  //    dev compile is a ~3.4 GB RESIDENCY on the 4 GB box (measured
  //    2026-11-03, the t1170 certification census: `GET / 200 in 58s
  //    (compile: 58s)`, then dmesg's `Out of memory: Killed process 795
  //    (next-server) … anon-rss:3379696kB` — the kernel's GLOBAL OOM,
  //    past the launcher's 2048 MB heap cap, because the whale's compiled
  //    graph stays resident while the census's seats allocate on top of
  //    it; four live legs — t1022/1023/1024/t1164 — died reading a
  //    refused connection where the world should have spoken). A warm-up
  //    that kills the server is not a warm-up. The census's live-lane law
  //    (t927: the canvas page is NEVER compiled by the census) now has a
  //    second mouth here: the boot warm-up never compiles the whale
  //    either — the canvas compiles when a real visitor opens it, once,
  //    on demand, and that is the only compile it ever gets in dev.
  const projectsRes = await get("/api/projects");
  marks.push(`/api/projects ${projectsRes?.status ?? "x"}`);

  // 4. the AI settings route — the assistant panel's on-open fetch
  const aiRes = await get("/api/ai/settings");
  marks.push(`/api/ai/settings ${aiRes?.status ?? "x"}`);

  // 5. t637 — the judge worker's defensive mount lives in the status
  //    route; hitting it here keeps the t574 boot-mount contract (the
  //    direct import this file used to hold was the edge-graph poison).
  const judgeRes = await get("/api/ai/judge-worker");
  marks.push(`/api/ai/judge-worker ${judgeRes?.status ?? "x"}`);

  console.log(`[warmup] boot routes precompiled: ${marks.join(" · ")}`);
}
