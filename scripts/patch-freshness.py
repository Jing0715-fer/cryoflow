#!/usr/bin/env python3
"""Patch fsc-compare-dialog.tsx: replace the live-notice <p> block with the
unified freshness strip (live status + labeled Scan button). The old notice
line contains a non-breaking space (\xa0) that the Edit tool normalizes,
hence this byte-exact patch."""
import re, sys

PATH = "src/components/workflow/results/fsc-compare-dialog.tsx"
src = open(PATH, encoding="utf-8").read()

# anchor: from the notice comment through the closing )}
pat = re.compile(
    r"        \{/\* ---------- live auto-refresh notice ---------- \*/\}\n"
    r"        \{runningPicked\.length > 0 && \(\n"
    r"          <p\n"
    r"            data-testid=\"fsc-compare-autolive\"\n"
    r".*?\n"
    r"          </p>\n"
    r"        \)\}\n",
    re.S,
)
m = pat.search(src)
if not m:
    sys.exit("PATTERN NOT FOUND")

NB = "\xa0"  # the original's non-breaking space before "s;"
NEW = '''        {/* ---------- freshness strip: live status + re-scan, one unit ----------
             The two "is my comparison current?" affordances used to live in
             different worlds — a ghost icon (invisible at rest) in the header
             and a teal band that only existed while a job ran. They are the
             same concern: the index and its curves go stale as refinements
             land checkpoints. One strip, two states: teal + pulse while the
             poller is attached, quiet "N curves indexed" otherwise; the
             labeled Scan button sits at its right edge in both. */}
        <div
          data-testid="fsc-compare-freshness"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border py-1 pl-2.5 pr-1.5 transition-colors duration-300",
            runningPicked.length > 0
              ? "border-teal-600/20 bg-teal-500/5"
              : "border-border/60 bg-muted/20"
          )}
        >
          {runningPicked.length > 0 ? (
            <p
              data-testid="fsc-compare-autolive"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-300"
            >
              <span className="relative inline-flex size-1.5 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
              </span>
              <span className="truncate">
                Live — curves for the running job{runningPicked.length === 1 ? "" : "s"} refresh
                every {LIVE_POLL_MS / 1000}''' + NB + '''s; the badge flips when it completes.
              </span>
            </p>
          ) : (
            <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  scanning ? "animate-pulse bg-primary/40 motion-reduce:animate-none" : "bg-border"
                )}
                aria-hidden="true"
              />
              {index
                ? `${index.length} curve${index.length === 1 ? "" : "s"} indexed`
                : indexError
                  ? "Index unavailable"
                  : "Scanning for FSC curves…"}
            </p>
          )}
          <button
            type="button"
            onClick={rescan}
            disabled={scanning}
            data-testid="fsc-compare-rescan"
            aria-label="Re-scan the project for FSC curves"
            title="Re-scan the project for FSC curves — running refinements land a new model checkpoint every few minutes, so an index read from a minute ago is already stale"
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background/60 px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3 w-3", scanning && "animate-spin motion-reduce:animate-none")}
              aria-hidden="true"
            />
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>
'''

out = src[: m.start()] + NEW + src[m.end():]
open(PATH, "w", encoding="utf-8").write(out)
print("patched OK — freshness strip in, nbsp preserved")
