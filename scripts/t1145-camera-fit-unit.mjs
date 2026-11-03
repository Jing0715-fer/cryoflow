#!/usr/bin/env node
/**
 * t1145 — THE CAMERA-FIT DOOR unit: the init fit read the scene ONCE, 300 ms
 * after the commit; the isosurface geometry bakes async, so in a small strip
 * viewport the first read can legitimately be radius 0 — and the old code
 * then fell to Camera.Reset, whose default pose has no opinion about the
 * scene's actual extent. The map + sheet stayed invisible behind the CONTOUR
 * overlay and never spoke again (the t1144 verdict: "the camera radius
 * collapsed to 0").
 *
 * The cures (the door's three faces, born this window):
 *   • the BRAIN — sceneFitChoice (lib/camera-fit.ts): the fallback chain's
 *     pure decision (visible → whole → reset), run FOR REAL here. A garbage
 *     number (NaN, negative, zero, non-finite) reads as "no sphere" — it
 *     must never steer the camera.
 *   • the PATIENCE — FIT_PATIENCE: the init ride waits long (10 × 200 ms —
 *     the bake starts cold), the user-facing verb waits short (3 × 150 ms —
 *     the scene is already warm). ONE father: the embed rides these shapes,
 *     no hand-typed beat tables survive.
 *   • the HANDS — fitSceneCamera (the embed): patience + the fallback chain
 *     + the disposed guard; the button face (ZoomIn, aria + title) and the
 *     V key speak the same verb. Cosmetic by contract: a lost fit never
 *     becomes a toast.
 *
 * The unit RUNS the lib's pure brain and PINS the embed's source (the hands
 * are React/mol* — the live ride belongs to a build day).
 * node scripts/unit-runner.mjs scripts/t1145-camera-fit-unit.mjs
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sceneFitChoice, FIT_PATIENCE } from "../src/lib/camera-fit.ts";

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const embed = readFileSync(join(process.cwd(), "src/components/workflow/results/molstar-embed.tsx"), "utf8");

/* ---------- A — the brain, run for real ---------- */
console.log("A — sceneFitChoice: the fallback chain's brain (pure, run for real)");

ok("A1 the visible sphere wins whenever it has a real radius",
  sceneFitChoice(12.5, 20) === "visible");

ok("A2 radius 0 on the visible side falls to the whole-scene sphere",
  sceneFitChoice(0, 20) === "whole");

ok("A3 both zero — the honest last resort is Reset",
  sceneFitChoice(0, 0) === "reset");

ok("A4 a NaN visible radius reads as 'no sphere' (never steers the camera)",
  sceneFitChoice(NaN, 8) === "whole");

ok("A5 a NaN on both sides — Reset",
  sceneFitChoice(NaN, NaN) === "reset");

ok("A6 a NEGATIVE radius is garbage, not a sphere",
  sceneFitChoice(-3, 8) === "whole" && sceneFitChoice(-3, -3) === "reset");

ok("A7 Infinity is non-finite — 'no sphere' on that side",
  sceneFitChoice(Infinity, 8) === "whole" && sceneFitChoice(8, Infinity) === "visible");

ok("A8 null/undefined sides read as absent (the getters may return nothing)",
  sceneFitChoice(null, undefined) === "reset" && sceneFitChoice(undefined, 5) === "whole" && sceneFitChoice(5, null) === "visible");

ok("A9 the visible side needs only itself (the whole sphere is not consulted)",
  sceneFitChoice(1e-9, 999) === "visible");

/* ---------- B — the patience shapes: ONE father ---------- */
console.log("\nB — FIT_PATIENCE: the beat tables live in ONE place");

ok("B1 the init ride waits long (10 beats × 200 ms — the bake starts cold)",
  FIT_PATIENCE.init.beats === 10 && FIT_PATIENCE.init.beatMs === 200);

ok("B2 the user-facing verb waits short (3 beats × 150 ms — the scene is warm)",
  FIT_PATIENCE.verb.beats === 3 && FIT_PATIENCE.verb.beatMs === 150);

ok("B3 the embed rides the lib's shapes — no hand-typed beat tables survive",
  (embed.match(/beats:\s*\d+/g) ?? []).length === 0);

ok("B4 the init call spreads the ONE shape (plus its disposed guard)",
  embed.includes("{ ...FIT_PATIENCE.init, disposed: () => disposed }"));

ok("B5 the verb hands pass the ONE shape verbatim (keymap and button)",
  (embed.match(/FIT_PATIENCE\.verb/g) ?? []).length === 2);

/* ---------- C — the hands: patience + chain + faces (source pins) ---------- */
console.log("\nC — the embed's hands: the door answers on three faces");

ok("C1 the hands read the VISIBLE sphere first (the baked surface speaks)",
  embed.includes("c3d.scene?.boundingSphereVisible"));

ok("C2 the whole-scene sphere is the fallback (the map DATA fills it before the surface bakes)",
  embed.includes("c3d.scene?.boundingSphere")
    && embed.indexOf("boundingSphereVisible") < embed.indexOf("const whole = c3d.scene?.boundingSphere"));

ok("C3 Reset is the honest last resort (after the beats are spent)",
  embed.indexOf("PluginCommands.Camera.Reset") > embed.indexOf("for (let i = 0; i < beats; i++)"));

ok("C4 the ×0.7 framing and the floor 1 survive (never a zero distance)",
  embed.includes("Math.max(sphere.radius * 0.7, 1)"));

ok("C5 the disposed guard answers every beat (the dialog can close mid-fit)",
  embed.includes("if (opts.disposed?.()) return \"gone\";"));

ok("C6 cosmetic by contract — the fit never throws into the UI (no toast on a lost frame)",
  embed.includes(".catch(() => {});") && embed.includes("camera framing is cosmetic"));

ok("C7 the button face exists (Fit view, beside Reset, with its honest title)",
  embed.includes("Fit view to the density")
    && embed.indexOf("Fit view to the density") < embed.indexOf("aria-label=\"Reset camera\""));

ok("C8 the keyboard face exists — the V key speaks the same verb",
  embed.includes('e.key === "v" || e.key === "V"'));

ok("C9 the init door waits its first beat before the patience ride (300 ms — the commit settles)",
  embed.includes("await new Promise((r) => setTimeout(r, 300));"));

ok("C10 the presets popover teaches the V key (the must-not-lie law: the keymap speaks where it is taught)",
  embed.includes("V re-frames on the scene (fit)"));

/* ---------- receipt ---------- */
console.log(`\nCAMERA-FIT-UNIT t1145: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);
