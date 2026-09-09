// probe: reproduce qa66 pixel pipeline and debug the PGM parser
import { execSync } from "node:child_process";
import { readFileSync, readdirSync, mkdirSync, statSync, existsSync } from "node:fs";
const AB = "agent-browser";
const PDF_DARK = "/home/z/my-project/.qa-logs/probe-dark.pdf";
const PPM_DIR = "/home/z/my-project/.qa-logs/probe-ppm";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();

sh(`${AB} open http://localhost:3000`);
execSync("sleep 4");
execSync(`${AB} eval --stdin`, { input: "document.documentElement.classList.add('dark') + 'ok'", encoding: "utf8" });
execSync("sleep 1");
sh(`${AB} pdf ${PDF_DARK}`);
execSync("sleep 1");
try { execSync(`rm -rf ${PPM_DIR}`); } catch {}
mkdirSync(PPM_DIR, { recursive: true });
sh(`pdftoppm -gray -r 100 -f 1 -l 1 ${PDF_DARK} ${PPM_DIR}/page`);
const pgm = `${PPM_DIR}/${readdirSync(PPM_DIR)[0]}`;
const buf = readFileSync(pgm);
console.log("size:", buf.length);
console.log("head hex:", buf.slice(0, 20).toString("hex"));
console.log("head ascii:", JSON.stringify(buf.slice(0, 20).toString("latin1")));

let pos = 0;
const tok = () => {
  for (;;) {
    while (pos < buf.length && /\s/.test(String.fromCharCode(buf[pos]))) pos++;
    if (buf[pos] === 35) { while (pos < buf.length && buf[pos] !== 10) pos++; continue; }
    break;
  }
  const s = pos;
  while (pos < buf.length && !/\s/.test(String.fromCharCode(buf[pos]))) pos++;
  return buf.slice(s, pos).toString("ascii");
};
const magic = tok();
const w = Number(tok()), h = Number(tok()), max = Number(tok());
console.log("magic:", magic, "w:", w, "h:", h, "max:", max, "pos after tokens:", pos, "byte@pos:", buf[pos]);
pos += 1;
const data = buf.slice(pos, pos + w * h);
console.log("data.length:", data.length, "expected:", w * h, "first bytes:", data[0], data[1], data[2]);

const cw = Math.max(1, Math.floor(w * 0.12)), ch = Math.max(1, Math.floor(h * 0.12));
const boxes = [
  [0, 0, cw, ch], [w - cw, 0, w, ch], [0, h - ch, cw, h], [w - cw, h - ch, w, h],
];
console.log("cw,ch:", cw, ch, "boxes:", JSON.stringify(boxes));
const cornerSum = boxes.reduce((acc, [x0, y0, x1, y1]) => {
  let s = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { s += data[y * w + x]; n++; }
  console.log("  box", x0, y0, x1, y1, "-> s:", s, "n:", n, "s/n:", s / n);
  return acc + s / n;
}, 0);
console.log("cornerSum:", cornerSum, "cornersMean:", cornerSum / 4);
let sum = 0, n = 0, dark = 0;
for (let i = 0; i < data.length; i += 3) { const v = data[i]; sum += v; n++; if (v < 128) dark++; }
console.log("mean:", (sum / n).toFixed(1), "darkFrac(<128):", (dark / n * 100).toFixed(2) + "%");
