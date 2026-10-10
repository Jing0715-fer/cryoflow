/**
 * unit-runner — the loader that lets the lib-level unit probes
 * (t653-match-unit, t655-match-unit, …) import the app's TypeScript
 * sources, including the "@/*" path alias they use inside lib/
 * (node's strip-types cannot resolve either the extension-less or the
 * aliased imports; jiti can, given the alias mapping).
 *
 * Usage:  node scripts/unit-runner.mjs scripts/t653-match-unit.mjs
 * (any extra argv is forwarded to the probe — it sees the argv it
 * would have seen if node had run it directly, minus this runner's
 * own slot).
 */
import { createJiti } from "jiti";
import path from "node:path";
import { pathToFileURL } from "node:url";

const target = process.argv[2];
if (!target) {
  console.error("usage: node scripts/unit-runner.mjs <probe-script> [probe-args...]");
  process.exit(2);
}

const srcDir = path.resolve(path.dirname(import.meta.filename ?? import.meta.url), "..", "src");
const jiti = createJiti(import.meta.url, {
  alias: { "@": srcDir },
  interopDefault: true,
});

process.argv.splice(2, 1); // drop the runner's own slot — probe argv stays honest
await jiti.import(pathToFileURL(path.resolve(target)).href);
