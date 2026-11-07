#!/usr/bin/env node
/**
 * t957-syntax-landmine-unit — the census's 19th instrument.
 *
 * THE TRUE STORY (the forensics ride, corrected): picks/route.ts line
 * 146 — `new Map(parsed.micrographs.map((m) => [m.micName, m]))` —
 * APPEARED broken in every plain-text probe (sed, rg, cat, git show all
 * printed `=> .micName, m]`), while od -c, JSON-length probes, the Read
 * tool, and in-process assertions all showed the bytes honest. THE CULPRIT:
 * the Bash capture layer sanitizes ANSI SGR-like sequences — any
 * contiguous `[<chars>m` in a terminal-plain line is EATEN (probe:
 * `echo 'x[0mY[1mZ'` → `xYZ`; `echo '[m.hello'` → `.hello`). The disk,
 * the git objects, and all three compilers were honest since t433; the
 * "syntactic landmine healed silently by tsc+eslint+swc" was a DISPLAY
 * artifact — a full forensic ride that ended in the harness's own pants.
 *
 * THE LAWS PINNED (still real — they stand guard over the line's bytes):
 *   L1  the worktree source carries the fixed form and NOT the broken
 *       form (in-process includes — capture-layer immune).
 *   L2  a fresh TypeScript parse reports ZERO parse diagnostics.
 *   L3  the byName arrow's body is a REAL ArrayLiteralExpression whose
 *       first token is the OpenBracketToken.
 *   L4  the emitted JS carries the fixed form and never the broken one.
 *   L5  git's HEAD blob carries the fixed line too (the committed
 *       history honest, not just the worktree).
 *   L6  THE CAPTURE-LAYER LAW: a probe string containing `[m` survives
 *       in-process (length + includes) — documenting WHY this unit
 *       asserts in-process and never through plain-text echoes.
 *
 * THE PROBE PROTOCOL (for every future window): when a byte-level claim
 * hinges on tool output, use od -c / String length / JSON.stringify —
 * NEVER a bare echo/sed/rg line — the display plane eats `[m`.
 */
import { readFileSync } from "fs";
import { execFileSync } from "child_process";
import { createRequire } from "module";
import path from "path";
import url from "url";

const require = createRequire(import.meta.url);
const ts = require("typescript");

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "src/app/api/jobs/[id]/picks/route.ts");
const FIXED = "parsed.micrographs.map((m) => [m.micName, m]));";
const BROKEN = "parsed.micrographs.map((m) => .micName, m]));";

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok: ${name}${detail ? `  ${detail}` : ""}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? `  ${detail}` : ""}`);
  }
}

console.log("SYNTAX-LANDMINE-UNIT t957 — the display plane lies; the byte plane is the truth");

// ---- L1: the live bytes are honest (in-process — immune) ----
const src = readFileSync(FILE, "utf8");
ok("L1a the fixed form is present in the worktree source", src.includes(FIXED));
ok("L1b the broken form is ABSENT from the worktree source", !src.includes(BROKEN));

// ---- L2: a fresh parse stands alone ----
const sf = ts.createSourceFile(FILE, src, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
const diags = sf.parseDiagnostics ?? [];
ok(
  "L2 the fresh TS parse reports ZERO parse diagnostics",
  diags.length === 0,
  diags.length === 0 ? "" : diags.slice(0, 3).map((d) => ts.flattenDiagnosticMessageText(d.messageText, " ")).join(" | ")
);

// ---- L3: the array literal is REAL (has its open bracket) ----
let bodyNode = null;
sf.forEachChild(function walk(n) {
  if (
    ts.isArrayLiteralExpression(n) &&
    n.getText(sf).includes("micName") &&
    n.parent?.kind === ts.SyntaxKind.ArrowFunction
  ) {
    bodyNode = n;
  }
  n.forEachChild(walk);
});
let arrowBodyReal = false;
if (bodyNode) {
  const firstTok = bodyNode.getFirstToken(sf);
  arrowBodyReal = firstTok?.kind === ts.SyntaxKind.OpenBracketToken;
}
ok(
  "L3 the byName arrow body is a REAL array literal (OpenBracketToken present)",
  arrowBodyReal,
  bodyNode ? `len=${bodyNode.getText(sf).length}` : "arrow body not found"
);

// ---- L4: the emitted JS is honest ----
const emitted = ts.transpileModule(src, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
  reportDiagnostics: true,
});
const emittedLines = emitted.outputText.split(/\r?\n/);
const emittedByname = emittedLines.find((l) => l.includes("byName =")) ?? "";
ok("L4a the emitted JS carries the fixed form", emittedByname.includes("[m.micName, m]"), `len=${emittedByname.trim().length}`);
ok("L4b the emitted JS NEVER carries the broken form", !emitted.outputText.includes("=> .micName"));
ok("L4c the emit itself raises zero diagnostics", (emitted.diagnostics ?? []).length === 0);

// ---- L5: the committed history is honest ----
let headLine = "";
try {
  const blob = execFileSync("git", ["cat-file", "-p", `HEAD:src/app/api/jobs/[id]/picks/route.ts`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  headLine = blob.split(/\r?\n/).find((l) => l.includes("byName =")) ?? "";
} catch {
  headLine = "";
}
ok("L5a git's HEAD blob carries the fixed line", headLine.includes("[m.micName, m]"), `len=${headLine.trim().length}`);
ok("L5b git's HEAD blob NEVER carries the broken line", !headLine.includes("=> .micName"));

// ---- L6: the capture-layer law, self-demonstrating ----
const probe = "[m.micName, m]";
ok(
  "L6 the [m probe string survives IN-PROCESS (the display plane's appetite documented)",
  probe.length === 14 && probe.startsWith("[m."),
  `len=${probe.length}`
);

console.log(`\nSYNTAX-LANDMINE-UNIT t957: ${pass}/${pass + fail} ${pass + fail === pass && pass > 0 ? "green — the bytes are honest in the worktree, the parse, the emit, the commit, and the probe" : "RED"}`);
process.exit(fail === 0 && pass > 0 ? 0 : 1);
