#!/usr/bin/env node
// t962 — the CLIENT-plane refusal census: every string literal fed to an
// error setter (setError*/setLoadError*/toast description/error) or a
// catch fallback in src/components + src/lib/store.ts, ranked on the
// honesty axes. Plus the lib-plane throw new Error texts in src/lib.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project/src";
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(tsx?|mjs)$/.test(name)) files.push(p);
  }
})(ROOT);

const clientFiles = files.filter((f) => /\/(components|store\.ts$)/.test(f) || /\/lib\//.test(f));
const sites = [];
for (const f of files) {
  const isClient = /\/components\//.test(f) || /\/store\.ts$/.test(f);
  const isLib = /\/lib\//.test(f);
  if (!isClient && !isLib) continue;
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const rel = f.replace("/home/z/my-project/", "");
    if (isClient) {
      // error-setter literals: setError("…"), setXError("…"), toast…description: "…", toast.error("…")
      let m;
      const re = /\b(set[A-Za-z]*Error|toast\.error|toast\.warning)\(\s*"([^"]{2,})"/g;
      while ((m = re.exec(line))) sites.push({ plane: "client", kind: "setter", f: rel, line: i + 1, text: m[2] });
      // toast description literals
      const re2 = /description:\s*"([^"]{2,})"/g;
      while ((m = re2.exec(line))) {
        if (/fail|error|refus|denied|invalid|cannot|unable|not /i.test(m[1])) sites.push({ plane: "client", kind: "toast", f: rel, line: i + 1, text: m[1] });
      }
      // catch fallbacks: instanceof Error ? x : "…"
      const re3 = /:\s*"([^"]{2,})"/g;
      while ((m = re3.exec(line))) {
        const before = line.slice(0, m.index);
        if (/instanceof Error|catch|=>\s*\{\s*$|\.message/.test(before)) {
          sites.push({ plane: "client", kind: "fallback", f: rel, line: i + 1, text: m[1] });
        }
      }
    }
    if (isLib && !/\/store\.ts$/.test(f)) {
      const m = line.match(/throw new Error\("([^"]{2,})"\)/);
      if (m) sites.push({ plane: "lib", kind: "throw", f: rel, line: i + 1, text: m[1] });
    }
  });
}

const GENERIC = /^(failed|error|unknown error|an error occurred|something went wrong|request failed|operation failed|action failed|failed to load|failed to save|failed to fetch|load failed|save failed|network error)$/i;
const NO_OBJECT = /^(failed|unable|cannot)\b( to)?\s*(load|save|fetch|update|delete|create|read|write|submit|send|refresh|connect)?\.?$/i;

const buckets = { generic: [], noObject: [], ok: 0 };
for (const s of sites) {
  const t = s.text.trim();
  if (GENERIC.test(t)) { buckets.generic.push(s); continue; }
  if (NO_OBJECT.test(t)) { buckets.noObject.push(s); continue; }
  buckets.ok++;
}

console.log(`TOTAL census sites: ${sites.length} (client+lib)`);
const byPlane = {};
for (const s of sites) byPlane[s.plane] = (byPlane[s.plane] ?? 0) + 1;
console.log(`by plane: ${JSON.stringify(byPlane)}`);
console.log(`\n== generic: ${buckets.generic.length}`);
for (const s of buckets.generic) console.log(`  ${s.f}:${s.line} [${s.kind}] "${s.text.slice(0, 70)}"`);
console.log(`\n== bare no-object (failed to load …): ${buckets.noObject.length}`);
{
  const byText = new Map();
  for (const s of buckets.noObject) {
    const arr = byText.get(s.text) ?? [];
    arr.push(`${s.f}:${s.line}`);
    byText.set(s.text, arr);
  }
  for (const [text, at] of [...byText.entries()].sort((a, b) => a[1].length - b[1].length)) {
    console.log(`  "${text}" ×${at.length}  ${at.slice(0, 4).join(", ")}${at.length > 4 ? " …" : ""}`);
  }
}
console.log(`\nOK: ${buckets.ok}`);
