// debug: what does pdftotext see on the canvas view print?
import { execSync } from "node:child_process";
const sh = (cmd, input) => execSync(cmd, { encoding: "utf8", timeout: 120_000, input }).trim();
sh("agent-browser open http://localhost:3000");
execSync("sleep 5");
sh("agent-browser eval --stdin", "document.documentElement.classList.add('dark') + 'ok'");
execSync("sleep 1");
sh("agent-browser pdf /home/z/my-project/.qa-logs/debug-title.pdf");
execSync("sleep 1");
const t = sh("pdftotext /home/z/my-project/.qa-logs/debug-title.pdf -");
console.log("===FULL TEXT===");
console.log(t);
console.log("===has main:", t.replace(/\s+/g, "").toLowerCase().includes("main"));
