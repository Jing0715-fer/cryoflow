/** Verify parseGuinierEps against a real RELION 5.0.1 postprocess EPS. */
import { readFileSync } from "node:fs";
import { parseGuinierEps } from "../src/lib/relion/guinier-eps";

const p = process.argv[2] ?? "data/relion/cmto3ts7j0000qf51ruzxudg8/postprocess_6yyovyf4/postprocess_guinier.eps";
const text = readFileSync(p, "utf8");
const pts = parseGuinierEps(text);
if (!pts || pts.length === 0) {
  console.log("FAIL: no points extracted");
  process.exit(1);
}
const xs = pts.map((q) => q.x);
const ys = pts.map((q) => q.lnAmp);
const sharpened = pts.filter((q) => q.lnAmpSharpened !== null);
console.log(`points: ${pts.length}  sharpened: ${sharpened.length}`);
console.log(`x range: ${Math.min(...xs).toFixed(5)} .. ${Math.max(...xs).toFixed(5)} (1/A^2)`);
console.log(`y range: ${Math.min(...ys).toFixed(3)} .. ${Math.max(...ys).toFixed(3)} (ln amp)`);
console.log("first 3:", pts.slice(0, 3).map((q) => `(${q.x.toFixed(5)}, ${q.lnAmp.toFixed(3)})`).join(" "));
console.log("last 3:", pts.slice(-3).map((q) => `(${q.x.toFixed(5)}, ${q.lnAmp.toFixed(3)})`).join(" "));

// sanity: x must be strictly increasing-ish, y within the printed axis range
const mono = xs.every((v, i) => i === 0 || v >= xs[i - 1] - 1e-9);
const inRange = ys.every((v) => v >= -16.5 && v <= -3.5);
console.log(`x monotonic: ${mono}  y within axis labels (-16..-4): ${inRange}`);
console.log(mono && inRange ? "PASS" : "FAIL");
process.exit(mono && inRange ? 0 : 1);
