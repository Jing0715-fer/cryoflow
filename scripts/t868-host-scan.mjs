const SH = { Origin: "http://localhost:3000", Referer: "http://localhost:3000/", "Sec-Fetch-Site": "same-origin", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Dest": "empty" };
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const fetchRetry = async (url, opts = {}, attempt = 0) => {
  try { return await fetch(url, opts); }
  catch (e) {
    if (attempt >= 24) throw e;
    if (attempt === 0) console.log(`(server down — retrying through the reboot)`);
    await sleep(5);
    return fetchRetry(url, opts, attempt + 1);
  }
};
(async () => {
  const r = await fetchRetry("http://localhost:3000/api/jobs", { headers: SH });
  const b = await r.json();
  const jobs = b.jobs ?? b;
  const done = jobs.filter((x) => x.status === "completed");
  console.log("completed:", done.length);
  const hosts = [];
  for (const j of done) {
    try {
      const rr = await fetchRetry(`http://localhost:3000/api/jobs/${j.id}/outputs`, { headers: SH });
      const ob = await rr.json();
      const files = ob.files ?? ob;
      const texts = (Array.isArray(files) ? files : []).filter((f) => f.kind === "text");
      if (texts.length) {
        const biggest = Math.max(...texts.map((t) => t.size ?? 0));
        hosts.push({ id: j.id, type: j.type, name: j.name, biggest, texts: texts.map((t) => `${t.name}:${t.size}`).join(" | ") });
      }
    } catch (e) { console.log("ERR", j.id, e.message); }
  }
  hosts.sort((a, z) => z.biggest - a.biggest);
  for (const h of hosts.slice(0, 8)) console.log(h.type.padEnd(12), String(h.biggest).padStart(9), h.name, h.id, "::", h.texts.slice(0, 110));
})();
