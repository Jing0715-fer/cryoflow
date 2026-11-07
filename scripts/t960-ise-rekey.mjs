#!/usr/bin/env node
// t960 — re-key the "Internal server error" catch-alls to serverErrorReply.
//
// The audit found 78 sites across 62 files; 77 share the shape
//   console.error("TAG failed:", BINDING);
//   return NextResponse.json({ error: "Internal server error" }, { status: 500 });
// (71 two-line catches + 6 chart-route catches that carry a
// ChartJobNotFound 404 guard above the pair). The pair is rewritten to
//   return serverErrorReply("TAG", BINDING);
// and `import { serverErrorReply } from "@/lib/server-error";` is
// inserted after the last top-of-file import. The ONE multi-line json
// variant (continue-sources, the 200-degrade shape) is left for the
// hand and reported here.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const API = join(ROOT, "src/app/api");
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".ts")) files.push(p);
  }
})(API);

const ISE_RETURN =
  /^(\s*)return NextResponse\.json\(\s*\{\s*error:\s*"Internal server error"\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\);\s*$/;
const CONSOLE_ERR =
  /^(\s*)console\.error\("([^"]+) failed:",\s*([A-Za-z_$][\w$]*)\);\s*$/;
const CATCH = /\}\s*catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{/;

let rewritten = 0;
const leftovers = [];
const perFile = [];

for (const f of files) {
  const src = readFileSync(f, "utf8");
  let lines = src.split("\n");
  let dirty = false;
  let fileHits = 0;

  for (let i = 0; i < lines.length; i++) {
    if (!ISE_RETURN.test(lines[i])) continue;
    const indent = lines[i].match(ISE_RETURN)[1];
    // the console.error line must sit immediately above
    const prev = i > 0 ? lines[i - 1] : "";
    const cm = prev.match(CONSOLE_ERR);
    if (!cm) {
      leftovers.push(`${f}:${i + 1} (no console.error line directly above)`);
      continue;
    }
    const [, , tag, logBinding] = cm;
    // find the enclosing catch binding within 8 lines back
    let binding = null;
    for (let j = i - 2; j >= Math.max(0, i - 9); j--) {
      const bm = lines[j].match(CATCH);
      if (bm) { binding = bm[1]; break; }
    }
    if (!binding) {
      leftovers.push(`${f}:${i + 1} (no catch signature found above)`);
      continue;
    }
    if (binding !== logBinding) {
      leftovers.push(`${f}:${i + 1} (logged ${logBinding} but caught ${binding})`);
      continue;
    }
    lines[i] = `${indent}return serverErrorReply("${tag}", ${binding});`;
    lines.splice(i - 1, 1); // drop the console.error line (the helper logs)
    i -= 1;
    dirty = true;
    fileHits++;
    rewritten++;
  }

  if (dirty) {
    const out = lines.join("\n");
    if (!/from "@\/lib\/server-error"/.test(out)) {
      // insert after the last import statement (handles multi-line imports)
      const outLines = out.split("\n");
      let lastImportEnd = -1;
      for (let i = 0; i < outLines.length; i++) {
        if (/^import\b/.test(outLines[i])) {
          let j = i;
          while (!/;\s*$/.test(outLines[j]) && j < outLines.length - 1) j++;
          lastImportEnd = j;
        } else if (lastImportEnd >= 0 && outLines[i].trim() && !/^(\/\/|\/\*|\*)/.test(outLines[i].trim())) {
          break; // the import block ended
        }
      }
      if (lastImportEnd < 0) {
        leftovers.push(`${f} (NO IMPORT BLOCK FOUND — import not added)`);
      } else {
        outLines.splice(lastImportEnd + 1, 0, `import { serverErrorReply } from "@/lib/server-error";`);
      }
      writeFileSync(f, outLines.join("\n"));
    } else {
      writeFileSync(f, out);
    }
    perFile.push(`${f.replace(ROOT + "/", "")}: ${fileHits}`);
  }
}

console.log(`REWRITTEN: ${rewritten} sites across ${perFile.length} files`);
for (const l of perFile) console.log(`  ${l}`);
console.log(`LEFTOVERS: ${leftovers.length}`);
for (const l of leftovers) console.log(`  ${l}`);
