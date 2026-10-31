#!/usr/bin/env python3
"""t1119 — the embed toolbar & popover focus-visible cure (the 22-knife sweep).
Every knife = one exact className base-string; the panel-convention ring
(focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring)
joins at the string's end. Swatch/radio seats keep their own selection
language (ring-2 + scale). Idempotent: a string already carrying
focus-visible is skipped. Counted: each entry asserts its expected
occurrence count BEFORE editing (never edit blind)."""

P = "src/components/workflow/results/molstar-embed.tsx"
src = open(P, encoding="utf-8").read()

R1 = " focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
R2 = " focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:scale-125"

# (exact-substring, expected-count, ring, reason)
KNIVES = [
    # clip panel's three doors (release, export sub-volume, send-to-job)
    ('w-full rounded-md border border-violet-600/30 bg-background/60 px-2 py-1 text-[10px] font-medium text-violet-700 transition-colors hover:bg-violet-600/15 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200', 1, R1, 'clip-box-release'),
    ('flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-600/40 bg-violet-600/15 px-2 py-1 text-[10.5px] font-semibold text-violet-700 transition-colors hover:bg-violet-600/25 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50', 1, R1, 'export-sub-volume'),
    ('flex w-full items-center justify-center gap-1.5 rounded-md border border-violet-600/40 bg-background/60 px-2 py-1 text-[10.5px] font-semibold text-violet-700 transition-colors hover:bg-violet-600/25 hover:text-violet-800 dark:text-violet-300 dark:hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-50', 1, R1, 'clip-send-job'),
    # oblique cut remove + caption reset
    ('rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-violet-600/15 hover:text-violet-700 dark:hover:text-violet-300', 1, R1, 'clip-oblique-clear'),
    ('flex items-center gap-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:text-foreground', 1, R1, 'caption-reset'),
    # overlay row: remove + swatch + color radio + add card
    ('flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive', 1, R1, 'overlay-remove'),
    ('size-2.5 shrink-0 rounded-full ring-1 ring-black/10 transition-transform', 1, R2, 'overlay-color-swatch (radio language)'),
    ('size-4 rounded-full ring-1 ring-black/15 transition-transform hover:scale-110', 1, R1, 'color-radio'),
    ('flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors', 1, R1, 'overlay-add-card'),
    # export-scale radio + turntable speed/scale radios + cancel
    ('flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left transition-colors', 1, R1, 'export-scale-radio'),
    ('flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[11px] transition-colors', 1, R1, 'turntable-speed-radio'),
    ('"flex flex-col items-start rounded-md border px-2 py-1.5 text-[11px] transition-colors"', 2, R1, 'turntable-scale+duration radios x2'),
    ('ml-0.5 rounded px-1 text-[9px] font-medium transition-colors hover:bg-white/20', 1, R1, 'turntable-cancel'),
    # camera bookmarks: card, dashed add, row main, five icon buttons (shared base x5)
    ('relative rounded-md border bg-card px-1 py-1.5 text-[11px] font-medium text-foreground/90 transition-colors hover:bg-primary/10 hover:text-primary', 1, R1, 'bookmark-card'),
    ('mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed px-1 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', 1, R1, 'bookmark-add'),
    ('flex min-w-0 flex-1 items-center gap-2 text-left', 1, R1, 'bookmark-row-main'),
    ('rounded p-0.5 text-muted-foreground/50 transition-colors', 5, R1, 'bookmark-icon-btns x5'),
    # bookmarks footer: export/import JSON + from-job trigger + copy link (shared base x4)
    ('flex items-center gap-1 whitespace-nowrap rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', 4, R1, 'bookmark-footer-btns x4'),
    # import sources: select all / clear (shared base x2) + the two add-source buttons (shared base x2)
    ('"rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"', 2, R1, 'import-pick-btns x2'),
    ('"flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"', 2, R1, 'import-add-btns x2'),
]

fail = False
for sub, want, ring, why in KNIVES:
    n = src.count(sub)
    if n != want:
        print(f"ABORT {why}: count {n} want {want}")
        fail = True
if fail:
    raise SystemExit(1)

for sub, want, ring, why in KNIVES:
    if "focus-visible" in sub:
        print(f"SKIP {why} (already)")
        continue
    src = src.replace(sub, sub + ring)
    print(f"KNIFE {why} x{want}")

open(P, "w", encoding="utf-8").write(src)
print("written", P)
