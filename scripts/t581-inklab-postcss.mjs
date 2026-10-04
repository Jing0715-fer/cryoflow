// t581 ink lab, round 2 — run the A case through the app's REAL pipeline
// (@tailwindcss/postcss, same as postcss.config.mjs) to identify the inliner.
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const css = `@import "tailwindcss";
:root { --ink-06: color-mix(in oklch, var(--foreground) 6%, transparent); }
.x { box-shadow: 0 1px 2px var(--ink-06); }
.y { box-shadow: 0 1px 2px color-mix(in oklch, var(--foreground) 6%, transparent); }
`;

const result = await postcss([tailwind()]).process(css, {
  from: "/home/z/my-project/src/app/globals.css", // real path so @source scan matches the app
  parser: undefined,
});
const out = result.css;
// extract the .x and .y rules and any ink definitions, with @supports context
const lines = out.split("\n");
let supportsDepth = 0;
let inTarget = false;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/@supports/.test(line)) supportsDepth++;
  const isTarget = /--ink-06|^\.x \{|^\.y \{|box-shadow: 0 1px 2px/.test(line);
  if (isTarget) {
    console.log(
      `[L${i}]${supportsDepth > 0 ? ` in@supports(depth ${supportsDepth})` : " top-level"} ${line.trim()}`
    );
  }
  if (/\}/.test(line)) supportsDepth = Math.max(0, supportsDepth - (line.split("}").length - 1));
}
