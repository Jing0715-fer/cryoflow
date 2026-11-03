// t79 media probe — does page.pdf() honor an active screen emulation?
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);

// leg 1: NO emulation, straight pdf
await p.pdf({ path: "/home/z/my-project/.qa-logs/t79-m1.pdf", printBackground: true, preferCSSPageSize: true });

// leg 2: emulate screen, then pdf
await p.emulateMedia({ media: "screen" });
await p.waitForTimeout(200);
await p.pdf({ path: "/home/z/my-project/.qa-logs/t79-m2.pdf", printBackground: true, preferCSSPageSize: true });

// leg 3: emulate print, then pdf
await p.emulateMedia({ media: "print" });
await p.waitForTimeout(200);
await p.pdf({ path: "/home/z/my-project/.qa-logs/t79-m3.pdf", printBackground: true, preferCSSPageSize: true });

await b.close();
for (const f of ["m1", "m2", "m3"]) {
  const txt = execSync(`pdftotext /home/z/my-project/.qa-logs/t79-${f}.pdf -`, { encoding: "utf8" }).replace(/\s+/g, "").toLowerCase();
  const raw = execSync(`pdfinfo /home/z/my-project/.qa-logs/t79-${f}.pdf 2>/dev/null || true`, { encoding: "utf8" });
  const pages = raw.match(/Pages:\s+(\d+)/)?.[1] ?? "?";
  console.log(`${f}: pages=${pages} masthead=${txt.includes("cryoflow—pipelinesnapshot")} appheader=${txt.includes("cryo-emworkflowbuil")}`);
}
