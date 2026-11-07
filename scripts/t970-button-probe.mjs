#!/usr/bin/env node
/**
 * t970 — the +8 BUTTON probe (the t969 exoneration template: a LEAK that
 * reads as an absolute child is a probe away from a NON-item — probe
 * before curing). The failed-face walk's only standing LEAK is an 8px
 * button (inline-flex items-center justify-center whitespace-nowrap, no
 * text). The t969 walk's residue was the CopyButton's ::before hit-slop
 * (Task 171's designed touch-target extension riding over a non-
 * interactive pre). This probe reads the button's identity, its absolute
 * children, and its ::before/::after boxes, then names the +8.
 */
import { execSync } from "node:child_process";

const AB = "agent-browser";

const sh = (cmd) => { try { return execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim(); } catch (e) { return String(e?.stdout ?? e); } };
const evalJson = (expr) => {
  let out;
  try { out = execSync(`${AB} eval --stdin`, { encoding: "utf8", timeout: 120_000, input: expr }).trim(); }
  catch (e) { out = String(e?.stdout ?? "") || "null"; }
  try {
    const q = out.indexOf('"');
    if (q > 0) out = out.slice(q);
    const once = JSON.parse(out);
    if (typeof once === "string") { try { return JSON.parse(once); } catch { return once; } }
    return once;
  } catch { return out; }
};

const probe = evalJson(`(() => {
  const dlg = [...document.querySelectorAll('[data-inspector-dialog]')].find(x => (x.textContent || '').includes('Failed Diagnosis Face (t970)'));
  if (!dlg) return JSON.stringify({ err: "no-dialog" });
  const btns = [...dlg.querySelectorAll("button")].map((b) => {
    const sw = b.scrollWidth, cw = b.clientWidth;
    if (sw <= cw + 1) return null;
    const before = getComputedStyle(b, "::before");
    const after = getComputedStyle(b, "::after");
    const abs = [...b.querySelectorAll("*")].filter((c) => getComputedStyle(c).position === "absolute").map((c) => ({ tag: c.tagName.toLowerCase(), cls: String(c.className || "").slice(0, 80), w: Math.round(c.getBoundingClientRect().width) }));
    const r = b.getBoundingClientRect();
    return {
      over: sw - cw, sw, cw,
      aria: b.getAttribute("aria-label") ?? "",
      title: b.getAttribute("title") ?? "",
      text: (b.textContent || "").trim().slice(0, 40),
      cls: String(b.className).slice(0, 140),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      before: { content: before.content, pos: before.position, inset: before.inset, w: before.width },
      after: { content: after.content, pos: after.position, inset: after.inset },
      absChildren: abs,
      parentCls: String(b.parentElement?.className || "").slice(0, 80),
    };
  }).filter(Boolean);
  return JSON.stringify({ btns });
})()`);

console.log(JSON.stringify(probe, null, 2));
