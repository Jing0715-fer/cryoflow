// t652 — read-only census: every STAR file the active project's jobs
// expose, and the width shape of each (max cell length per column).
// Purpose: pick the honest cap for column-width adaptation and find a
// long-path specimen if one exists (hover-reveal's e2e anchor).
const BASE = "http://localhost:3000";
const hdrs = { "Origin": BASE, "Referer": `${BASE}/` };

const jobsJson = await (await fetch(`${BASE}/api/jobs`, { headers: hdrs })).json();
const jobs = jobsJson?.jobs ?? jobsJson;
console.log(`active project jobs: ${Array.isArray(jobs) ? jobs.length : "?"}`);

let starCount = 0;
for (const job of Array.isArray(jobs) ? jobs : []) {
  let outs;
  try {
    outs = await (await fetch(`${BASE}/api/jobs/${job.id}/outputs`, { headers: hdrs })).json();
  } catch { continue; }
  const stars = (outs?.files ?? outs ?? []).filter((f) => /\.star$/i.test(f?.path ?? f?.name ?? ""));
  for (const s of stars) {
    const p = s.path ?? s.name;
    starCount++;
    let d;
    try {
      d = await (await fetch(`${BASE}/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(p)}&rows=100`, { headers: hdrs })).json();
    } catch (e) { console.log(`  ${job.name} / ${p}: parse fail ${e.message}`); continue; }
    if (!d?.columns) { console.log(`  ${job.name} / ${p}: no loop block (note: ${d?.note?.slice(0, 40)})`); continue; }
    const maxes = d.columns.map((c, i) => {
      let m = 0;
      for (const r of d.rows) m = Math.max(m, (r[i] ?? "").length);
      return `${c.replace(/^_rln/, "")}:${m}`;
    });
    const overall = Math.max(...d.columns.map((_, i) => Math.max(0, ...d.rows.map((r) => (r[i] ?? "").length))));
    console.log(`  ${job.name} / ${p} — ${d.columns.length}col ${d.rowCount}rows maxcell=${overall}${overall > 72 ? "  <== LONG" : ""}`);
    console.log(`     ${maxes.join("  ")}`);
  }
}
console.log(`total star files: ${starCount}`);
