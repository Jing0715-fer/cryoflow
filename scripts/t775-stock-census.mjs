// t775 stock census — pre (git HEAD) vs post (working tree), line-comment-stripped
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const strip = (s) =>
  s.split("\n").map((l) => {
    const i = l.indexOf("//");
    return i >= 0 ? l.slice(0, i) : l;
  }).join("\n");

const count = (s, re) => (s.match(re) ?? []).length;

for (const f of ["src/components/workflow/job-card.tsx", "src/components/workflow/canvas.tsx"]) {
  const pre = strip(execSync(`git show HEAD:${f}`, { encoding: "utf8" }));
  const post = strip(readFileSync(f, "utf8"));
  const metrics = {
    glue: /\{" "\}/g,
    truncate: /\btruncate\b/g,
    storage: /localStorage|sessionStorage/g,
    hex: /#[0-9a-fA-F]{3,8}\b/g,
  };
  const out = { file: f };
  for (const [k, re] of Object.entries(metrics)) out[k] = `pre=${count(pre, re)} post=${count(post, re)}`;
  console.log(JSON.stringify(out));
}
