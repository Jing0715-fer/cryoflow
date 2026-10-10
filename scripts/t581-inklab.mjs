// t581 ink lab — nail down WHEN lightningcss inlines var() references to
// same-sheet literal custom properties, so the ladder token strategy knows
// which form survives the pipeline. Lab only; not part of the app.
import { transform } from "lightningcss";

const cases = {
  A_sameSheetLiteral: `:root { --ink-06: color-mix(in oklch, var(--foreground) 6%, transparent); }
.x { box-shadow: 0 1px 2px var(--ink-06); }`,
  B_useSiteFallback: `:root { --ink-06: color-mix(in oklch, var(--foreground) 6%, transparent); }
.x { box-shadow: 0 1px 2px var(--ink-06, var(--foreground)); }`,
  C_propertyRegistered: `@property --ink-06 { syntax: "<color>"; inherits: true; initial-value: transparent; }
:root { --ink-06: color-mix(in oklch, var(--foreground) 6%, transparent); }
.x { box-shadow: 0 1px 2px var(--ink-06); }`,
  D_indirectPercent: `:root { --ink-06: color-mix(in oklch, var(--foreground) var(--ink-06-w, 6%), transparent); }
.x { box-shadow: 0 1px 2px var(--ink-06); }`,
  E_hexLiteral: `:root { --ink-06: #ff000026; }
.x { box-shadow: 0 1px 2px var(--ink-06); }`,
};

for (const [name, css] of Object.entries(cases)) {
  try {
    const out = transform({
      filename: `${name}.css`,
      code: Buffer.from(css),
      minify: true,
      errorRecovery: false,
    });
    console.log(`=== ${name} ===`);
    console.log(out.code.toString());
    console.log();
  } catch (e) {
    console.log(`=== ${name} === ERROR: ${e.message}\n`);
  }
}
