#!/bin/bash
# t927 census runner — the 53 node instruments at their standing values (t1082 added the resume-receipt unit; t1083 grew it 23→29 and added the lane-chip unit, the 43rd seat; t1084 grew the pointer-wall-echo unit 22→30; t1087 added the paper-census unit, the 44th seat; t1088 added the fuel-family unit, the 45th seat; t1089 added the print-honesty unit, the 46th seat; t1090 added the lazy-host unit, the 47th seat; t1091 added the receipt-ledger unit, the 48th seat — the canvas paper's second voice; t1092 added the inspector-paper unit, the 49th seat — the job report face's second pass; t1093 added the params-paper unit, the 50th seat — the diff brain's standalone face; t1094 added the fsc-paper unit, the 51st seat — the FSC compare's print face; t1095 added the stray-verify unit, the 52nd seat — the audit's borderline shapes cured at the source; t1096 added the filmstrip unit, the 53rd seat — the oblique cut's walk; t1098 added the ortho-filmstrip unit, the 54th seat — the walk's siblings (the axis filmstrips); t1099 added the trace-drag unit, the 55th seat — the trace's hand (the drag math); t1100 added the trace-turn unit, the 56th seat — the trace's second DOF (the endpoint turn); t1101 added the particles-decode unit, the 57th seat — the #8 deep band's split (the pure decode rides the parse's cache slot); t1102 added the paper unit, the 58th seat — the print-face arc's full walk + the roster's orphan cure; t1103 added the plate unit, the 59th seat — the walk's printer (the ortho plate's paper plan); t1104 added the oblique-plate unit, the 60th seat — the walk's second page (the oblique walk's paper edition); t1105 added the plate-hist unit, the 61st seat — the plate's σ leg (the density distribution joins the paper).
# Law: unset DATABASE_URL per invocation; lib-import units via unit-runner (bare node dies on @/lib).
cd /home/z/my-project
export DATABASE_URL=""
# t1132 added the stale-listener unit, the 77th seat — the t1131 cure's law made REPO-WIDE: the sweep (38 listener registrations in []-deps effects as of t1134) classified 12 OK-REF carriers (the family's law — slice/clip/sheet/legend-hover intent refs) + 26 human-audited direct bodies hash-pinned in the receipt (shots-qa/t1132-stale-listener-hashes.json; setState setters, store getState() actions, module-scope pure fns); a synthetic fixture proves the scanner's teeth (direct applier caught, ref-routed twin OK); an edited audited body or a NEW un-audited []-deps listener REDs the seat with the audit instruction
EXPECTED=(22 23 25 38 33 28 28 25 20 20 16 17 11 8 14 28 13 23 10 17 33 16 22 32 91 23 63 33 18 45 28 30 14 13 11 48 9 19 19 24 17 29 7 16 16 11 10 16 15 20 20 16 20 20 17 19 17 9 22 21 22 26 22 22 19 38 31 29 18 47 37 37 17 41 37 79 11 90 23 37 19 25 47) # +seat 83 = t1142-world-ledger-server-unit (47 pins; the LEDGER'S SERVER TIER — the t1141 survey's named cost paid (an API + DB row, the envelope rides unchanged, the same reader reads it): A the envelope fathers — worldLedgerEnvelope the ONE envelope-text father (the storage write stores EXACTLY its bytes), validateWorldLedgerEnvelope the ONE trust decision (absent/empty the HONEST ABSENCE not a refusal; bad-json/bad-version/bad-rows/over-cap/bad-row-shape each NAMED), parseWorldLedgerEnvelope the ONE read father (the storage getter RIDES it — the extract pinned by source: no private JSON.parse), the download door's pretty face stays shape-equal (each door keeps its own face), the tooth father 65536 (the t1141 unit's byte bound made law); B the server fathers — the read's { rows, reachable } (200+envelope restores through the ONE parse father, a null envelope the server's honest absence, non-200/thrown that tier's ABSENCE never a throw), the write's receipt boolean (the body carries the ONE father's bytes byte-equal to the storage write, the URL grammar, PUT / application/json); C the route — the family's door pair (http-guard 403 at BOTH doors, the phantom 404 at BOTH doors, force-dynamic), the tooth 413 BEFORE the parse spends its effort, the verdict's own reason spoken at 400, badJsonReply the t973 one-birthplace, the verbatim store (NO re-stringify by ABSENCE — the GET hands back the exact bytes the PUT received), row?.envelope ?? null the honest absence, the lib's validator the ONLY trust decision (no JSON.parse in the route); D the wiring + the schema — the dialog imports BOTH server fathers, the fill asks AFTER the restore ONCE per project (serverFillTriedRef) and only on an EMPTY ledger (the deepest tier fills an empty machine, never clobbers a shallow one), the functional guard (the live story wins — the race law), the ghost-hand cancellation, the push rides the persist effect fire-and-forget (void — the board never waits on the network; the empty ledger never pushed), the schema row VERBATIM (projectId @id, envelope String, cascade — the row dies with its project)) · +seat 82 = t1141-world-ledger-tiers-unit (25 pins; the LEDGER'S DEEPER TIER — the t1134 pool's persistence candidate, the survey FIRST: A the tier reader — the TAB's story wins (both fed → session), the machine's story fills an EMPTY tab (tier local), the honest none (both empty / nulls — the SSR face), a REFUSED tier is that tier's ABSENCE (a foreign version in one tier drops THAT tier whole and never blinds the other's restore), the tier vocabulary is the lib's own type; B the tier writer — write-through BOTH through the ONE writer (one envelope: both tiers hold byte-equal memories the SAME reader restores), each tier keeps its OWN receipt (a refusal degrades that tier alone), the byte-bound tooth (the envelope at cap stays under 64 KiB — a fatter row shape REDs the seat and the survey re-runs); C the dialog wiring — the restore reads the TIERS father with both storages, the clobber cure rides the tier shape, the persist writes THROUGH the tiers father, the bare single-tier fathers are GONE from the call site (the one-father law at the door), the survey's numbers travel with the lib's own words; D the survey's standing facts pinned from the receipt — the quota measured (10 GiB), the envelope weighed (18,976 B at cap), BOTH tiers took it whole on the live origin, the build's generation NAMED (buildCarriesLedger — the t1135+ delta unbaked on the standing build-day shape), no key collision in localStorage) · +seat 81 = t1140-world-job-rows-unit (19 pins; the JOBS' OWN HEALTH FACE — the t1134 pool's 管道健康板 half: A the rows' words — the LAST FAILURE NAMED (the failures row counts, this row names who in the run's own first words clipped at 80 — a nameplate not a log — and when the world learned; the NEWEST failure wins, equal stamps fall to the array's last, a null result speaks name+when only), the OLDEST RUNNING's age (a count says how many, the row says how long — worldAgeWords the ONE father), the OLDEST WAITING's wait (pending never started — the wait rides updatedAt), the honest absences (a clean world speaks NO job rows), an unreadable stamp is an ABSENT fact (never NaN wearing a sentence), a future stamp is clock skew (the age row steps aside, never a negative duration), the durations ride the ONE father (no second formatter born); B the board's second list — its own testid + aria-label, the honest-empty render (the list exists only when it has rows), the ONE father import, the memo rides [jobs, now], ONE clock (the jobs' ages ride the SAME useNow tick — hasAgeableJobs extends the gate, the idle world pays zero timers), zero disabled sites, the family's faces stand) · seat 80 = t1139-world-ledger-inspector-unit (37 pins; the TRANSITION INSPECTOR + the ledger's DOWNLOAD DOOR — the t1134 candidate pool's timeline slice: A the transition's words — only the MOVERS speak in the vitals' order, the typographic − (U+2212), the first world introduces itself (no fake delta), a time-only move says "no visible change" (never an empty string), the delta pattern lives in the lib ALONE (the one-father law); B the download door — the family's stamp grammar verbatim (the funnel ledger's ISO shape, the T included), the body EXACTLY the storage envelope, the export file RESTORES through the storage reader (one father, live — a FakeStore round-trip), the empty ledger exports an honest absence, the storage write and the export body carry the SAME envelope (shape-equal, each door keeps its own face); C the strip's keyboard mirror — the t1138 mirror's sixth application: group + tabIndex + the label teaching EXACTLY the answered keys, the element-level wire (no raw window keydown — the C1 law by absence), the gatekeeper (B7), preventDefault the handled + bare the unhandled (B5), the first arrow lands on the NEWEST transition (the walk-current law), ONE aria-live readout for BOTH hands (hover wins while present, walk carries the sticky step), the marker never eats the hover (pointerEvents none), the three honest idle faces verbatim, the walk retires with its dialog (the ghost-hand law), the read-side clamp guards the cap-slide and setWalkIdx lives only in the handler + the retirement effect (the #13 law); D the export chip + the family — the door exists only when the ledger has a story (the honest-empty law, conditional render), zero disabled sites (the tally census untouched), the shadcn Button base (the t1123 mint table), the ONE download father (the t191 law — no anchor dance re-derived), the copy breath 1600 untouched, the footer dialect untouched, the restore/commit/persist order holds (declaration order IS the race law), the t1133 faces stand) · seat 79 = t1138-ortho-keyboard-unit (23 pins; the hover's KEYBOARD MIRROR — the t1134 candidate's third-window landing: A the canvas takes focus (tabIndex + role=group + the label teaching exactly the answered keys — the must-not-lie law's fifth application) with the house focus ring and the title's both-hands contract; B the verbs — the family gatekeeper (no ctrl/meta/alt, the t908 B7 shape), arrows nudge ONE VOXEL (1/dims with the honest 1% fallback — the stepVoxel tier law's shape), shift = the coarse ×10 (the depth dial's own shape), every handled key preventDefaults (the B5 law), Enter/Space commit via the SAME onPick door (no second truth), Escape = the pointer-leave's mirror, the first nudge speaks from the centre; C ONE wire — probeAt the factored trailing throttle appears exactly ONCE (a second clock would be a drift), both hands ride it, the chip never flashes empty, the readout speaks politely (aria-live); D the family untouched — no raw window keydown (the t908 C1 law), the step buttons + ⌖ + the img alt stand) · seat 78's t1135 re-key was 73→90 (the G band — the ledger's persistence layer, 17 pins) = t1133-world-vitals-unit (72 pins; A the vitals census — the five words + the universe, a future status still counts toward jobs; B snapshots + the pure reducer — sameWorld ignores the stamp, an unchanged world returns the SAME reference, the 240 cap keeps the newest; C the timeline layout — ONE world is flat, the zero world draws its floor tick, titles speak the five-number sentence, clockWordsOf pads the 24h clock; D the verdicts — a not-yet-arrived engine says so, missing tools list their names, zero failures still speak, an empty canvas is honestly ok, absent tool words keep silence; E the ledger's words — the header counts transitions not samples, the five-number lines oldest-first, age words ride the elapsed father; F the source pins — the lib is pure, NO window listeners and NO store.subscribe (the stale-listener law held by ABSENCE), the stamp lands at commit exactly once, the 1600 breath, the shadcn Button base only, useNow's idle-zero-timers law, the five testids, role=img strip, the honest flat face, all five words always, the footer's one door beside its numbers) (47 pins; A the legend is MADE of the mesh arrays — sheetLegendOf derives the key FROM bandColors/bandLabels/stats, never a second ramp; B the scrub debounce law — SHEET_SCRUB_DEBOUNCE_MS 180 (the PROBE_REFETCH_MS breath), existence words instant, numbers debounced, invert-only silent, unmount cleanup; C the wire law — OBLIQUE_SHEET_LEGEND_EVENT its own wire, ONE deduped announcement per settled pump, legend cleared at the commitSheet gate and minted only after the commit lands; D the strip's gate law — ACK-truth AND key-arrived, the honest 'reading the face…' placeholder only until the pump answers, the render-phase retirement (the prevNonce precedent), each swatch confessing its band-center density); +seat 75 = t1130-oblique-mesh-unit (37 pins; C8b the one-arg update pin — the offline repro nailed the two-arg recipe disease, the values ride alone) (36→37 pins, the cut's face gets PIXELS — the t1130 mesh pivot: the t1129 slice mode 'plane' was GL-silently invisible (the t1129 render diagnosis: data path healthy offline, GL side guilty, mol* itself never uses the path), so the face is now a density MESH — densityWindow (the tiles' own 2-98 stretch, strided ≤65536 reads, NaN skipped) + buildObliqueSheetMesh (the lattice mosaic over the guide's plane∩box polygon around the cut's own anchor, centroid-in-convex-trace membership, NaN drops the quad, u×v = n winding, K gray bands floor(t·K) clamped, hand-computed vertices A/B swept) living in the LIB (the t1122 patchBoxRect precedent), wrapped by sheetArraysToShape (one shape GROUP per band — the shape-group theme reads Shape.getColor, the bands ARE the colors) applied through the custom cryoflow-oblique-density-sheet transform (SO.Root → SO.Shape.Provider, params CARRY the geometry via PD.Value — BoxShape3D's pattern; the rev bump drives Recreate); σ-INDEPENDENT (the slider cuts the surface, the face wears the field — the t1129 shared-threshold effect retired, the pumpSheet seen-set shrunk); +seat 74 = t1129-oblique-sheet-unit (41 pins; t1137 re-key 39→41: C11 rides the CURED shape (the t1136 feat's own filter line — the old pin hunted the phantom read the feat had just cured), C11b the transformer-id witness counted verbatim at its three readers, C11c the phantom address retired to zero; t1130 re-key 34→39: C1/C2/C3/C9/D4 follow the mesh pivot — mode 'plane' ABSENT, the anchor word lives as mesh inputs, the contour isoValue retired, the σ effect retired, the ▣ title rides OBLIQUE_SHEET_FACE_TITLE — the birth-window's own face law evolves with the family); +seat 73 = t1128-inspect-seed-unit (17 pins, the session position's third seat — the inspector rides the t157/t159 seed family; the hollow-shell autopsy's cure: the watchdog's recycle→HMR full-reload used to evict the whole modal chain silently, the seed reopens the inspector on the reload's first landing + the watchdog's kill lines confess the reload consequence at the scene) = t1120-interval-voice-unit (18 pins, the interval readout — enrolled late, the t1124 drift fix); +seat 71 = t1121-patch-unit (47 pins; t1126 re-key 40→47: G8/G9/G10 + the H band — the clamp's own voice (patchClampVoice) joined the law, the chip's shortfall is the lib's word) — enrolled late; +seat 72 = t1122-probe-box-unit (37 pins, the patchBoxRect family + H the live re-probe — enrolled late); +seat 69 = t1123-bare-button-patrol-unit (37 pins, t1124 re-key 33→37: E4/E4-hover/E4b/E4c — the unlayered-shadow judged census joined the law, the app-wide bare-button patrol — A the zero-bare law over 62 files / 295 real tags, B 35 mint-count pins across the 17 hand-cured files, C three judged Chip riders, D the mints stay minted (chip + button bases), E two deliberate other-idioms preserved, F the census shape (62 files / 299 occurrences = 295 tags + 4 prose mentions), G the per-button auditor as the sharper gate — nested-template + comment-apostrophe scanner lessons inside) # +seat 57 = t1101-particles-decode-unit (17 pins); +seat 58 = t1102-paper-unit (9 pins, the arc's full walk + the roster's orphan cure); +seat 59 = t1103-plate-unit (22 pins, the walk's printer); +seat 60 = t1104-oblique-plate-unit (21 pins, the walk's second page); +seat 61 = t1105-plate-hist-unit (22 pins, the plate's σ leg); +seat 62 = t1106-axis-plate-unit (26 pins, the walk's third page — the axis strips on paper); +seat 63 = t1107-walk-current-unit (22 pins, the walk's "you are here" — the current mark's seat, ring and legend); +seat 64 = t1108-oblique-current-unit (22 pins, the cut walk's "you are here" — the frac seat, the violet ring, the page-2 legend); +seat 65 = t1109-walk-dial-unit (19 pins, the walk dial — the ring's live screen face + the two-scales cure's autopsy); +seat 66 = t1111-direction-dial-unit (38 pins, the direction dial — the cut's azimuth ladder + the angular mark's wrap law; t1115 re-key 29→38: the direction walk's EXPORT closed the walk-page family's last honest gap — E1..E9 (the filename grammar's computed calls, the fraction dialect born in, the page-4 seats' third face, ONE button, the extent word, the family's grid measures) + U4 re-key 2→3 (the ONE plan's third rider — the dial, the paper, the document), nine reasons named); +seat 68 = t1113-mrc-axis-sanitize-unit (29 pins, the axis-order sanitizer — the zero-header cure at the embed's two doors + the nine-writer MAPC law + the doctor's binding witness; t1114 re-key 25→29: the THIRD zero-header layer (cell sampling MX/MY/MZ) entered the law — pins P11/P12/P13 + W4, four re-keys named)
# t1131 added the sheet-legend unit, the 76th seat — the face's gray key (the strip MADE of the mesh arrays, the legend wire's own law, the scrub debounce, the honest placeholder; E the stale-listener cure — the t661 clip wire's applier rides the ref law, the live-caught phase-'loading' closure unreachable; t1134 grew it 71→79 with the G band — the HOVER wire, the key's second voice: hovering a 2D swatch lights the matching band in the 3D scene via ShapeGroup.Loci → lociHighlights.highlight, the refusal family (null/negative clears, a stale key past groupCount paints nothing), the pointer instrument law (the minimap's precedent), the kit's ShapeGroup address word)
# the bash-word law: NO trailing commas inside this array — in bash,
# "x", is ONE word (x,) — the comma joins the element and the runner
# hunts a file that does not exist
declare -a NAMES=(
  "t892-denoise-chip-unit"
  "t830-keymap-chips-unit"
  "t905-clip-interval-unit"
  "t906-voxel-voice-unit"
  "t907-oblique-voice-unit"
  "t908-oblique-keyboard-unit"
  "t904-minimap-echo-unit"
  "t904-pair-baseline-unit"
  "t904-particles-hotpath-unit"
  "t911-canvas-strip-unit"
  "t912-dialog-gutter-unit"
  "t914-import-visibility-unit"
  "t945-convention-unit"
  "t947-compare-x-unit"
  "t949-mint-preview-unit"
  "t954-hidden-gate-unit"
  "t956-mint-guard-cure-unit"
  "t956-remote-page-unit"
  "t957-syntax-landmine-unit"
  "t957-picks-statcache-unit"
  "t959-http-envelope-unit"
  "t960-server-error-unit"
  "t961-msg-quality-unit"
  "t966-peek-fold-unit"
  "t970-failed-face-unit"
  "t975-dialog-family-unit"
  "t982-aria-refusal-unit"
  "t991-keyboard-resize-unit"
  "t996-picker-error-unit"
  "t997-keyboard-valuetext-unit"
  "t998-workspace-rename-unit"
  "t999-pointer-wall-echo-unit"
  "t1000-create-clear-unit"
  "t1001-dirty-draft-unit"
  "t1002-rename-busy-unit"
  "t1016-pace-subchain-unit"
  "t1020-stop-walk-unit"
  "t1021-import-fuel-unit"
  "t1022-fuel-face-unit"
  "t1023-watchdog-guard-unit"
  "t1024-dialog-fuel-unit"
  "t1082-resumed-from-unit"
  "t1083-lane-chip-unit"
  "t1087-paper-census-unit"
  "t1088-fuel-family-unit"
  "t1089-print-honesty-unit"
  "t1090-lazy-host-unit"
  "t1091-receipt-ledger-unit"
  "t1092-inspector-paper-unit"
  "t1093-params-paper-unit"
  "t1094-fsc-paper-unit"
  "t1095-stray-verify-unit"
  "t1096-filmstrip-unit"
  "t1098-ortho-filmstrip-unit"
  "t1099-trace-drag-unit"
  "t1100-trace-turn-unit"
  "t1101-particles-decode-unit"
  "t1102-paper-unit"
  "t1103-plate-unit"
  "t1104-oblique-plate-unit"
  "t1105-plate-hist-unit"
  "t1106-axis-plate-unit"
  "t1107-walk-current-unit"
  "t1108-oblique-current-unit"
  "t1109-walk-dial-unit"
  "t1111-direction-dial-unit"
  "t1112-direction-walk-paper-unit"
  "t1113-mrc-axis-sanitize-unit"
  "t1120-interval-voice-unit"
  "t1121-patch-unit"
  "t1122-probe-box-unit"
  "t1123-bare-button-patrol-unit"
  "t1128-inspect-seed-unit"
  "t1129-oblique-sheet-unit"
  "t1130-oblique-mesh-unit"
  "t1131-sheet-legend-unit"
  "t1132-stale-listener-unit"
  "t1133-world-vitals-unit"
  "t1138-ortho-keyboard-unit"
  "t1139-world-ledger-inspector-unit"
  "t1140-world-job-rows-unit"
  "t1141-world-ledger-tiers-unit"
  "t1142-world-ledger-server-unit"
)
declare -a RUNNERS=(1 0 1 1 1 1 2 2 0 0 0 0 1 0 0 0 0 1 0 1 1 1 1 0 1 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 2 2 2 2 0 2 2 2 2 2 2 2 2 2 2 2 2 2 0 0 2 2 2 0 2 0 1 1 1 1)
i=0
for name in "${NAMES[@]}"; do
  unset DATABASE_URL
  if [ "${RUNNERS[$i]}" = "1" ]; then
    OUT=$(node scripts/unit-runner.mjs "scripts/${name}.mjs" 2>&1)
  elif [ "${RUNNERS[$i]}" = "2" ]; then
    OUT=$(node --import ./scripts/ts-alias-register.mjs "scripts/${name}.mjs" 2>&1)
  else
    OUT=$(node "scripts/${name}.mjs" 2>&1)
  fi
  CODE=$?
  COUNT=$(echo "$OUT" | grep -oE "[0-9]+/[0-9]+ green" | grep -oE "^[0-9]+" | head -1)
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "[0-9]+ passed" | grep -oE "^[0-9]+" | head -1)
  fi
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "PASS [0-9]+" | grep -oE "[0-9]+" | head -1)
  fi
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "\([0-9]+ ok" | grep -oE "[0-9]+" | head -1)
  fi
  if [ "$CODE" = "0" ] && [ "$COUNT" = "${EXPECTED[$i]}" ]; then
    echo "GREEN ${name}: ${COUNT}/${EXPECTED[$i]}"
  else
    echo "RED   ${name}: exit=${CODE} count=${COUNT:-?} expected=${EXPECTED[$i]}"
    echo "$OUT" | tail -6 | sed 's/^/    /'
  fi
  i=$((i+1))
done
