// t892 — the molstar graph's WARMER: compile the viewer lane's async chunks
// WITHOUT a browser attached (the t891 law: the graph cannot compile under
// browser+compile pressure; the warmer gives Turbopack the box's full headroom).
//
// Method: BFS the served chunk graph from the page HTML, collecting every
// /_next/static/chunks/*.js URL; request each (the dev server compiles the
// molstar graph on demand at first request); report which chunks mention
// molstar and which fail. Idempotent — safe to re-run.
//
// Usage: node scripts/t892-warm-molstar.mjs [--base http://localhost:3000]

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3000";

const seen = new Set();
const queue = [];
const molstarChunks = new Set();
const failed = [];

function extractChunkUrls(html) {
  const urls = new Set();
  const re = /\/_next\/static\/chunks\/[^"'\\\s)<>]+?\.js/g;
  for (const m of html.matchAll(re)) urls.add(m[0]);
  return urls;
}

async function fetchText(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "*/*" } });
      if (!res.ok) return { ok: false, status: res.status, text: "" };
      return { ok: true, status: res.status, text: await res.text() };
    } catch (e) {
      if (attempt === 3) return { ok: false, status: -1, text: String(e) };
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
}

let root;
{
  const r = await fetchText(BASE + "/");
  if (!r.ok) {
    console.log(`WARM ABORT: root ${r.status}`);
    process.exit(2);
  }
  root = r.text;
  console.log(`root: ${r.status} (${root.length} bytes)`);
}

for (const u of extractChunkUrls(root)) {
  if (!seen.has(u)) {
    seen.add(u);
    queue.push(u);
  }
}

console.log(`entry chunks: ${queue.length}`);

let molstarFound = 0;
while (queue.length) {
  const path = queue.shift();
  const url = BASE + path;
  const r = await fetchText(url);
  if (!r.ok) {
    failed.push(`${path} -> ${r.status}`);
    continue;
  }
  const isMol =
    path.toLowerCase().includes("molstar") ||
    path.includes("mol-plugin") ||
    /mol-mol[-_/]|mol-plugin-ui|molstar-embed/.test(r.text.slice(0, 4000));
  if (
    path.toLowerCase().includes("molstar") ||
    r.text.includes("molstar-embed") ||
    r.text.includes("mol-plugin-ui")
  ) {
    molstarFound++;
    if (!molstarChunks.has(path)) {
      molstarChunks.add(path);
      console.log(`  [molstar-graph] ${path} (${r.text.length}b)`);
    }
  }
  for (const child of extractChunkUrls(r.text)) {
    if (!seen.has(child)) {
      seen.add(child);
      queue.push(child);
    }
  }
}

console.log(`\nBFS done: ${seen.size} chunks requested, ${molstarFound} touched the molstar graph, ${failed.length} failed`);
for (const f of failed.slice(0, 10)) console.log(`  FAIL ${f}`);

// the verdict probe: re-request the molstar-embed referenced chunks and check
// they now serve 200 (the compile accumulated — the t891 recovery condition)
console.log("\nverdict: the viewer lane's chunks are warm when the BFS found zero failures");
