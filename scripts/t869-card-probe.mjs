const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin" };
const { execSync } = await import("node:child_process");
(async () => {
  const jobs = (await (await fetch("http://localhost:3000/api/jobs", { headers: SH })).json()).jobs;
  const c2d = jobs.find((j) => j.type === "class2d");
  console.log("class2d id:", c2d.id, "status:", c2d.status);
  const probe = '(() => JSON.stringify({ has: !!document.querySelector("[data-card-btn=\\"' + c2d.id + '\\"]"), total: document.querySelectorAll("[data-card-btn]").length, dlg: document.querySelectorAll("[role=dialog]").length, ids: Array.from(document.querySelectorAll("[data-card-btn]")).slice(0, 20).map((b) => b.getAttribute("data-card-btn").slice(0, 14)) }))()';
  const out = execSync(`agent-browser eval ${JSON.stringify(probe)}`, { encoding: "utf8", cwd: process.cwd() });
  console.log("page:", out.trim().slice(0, 500));
})();
