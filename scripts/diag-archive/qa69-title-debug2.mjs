// debug 2: harness state = job inspector OPEN at print time
import { execSync } from "node:child_process";
const sh = (cmd, input) => execSync(cmd, { encoding: "utf8", timeout: 120_000, input }).trim();
sh("agent-browser open http://localhost:3000");
execSync("sleep 5");
// click the select2d job card to open the inspector (same as qa66 Phase A entry)
sh("agent-browser eval --stdin", `(() => {
  const card = [...document.querySelectorAll('[data-canvas] [role=button], [data-canvas] button, [data-canvas] [tabindex]')].find(el => (el.textContent||'').includes('QA Class Select'));
  if (!card) return 'NO-CARD';
  card.dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, pointerId: 1}));
  card.dispatchEvent(new PointerEvent('pointerup', {bubbles: true, pointerId: 1}));
  card.click();
  return 'CLICKED';
})()`);
execSync("sleep 3");
sh("agent-browser eval --stdin", `(() => {
  const dlg = document.querySelector('[role=dialog]');
  return 'dialog:' + (dlg ? 'open' : 'none');
})()`);
sh("agent-browser eval --stdin", "document.documentElement.classList.add('dark') + 'ok'");
execSync("sleep 1");
sh("agent-browser pdf /home/z/my-project/.qa-logs/debug-title2.pdf");
execSync("sleep 1");
const t = sh("pdftotext /home/z/my-project/.qa-logs/debug-title2.pdf -");
console.log("===TEXT (first 40 lines)===");
console.log(t.split("\n").slice(0, 40).join("\n"));
console.log("===has main:", t.replace(/\s+/g, "").toLowerCase().includes("main"));
