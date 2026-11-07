#!/usr/bin/env python3
"""
t1096 — the #7 hot-path survey, WITH NUMBERS (the worklog's standing order:
"instrument the actual response sizes and parse times on the standing world
first, a design window like the t1094 weighing").

Black-box instrument on the STANDING world (no src/ touched):
  for every job x every chart route (fsc / guinier / angdist / resolution /
  resolution-arc):
    - 3 consecutive GETs with curl timing (total, TTFB) + byte size
    - round 1 approximates the COLD cache (fresh statcache slot if the file
      was never charted this server generation), rounds 2-3 the WARM rides
  summary: per-route totals, the biggest payloads, the slowest calls, and
  the cold->warm delta.

Read-only HTTP — the world is not touched. A 404 (no chart for this job)
is data too: it marks the route as not applicable for that job type.
"""
import json
import subprocess
import sys

BASE = "http://localhost:3000"
ORIGIN = "Origin: http://localhost:3000"
ROUTES = ["fsc", "guinier", "angdist", "resolution", "resolution-arc"]


def sh(cmd: str) -> str:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout


def jobs() -> list[dict]:
    raw = sh(f'curl -s {BASE}/api/jobs -H "{ORIGIN}"')
    data = json.loads(raw)
    return [
        {"id": j["id"], "name": j["name"], "type": j["type"], "status": j["status"]}
        for j in data.get("jobs", [])
    ]


def probe(route: str, job_id: str) -> dict | None:
    """One GET, measured. Transport errors (code 000) get two fresh-
    connection retries with stderr captured — the burst of 80x3 probes
    against the dev lane saw 47 of them land as 000; the retry answers
    whether that is a real drop or dev-lane transient noise."""
    url = f"{BASE}/api/jobs/{job_id}/{route}"
    errs: list[str] = []
    for attempt in range(3):
        out = sh(
            f'curl -s --no-keepalive -o /tmp/t1096-body.json '
            f'-w "%{{http_code}} %{{size_download}} %{{time_total}} '
            f'%{{time_starttransfer}}" -H "{ORIGIN}" "{url}" 2>/tmp/t1096-curl.err'
        )
        parts = out.split()
        if len(parts) != 4:
            errs.append(open("/tmp/t1096-curl.err").read().strip()[:120])
            continue
        if parts[0] == "000":
            errs.append(
                (open("/tmp/t1096-curl.err").read().strip() or "empty reply")[:120]
            )
            continue
        code, size, total, ttfb = parts
        return {
            "code": int(code),
            "bytes": int(size),
            "total_ms": round(float(total) * 1000, 1),
            "ttfb_ms": round(float(ttfb) * 1000, 1),
            "body_head": open("/tmp/t1096-body.json").read(120) if code != "200" else "",
            "retries": attempt,
        }
    return {"code": 0, "bytes": 0, "total_ms": 0.0, "ttfb_ms": 0.0,
            "body_head": " | ".join(errs), "retries": 3}


def main() -> int:
    js = jobs()
    print(f"=== t1096 hot-path survey — {len(js)} jobs x {len(ROUTES)} routes x 3 rides ===")
    rows: list[str] = []
    slowest: list[tuple[float, str]] = []
    biggest: list[tuple[int, str]] = []
    per_route_cold: dict[str, list[float]] = {}
    per_route_warm: dict[str, list[float]] = {}
    code_census: dict[str, int] = {}
    hits = misses = 0

    for j in js:
        for route in ROUTES:
            rides = []
            for i in range(3):
                r = probe(route, j["id"])
                if r is None:
                    rides = []
                    break
                rides.append(r)
            if not rides:
                continue
            r0 = rides[0]
            tag = f"{j['name'][:34]} · {route}"
            code_census[str(r0["code"])] = code_census.get(str(r0["code"]), 0) + 1
            if r0["code"] == 200:
                hits += 1
                warm = min(x["total_ms"] for x in rides[1:]) if len(rides) > 1 else r0["total_ms"]
                per_route_cold.setdefault(route, []).append(r0["total_ms"])
                per_route_warm.setdefault(route, []).append(warm)
                slowest.append((r0["total_ms"], f"{tag} cold={r0['total_ms']}ms warm={warm}ms"))
                biggest.append((r0["bytes"], f"{tag} {r0['bytes']/1024:.1f}KB"))
                rows.append(
                    f"HIT  {tag:46s} cold {r0['total_ms']:8.1f}ms  warm {warm:8.1f}ms  {r0['bytes']/1024:9.1f}KB"
                )
            else:
                misses += 1
                rows.append(
                    f"{r0['code']}  {tag:46s} {r0['body_head'][:60]}"
                )

    print(f"\n-- census: {hits} chart-riding (job,route) pairs, {misses} non-applicable --")
    print(f"-- status codes: {code_census} --")

    print("\n-- per-route latency (ms): cold=1st ride, warm=best of rides 2-3 --")
    for route in ROUTES:
        c, w = per_route_cold.get(route, []), per_route_warm.get(route, [])
        if not c:
            continue
        c2, w2 = sorted(c), sorted(w)
        med = lambda a: a[len(a) // 2]
        print(
            f"{route:16s} n={len(c):3d}  cold p50={med(c2):8.1f} max={c2[-1]:9.1f}"
            f"  |  warm p50={med(w2):8.1f} max={w2[-1]:9.1f}"
        )

    print("\n-- the five slowest cold calls --")
    for ms, tag in sorted(slowest, reverse=True)[:5]:
        print(f"{ms:9.1f}ms  {tag}")
    print("\n-- the five biggest payloads --")
    for b, tag in sorted(biggest, reverse=True)[:5]:
        print(f"{b/1024:9.1f}KB  {tag}")

    verdict = "HOT" if (per_route_warm and max(max(v) for v in per_route_warm.values()) > 150) else "COOL"
    print(f"\nVERDICT (black-box): warm rides all under 150ms -> COOL, else HOT -> {verdict}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
