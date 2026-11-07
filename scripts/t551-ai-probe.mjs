#!/usr/bin/env node
/* t551 — one-shot AI lane probe: send a trivial no-tool question, report
 * the verdict (ALIVE / 429 / other). Read-only: does not touch jobs. */
const BASE = "http://localhost:3000";
const SH = { Origin: BASE, Referer: `${BASE}/`, "Content-Type": "application/json" };
const t0 = Date.now();
const r = await fetch(`${BASE}/api/ai/chat`, {
  method: "POST", headers: SH,
  body: JSON.stringify({ message: "Reply with exactly the word: ALIVE" }),
});
const j = await r.json().catch(() => ({}));
const text = j.finalText ?? j.text ?? "";
console.log(`status: ${r.status} · ${Date.now() - t0}ms · sessionId: ${j.sessionId?.slice(0, 12) ?? "none"}`);
console.log(`finalText: ${JSON.stringify((text || "").slice(0, 120))}`);
if (r.status === 429 || /rate|429/i.test(text)) console.log("VERDICT: RATE-LIMITED");
else if (r.status === 200 && text) console.log("VERDICT: ALIVE");
else console.log("VERDICT: OTHER", JSON.stringify(j).slice(0, 200));
