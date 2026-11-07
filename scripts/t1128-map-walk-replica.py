#!/usr/bin/env python3
"""t1128 — replicate the session report's map walk with raw GETs (no
browser): outputs walk -> volume owners -> the deep measurement's exact
fetch sequence (main + overlays on the Z axis). The window's question:
the demo world's map QC face read 'the profile API refused' on film —
is that the standing shape, or does some leg actually fail?"""
import json
import urllib.request

B = "http://localhost:3000"


def get(path):
    req = urllib.request.Request(B + path, headers={"Origin": B})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


jobs = get("/api/jobs")
jobs = jobs.get("jobs", jobs)
done = [j for j in jobs if j.get("status") == "completed"]
# the walk sorts newest-first (updated/created desc) — use createdAt
done.sort(key=lambda j: j.get("createdAt") or "", reverse=True)
print(f"completed jobs: {len(done)}")

owners = []
for j in done[:24]:
    try:
        out = get(f"/api/jobs/{j['id']}/outputs")
    except Exception as e:
        print(f"  outputs REFUSED {j['type']}: {str(e)[:60]}")
        continue
    files = out.get("files") or []
    volumes = [f for f in files if f.get("kind") == "mrc" and isinstance(f.get("dims"), list) and len(f["dims"]) == 3]
    if not volumes:
        continue
    volumes.sort(key=lambda f: 0 if ("half0" in f["name"] or f["name"].lower().endswith("postprocess.mrc")) else 1)
    owner = {
        "jobId": j["id"],
        "type": j["type"],
        "main": volumes[0],
        "overlays": volumes[1:3],
        "volumeCount": len(volumes),
    }
    owners.append(owner)
    print(f"  OWNER {j['type']:12s} main={volumes[0]['name']} overlays={[o['name'] for o in owner['overlays']]}")

if not owners:
    print("NO OWNERS — the honest empty is the standing shape")
    raise SystemExit(0)

head = owners[0]
print(f"\ndeep measurement on owners[0]: {head['type']} / {head['main']['name']}")
paths = [head["main"]["path"]] + [o["path"] for o in head["overlays"]]
for i, p in enumerate(paths):
    role = "main" if i == 0 else f"overlay{i}"
    try:
        d = get(f"/api/jobs/{head['jobId']}/map-profile?path={urllib.request.quote(p)}&axis=z")
        bins = d.get("bins")
        ok = isinstance(bins, list) and len(bins) > 0
        print(f"  {role}: path={p} -> {'OK bins=' + str(len(bins)) if ok else 'EMPTY BINS (the walk throws here)'}")
    except Exception as e:
        print(f"  {role}: path={p} -> REFUSED: {str(e)[:100]}")
