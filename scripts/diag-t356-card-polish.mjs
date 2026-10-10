/**
 * diag-t356 — card polish + wire uncrossing + note markers + connect flow.
 *
 * Verifies the t356 changes end-to-end in a real browser:
 *   A. card de-clutter — no count chips, no IP text, no 2-line clamps
 *   B. class2d→select2d wires run flat (the select2d input swap)
 *   C. note badge hover → styled popover with the note text
 *   D. context menu → Add note… → dialog → save → badge appears
 *   E. interactive wiring (drag select2d.particles → class3d.particles)
 *      — proves the livePending handler refactor + memo comparator
 *   F. reload persistence (notes + the new edge survive)
 *
 * Run (single tool call, per the box's memory doctrine):
 *   bash /tmp/cf-up.sh && bun scripts/diag-t356-card-polish.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3001";
const SHOTS = "/home/z/cryoflow/shots-qa/";
let pass = 0, fail = 0;
const must = (cond, name) => {
  if (cond) { pass++; console.log("  ✓ " + name); }
  else { fail++; console.log("  ✗ " + name); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
// t356 — lean-load: skip fonts/images, the 4GB box needs every MB
await page.route(/\.(woff2?|png|svg|jpe?g)$/i, (r) => r.abort());
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message.slice(0, 120)));
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });

await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("[data-job]", { timeout: 60000 });
await page.waitForTimeout(1200);

console.log("A — card de-clutter");
const a = await page.evaluate(() => ({
  cards: document.querySelectorAll("[data-job]").length,
  countChips: document.querySelectorAll("[data-card-count]").length,
  noteBadges: document.querySelectorAll("[data-note-badge]").length,
  ipText: Array.from(document.querySelectorAll("[data-job]")).some((c) => /\d+\.\d+\.\d+\.\d+/.test(c.textContent || "")),
  clamp2: document.querySelectorAll("[data-job] .line-clamp-2").length,
}));
must(a.cards >= 3, `A0 canvas has ${a.cards} cards`);
must(a.countChips === 0, "A1 no count chips (388k badge gone)");
must(a.clamp2 === 0, "A2 no 2-line clamps inside cards (one-line law)");
must(!a.ipText, "A3 no IP text on any card face");

console.log("B — class2d→select2d wire geometry (the input swap)");
const wires = await page.evaluate(() =>
  Array.from(document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]")).map((g) => {
    const ps = g.querySelectorAll('path[data-e="d"]');
    const d = ps[ps.length - 1].getAttribute("d") || "";
    const n = d.match(/-?[\d.]+/g) || [];
    return { sy: +n[1], ey: +n[n.length - 1] };
  })
);
must(wires.length === 2, `B1 two wires render (${wires.length})`);
must(
  wires.every((w) => Math.abs(w.sy - w.ey) < 1),
  "B2 both wires flat — no crossing: " + wires.map((w) => w.sy.toFixed(1) + "→" + w.ey.toFixed(1)).join(" | ")
);
await page.screenshot({ path: SHOTS + "t356-a-canvas.png" });

console.log("C — note badge hover popover");
const badge = page.locator("[data-note-badge]").first();
await badge.hover();
await page.waitForTimeout(800);
const popBody = await page.evaluate(() => document.body.textContent || "");
must(popBody.includes("keep classes 1,2,5"), "C1 hover shows the note text in a styled popover");
await page.screenshot({ path: SHOTS + "t356-b-note-popover.png" });
await page.mouse.move(10, 10);
await page.waitForTimeout(300);

console.log("D — context menu → Add note… → dialog → save");
const selCard = page.locator('[data-job]:has-text("2D Class Selection")').first();
await selCard.click({ button: "right" });
await page.waitForSelector('[role="menuitem"]', { timeout: 10000 });
const menuItems = await page.evaluate(() =>
  Array.from(document.querySelectorAll('[role="menuitem"]')).map((m) => m.textContent || "")
);
must(menuItems.some((t) => t.includes("Add note")), "D1 menu offers Add note…");
await page.click('[role="menuitem"]:has-text("Add note")');
await page.waitForSelector('[role="dialog"] textarea', { timeout: 10000 });
await page.fill('[role="dialog"] textarea', "selection looks good — 5 classes kept, feed into the 3D classification");
await page.screenshot({ path: SHOTS + "t356-c-note-dialog.png" });
await page.click('[role="dialog"] button:has-text("Save note")');
await page.waitForTimeout(1800);
const d = await page.evaluate(() => ({
  badges: document.querySelectorAll("[data-note-badge]").length,
  dialogGone: !document.querySelector('[role="dialog"]'),
}));
must(d.badges === 2, `D2 badge appears on select2d after save (${d.badges} badges)`);
must(d.dialogGone, "D3 dialog closed after save");
await page.screenshot({ path: SHOTS + "t356-d-note-saved.png" });

console.log("E — interactive wiring (drag out:particles → in:particles)");
const edgesBefore = await page.evaluate(() => document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]").length);
const srcPort = page
  .locator('[data-job]:has-text("2D Class Selection") [data-port="out:particles"]')
  .first();
const dstPort = page
  .locator('[data-job]:has-text("Blush parity check") [data-port="in:particles"]')
  .first();
const sb = await srcPort.boundingBox();
const db = await dstPort.boundingBox();
if (sb && db) {
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  // two hops so the drag detector (5px) trips and the live wire follows
  await page.mouse.move(sb.x + 60, sb.y + 30, { steps: 4 });
  await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2, { steps: 6 });
  await page.waitForTimeout(250);
  await page.mouse.up();
  await page.waitForTimeout(1500);
  const edgesAfter = await page.evaluate(() => document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]").length);
  must(edgesAfter === edgesBefore + 1, `E1 drag-connect creates a wire (${edgesBefore}→${edgesAfter})`);
  const toast = await page.evaluate(() => document.body.textContent || "");
  must(/Connected/.test(toast), "E2 Connected toast confirms the wire");
} else {
  must(false, "E0 ports not found for the drag test (sb=" + !!sb + " db=" + !!db + ")");
}
await page.screenshot({ path: SHOTS + "t356-e-wired.png" });

console.log("F — reload persistence");
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("[data-job]", { timeout: 60000 });
await page.waitForTimeout(1200);
const f = await page.evaluate(() => ({
  badges: document.querySelectorAll("[data-note-badge]").length,
  edges: document.querySelectorAll("svg[data-edges-layer] g[data-edge-id]").length,
}));
must(f.badges === 2, `F1 both notes persist after reload (${f.badges})`);
must(f.edges === 3, `F2 the new wire persists after reload (${f.edges})`);
await page.screenshot({ path: SHOTS + "t356-f-final.png" });

console.log("G — console/page errors");
must(consoleErrors.length === 0, "G0 zero console/page errors" + (consoleErrors.length ? " — " + consoleErrors.slice(0, 3).join(" ; ") : ""));

await browser.close();
console.log(`\ndiag-t356: ${pass} passed, ${fail} failed ${fail === 0 ? "— ALL GREEN" : "— RED"}`);
process.exit(fail === 0 ? 0 : 1);
