#!/usr/bin/env python3
"""t704 bookmark census — the bookmark world's own enforcement instrument.

The bookmark world spans three layers:
  storage   BookmarkSession rows (jobId @unique, data = JSON entries)
  doors     GET/PUT /api/jobs/:id/camera-bookmarks (strict whitelist owner)
            GET     /api/views/gallery (read-only aggregate, looser shape)
  consumers molstar-embed (dual mirror: localStorage + server row),
            project-dashboard Saved-views wall, command-palette jump surface

The route's own contract claims: "a bookmark cannot go stale: the snapshot
is pure camera numbers with no reference to files, so there is no self-heal
pass here".  That claim has never been mechanically audited — until now.
t700 taught the thumbnail law (declared codec must match magic bytes) for
ONE session; this census applies it to every row and adds the layers t700
could not see from a single session:

  A. storage truth   row -> job FK live; entry shape; thumb codec honesty
                     (magic bytes + IHDR/SOF dims); the "pure camera
                     numbers" contract scanned mechanically (no file refs);
                     ts sanity and the write-after-claim invariant
                     (max entry ts <= row updatedAt + 61s, the PUT clamp).
  B. door replay     the route's own sanitize() replicated in this script
                     and replayed against the stored row — a row that would
                     SHRINK through its own door (silent entry drop) is a
                     two-voice divergence (t702 pattern).  Then the live
                     GETs over HTTP must agree with storage (id set, names,
                     ts, thumbs).
  C. contract echo   count cap (8), thumb char cap (48_000), data-URL
                     vocabulary (png|jpeg only at the strict door).

Read-only, re-runnable, world-following (no row counts or ids hardcoded;
every assertion is structural).  Exit 0 iff zero failures.
"""

import base64
import json
import re
import sqlite3
import struct
import sys
import time
import urllib.request
from datetime import datetime, timezone

REPO = "/home/z/my-project"
DB = f"{REPO}/db/cryoflow.db"
BASE = "http://localhost:3000"

PASS = 0
FAIL = 0
FLAGS = []


def ok(name, detail=""):
    global PASS
    PASS += 1
    print(f"  ok: {name}" + (f" ({detail})" if detail else ""))


def bad(name, detail=""):
    global FAIL
    FAIL += 1
    FLAGS.append(f"{name}: {detail}")
    print(f"  FAIL: {name} — {detail}")


def check(cond, name, detail=""):
    ok(name, detail) if cond else bad(name, detail)


# ---------------------------------------------------------------- the door's
# own sanitize(), replicated faithfully from
# src/app/api/jobs/[id]/camera-bookmarks/route.ts (L51-158).  Any drift
# between this port and the route is a census artefact — keep them in sync.
MAX_BOOKMARKS = 8
MAX_THUMB_CHARS = 48_000
THUMB_RE = re.compile(r"^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")


def bounded(v, lo, hi, fallback):
    if isinstance(v, (int, float)) and not isinstance(v, bool) and v == v and abs(v) != float("inf"):
        return min(hi, max(lo, v))
    return fallback


def vec3(raw):
    if not isinstance(raw, list) or len(raw) != 3:
        return None
    out = []
    for n in raw:
        if isinstance(n, bool) or not isinstance(n, (int, float)) or n != n or abs(n) == float("inf"):
            return None
        out.append(min(1e9, max(-1e9, n)))
    return out


def sanitize_view(raw):
    if not isinstance(raw, dict):
        return None
    sl = raw.get("slice") or {}
    cp = raw.get("clip") or {}
    if not isinstance(sl, dict):
        sl = {}
    if not isinstance(cp, dict):
        cp = {}
    axis = sl.get("axis") if sl.get("axis") in ("X", "Y", "Z") else "Z"
    focus = None
    fc = raw.get("focus")
    if isinstance(fc, dict):
        focus = {
            "x": bounded(fc.get("x"), 0, 1, 0.5),
            "y": bounded(fc.get("y"), 0, 1, 0.5),
            "z": bounded(fc.get("z"), 0, 1, 0.5),
        }
    v = {
        "sigma": bounded(raw.get("sigma"), 0.01, 100, 2),
        "sign": -1 if raw.get("sign") == -1 else 1,
        "slice": {"on": sl.get("on") is True, "axis": axis, "pos": bounded(sl.get("pos"), 0, 1, 0.5)},
        "clip": {
            "on": cp.get("on") is True,
            "x": bounded(cp.get("x"), 0, 1, 1),
            "y": bounded(cp.get("y"), 0, 1, 1),
            "z": bounded(cp.get("z"), 0, 1, 1),
            "invert": cp.get("invert") is True,
        },
    }
    if focus:
        v["focus"] = focus
    return v


def sanitize_snapshot(raw):
    if not isinstance(raw, dict):
        return None
    out = {}
    mode = raw.get("mode")
    if isinstance(mode, str) and mode:
        out["mode"] = mode[:32]
    out["fov"] = bounded(raw.get("fov"), 0.001, 3.141592653589793, 0.876)
    pos, up, tgt = vec3(raw.get("position")), vec3(raw.get("up")), vec3(raw.get("target"))
    if pos is None or up is None or tgt is None:
        return None
    out["position"], out["up"], out["target"] = pos, up, tgt
    out["radius"] = bounded(raw.get("radius"), 1e-6, 1e12, 10)
    out["radiusMax"] = bounded(raw.get("radiusMax"), 1e-6, 1e12, 1e4)
    out["fog"] = bounded(raw.get("fog"), 0, 1e12, 0)
    out["clipFar"] = bounded(raw.get("clipFar"), 0, 1e12, 0)
    out["minNear"] = bounded(raw.get("minNear"), -1e9, 1e9, 0)
    out["minFar"] = bounded(raw.get("minFar"), 0, 1e12, 0)
    return out


def route_sanitize(raw, now_ms):
    """the route's sanitize() at replay time (ts clamped to now+60_000)"""
    if not isinstance(raw, list):
        return []
    out = []
    for r in raw[:MAX_BOOKMARKS]:
        if not isinstance(r, dict):
            continue
        eid = r.get("id")
        name = r.get("name")
        ts = r.get("ts")
        if not isinstance(eid, str) or not eid or len(eid) > 64:
            continue
        if not isinstance(name, str) or not name:
            continue
        if isinstance(ts, bool) or not isinstance(ts, (int, float)) or ts != ts or abs(ts) == float("inf"):
            continue
        snap = sanitize_snapshot(r.get("snapshot"))
        if snap is None:
            continue
        e = {"id": eid[:64], "name": name[:80], "ts": min(now_ms + 60_000, max(0, ts)), "snapshot": snap}
        thumb = r.get("thumb")
        if isinstance(thumb, str) and len(thumb) <= MAX_THUMB_CHARS and THUMB_RE.match(thumb):
            e["thumb"] = thumb
        view = sanitize_view(r.get("view"))
        if view:
            e["view"] = view
        out.append(e)
    return out


# ------------------------------------------------------------- image probing
def png_dims(b):
    if len(b) < 24 or b[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    w, h = struct.unpack(">II", b[16:24])
    return (w, h)


def jpeg_dims(b):
    if len(b) < 4 or b[:3] != b"\xff\xd8\xff":
        return None
    i = 2
    while i + 9 < len(b):
        if b[i] != 0xFF:
            i += 1
            continue
        marker = b[i + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        seglen = struct.unpack(">H", b[i + 2 : i + 4])[0]
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">HH", b[i + 5 : i + 9])
            return (w, h)
        i += 2 + seglen
    return None


MAGIC = {"png": b"\x89PNG", "jpeg": b"\xff\xd8\xff"}


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=10) as r:
        return json.loads(r.read().decode())


def iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{int(ms) % 1000:03d}Z"


# =============================================================== Layer A: DB
print("== A. storage truth (BookmarkSession rows) ==")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
try:
    rows = con.execute(
        "SELECT b.id AS row_id, b.jobId AS job_id, b.data, b.updatedAt AS updated_at,"
        "       j.id AS jid, j.type AS jtype, j.name AS jname"
        "  FROM BookmarkSession b LEFT JOIN Job j ON j.id = b.jobId"
        " ORDER BY b.updatedAt DESC"
    ).fetchall()
finally:
    con.close()

check(len(rows) > 0, "bookmark world is non-empty (rows present)", f"{len(rows)} row(s)")
now_ms = int(time.time() * 1000)
total_entries = 0

for row in rows:
    rid = row["row_id"]
    jid = row["job_id"]
    jlabel = f"{row['jtype']}/{row['jname']}" if row["jid"] else None
    print(f"  row {rid} -> job {jid} ({jlabel or 'DEAD FK'})")

    # A1 — the reference resolves: every row rides a live job
    check(row["jid"] is not None, f"A1 [{rid}] row's job FK resolves to a live job", jid)

    try:
        entries = json.loads(row["data"])
    except Exception as e:
        bad(f"A2 [{rid}] row data parses as JSON", repr(e))
        continue
    if not isinstance(entries, list):
        bad(f"A2 [{rid}] row data is a JSON array", type(entries).__name__)
        continue

    # A6 — the door's count cap holds in storage
    check(len(entries) <= MAX_BOOKMARKS, f"A6 [{rid}] entries within the door's cap of {MAX_BOOKMARKS}", f"{len(entries)}")

    # C2 — write-after-claim invariant: the row cannot have been written
    # before its newest entry claims to exist (PUT clamps ts to now+60s)
    updated_ms = row["updated_at"]
    if entries and all(isinstance(e.get("ts"), (int, float)) for e in entries if isinstance(e, dict)):
        max_ts = max(e.get("ts", 0) for e in entries if isinstance(e, dict))
        check(
            max_ts <= updated_ms + 61_000,
            f"A5 [{rid}] newest entry ts <= row updatedAt + 61s (write-after-claim)",
            f"max ts {iso(max_ts)} <= updatedAt {iso(updated_ms)}",
        )

    for idx, e in enumerate(entries):
        tag = f"[{rid}/{e.get('id', '?') if isinstance(e, dict) else '?'}]"
        if not isinstance(e, dict):
            bad(f"A2 {tag} entry is an object", type(e).__name__)
            continue
        total_entries += 1

        # A2 — shape: id / name / ts / snapshot(the pose IS three vec3s)
        eid = e.get("id")
        check(isinstance(eid, str) and 0 < len(eid) <= 64, f"A2 {tag} id is a nonempty string <= 64 chars", f"len={len(eid) if isinstance(eid, str) else '?'}")
        name = e.get("name")
        check(isinstance(name, str) and bool(name), f"A2 {tag} name is a nonempty string", name if isinstance(name, str) else "")
        ts = e.get("ts")
        check(
            isinstance(ts, (int, float)) and not isinstance(ts, bool) and 0 < ts <= now_ms + 61_000,
            f"A5 {tag} ts finite and within the door's future clamp",
            iso(ts) if isinstance(ts, (int, float)) else "?",
        )
        snap = e.get("snapshot")
        has_pose = isinstance(snap, dict) and all(
            isinstance(snap.get(k), list) and len(snap[k]) == 3 and all(isinstance(n, (int, float)) for n in snap[k])
            for k in ("position", "up", "target")
        )
        check(has_pose, f"A2 {tag} snapshot carries the pose (position/up/target vec3s)")
        if has_pose:
            big = any(abs(n) > 1e9 for k in ("position", "up", "target") for n in snap[k])
            check(not big, f"A7 {tag} camera numbers within the door's 1e9 bounds")

        # A3 — thumbnail codec honesty (the t700 law, every row): declared
        # MIME must be png|jpeg AND match the payload's magic bytes; dims recorded
        thumb = e.get("thumb")
        if thumb is None:
            ok(f"A3 {tag} has no thumbnail (legal — thumb is optional)")
        else:
            m = re.match(r"^data:image/(png|jpeg);base64,(.*)$", thumb, re.S)
            declared = m.group(1) if m else None
            check(declared is not None, f"A3 {tag} thumb declared vocabulary is png|jpeg", (thumb[:30] + "...") if declared is None else declared)
            if declared:
                payload = base64.b64decode(m.group(2)) if m else b""
                magic = MAGIC[declared]
                honest = payload[: len(magic)] == magic
                check(honest, f"A3 {tag} thumb codec honesty — bytes prove the declared codec", f"declared {declared}, magic {payload[:4].hex()}")
                dims = png_dims(payload) if declared == "png" else jpeg_dims(payload)
                check(dims is not None, f"A3 {tag} thumb payload decodes as a real image", f"{dims[0]}x{dims[1]} px" if dims else "no SOF/IHDR")
                check(len(thumb) <= MAX_THUMB_CHARS, f"C1 {tag} thumb within the 48_000-char door cap", f"{len(thumb)} chars")

        # A8 — view state shape (sigma/sign/slice/clip/focus)
        view = e.get("view")
        if view is None:
            ok(f"A8 {tag} has no view state (legal — legacy rows never carry it)")
        else:
            v_ok = (
                isinstance(view, dict)
                and isinstance(view.get("sigma"), (int, float))
                and 0.01 <= view["sigma"] <= 100
                and view.get("sign") in (-1, 1)
                and isinstance(view.get("slice"), dict)
                and view["slice"].get("axis") in ("X", "Y", "Z")
                and isinstance(view.get("clip"), dict)
            )
            check(v_ok, f"A8 {tag} view state shape (sigma/sign/slice/clip)")
            focus = view.get("focus") if isinstance(view, dict) else None
            if focus is not None:
                f_ok = isinstance(focus, dict) and all(
                    isinstance(focus.get(k), (int, float)) and 0 <= focus[k] <= 1 for k in ("x", "y", "z")
                )
                check(f_ok, f"A8 {tag} focus point within [0,1]^3 (t279 fractional language)")

        # A4 — the anti-staleness contract, scanned mechanically: a bookmark
        # holds pure camera numbers; NO string anywhere (outside thumb's
        # data-URL) may look like a file reference
        file_smell = re.compile(r"\.(mrc|star|png|jpe?g|json|sav|txt|log|err)\b", re.I)
        path_smell = re.compile(r"^/[A-Za-z0-9_./\-]+$")
        key_smell = {"path", "file", "filename", "filepath", "relion", "star", "mrc", "movie", "micrograph"}
        violations = []

        def scan(node, key=None):
            if isinstance(node, dict):
                for k, v in node.items():
                    if str(k).lower() in key_smell and k != "snapshot":
                        violations.append(f"key '{k}'")
                    scan(v, k)
            elif isinstance(node, list):
                for v in node:
                    scan(v, key)
            elif isinstance(node, str):
                if file_smell.search(node) or path_smell.match(node):
                    violations.append(f"value {node[:60]!r}")

        scan({k: v for k, v in e.items() if k != "thumb"})
        check(not violations, f"A4 {tag} pure camera numbers — no file references (the anti-staleness contract)", "; ".join(violations[:3]))

# ============================================================ Layer B: doors
print("== B. door replay (the route's own sanitize, then the live GETs) ==")
con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
try:
    rows2 = con.execute(
        "SELECT b.id AS row_id, b.jobId AS job_id, b.data FROM BookmarkSession b ORDER BY b.updatedAt DESC"
    ).fetchall()
finally:
    con.close()

for row in rows2:
    rid, jid = row["row_id"], row["job_id"]
    try:
        stored = json.loads(row["data"])
    except Exception:
        continue  # already flagged in A

    # B1 — the row survives its own door unchanged (no silent shrink)
    replay = route_sanitize(stored, now_ms)
    shrink = len(replay) < len([e for e in stored if isinstance(e, dict)])
    check(not shrink, f"B1 [{rid}] stored row passes its own door without shrinking", f"{len(stored)} -> {len(replay)}")
    if not shrink:
        check(stored == replay, f"B1 [{rid}] stored row is byte-equal to its own door's replay (already-sanitized shape)")

    # B2 — the live per-job GET agrees with storage
    try:
        live = fetch_json(f"{BASE}/api/jobs/{jid}/camera-bookmarks")
        lb = live.get("bookmarks")
        check(isinstance(lb, list) and lb == replay, f"B2 [{jid}] live GET camera-bookmarks == door replay of storage", f"{len(lb) if isinstance(lb, list) else '?'} entries")
    except Exception as e:
        bad(f"B2 [{jid}] live GET camera-bookmarks reachable", repr(e))

    # B3 — the gallery aggregate includes this row, entries equal (thumbs pass through)
    try:
        gal = fetch_json(f"{BASE}/api/views/gallery")
        views = gal.get("views", [])
        mine = [v for v in views if v.get("jobId") == jid]
        check(len(mine) == 1, f"B3 [{jid}] gallery includes exactly one card for this job", f"{len(mine)} card(s)")
        if mine:
            gb = mine[0].get("bookmarks", [])
            stored_d = {e["id"]: e for e in stored if isinstance(e, dict)}
            gal_d = {e.get("id"): e for e in gb if isinstance(e, dict)}
            check(
                set(gal_d) == set(stored_d) and all(
                    stored_d[i].get("name") == gal_d[i].get("name")
                    and stored_d[i].get("ts") == gal_d[i].get("ts")
                    and stored_d[i].get("thumb") == gal_d[i].get("thumb")
                    for i in stored_d
                ),
                f"B3 [{jid}] gallery entries equal storage (id/name/ts/thumb passthrough)",
                f"{len(gb)} entries",
            )
    except Exception as e:
        bad(f"B3 [{jid}] live GET gallery reachable", repr(e))

# ================================================= Layer D: overlay sibling
# OverlaySession is the bookmark's file-reference twin: entries hold PATHS
# (relative to the job workdir) instead of pure camera numbers, so the two
# tables carry OPPOSITE contracts — bookmarks can never go stale (nothing
# to rot), overlays MUST self-heal (paths re-validated against the job's
# live mrc outputs on every restore, molstar-embed restore filter).  The
# table is empty today — the instrument arrives before the first entry.
print("== D. overlay sibling (OverlaySession — the file-reference twin) ==")


def overlay_sanitize(raw):
    """the overlay route's sanitize(), ported from overlay-session/route.ts"""
    if not isinstance(raw, list):
        return []
    out = []
    for r in raw[:12]:
        if not isinstance(r, dict):
            continue
        p = r.get("path")
        if not isinstance(p, str) or not p or len(p) > 512 or "\0" in p:
            continue
        name = r.get("name")
        if not isinstance(name, str) or not name:
            continue
        color = r.get("color")
        if not isinstance(color, str) or not re.match(r"^#[0-9a-fA-F]{6}$", color):
            continue
        alpha = r.get("alpha")
        alpha = (
            min(1, max(0.05, alpha))
            if isinstance(alpha, (int, float)) and not isinstance(alpha, bool) and alpha == alpha and abs(alpha) != float("inf")
            else 0.55
        )
        so = r.get("sigmaOffset")
        so = (
            min(3, max(-3, so))
            if isinstance(so, (int, float)) and not isinstance(so, bool) and so == so and abs(so) != float("inf")
            else 0
        )
        out.append({"path": p[:512], "name": name[:160], "color": color.lower(), "alpha": alpha, "sigmaOffset": so})
    return out


con = sqlite3.connect(DB)
con.row_factory = sqlite3.Row
try:
    rows_o = con.execute(
        "SELECT o.id AS row_id, o.jobId AS job_id, o.data, o.updatedAt AS updated_at,"
        "       j.id AS jid, j.type AS jtype, j.name AS jname"
        "  FROM OverlaySession o LEFT JOIN Job j ON j.id = o.jobId"
    ).fetchall()
finally:
    con.close()

ok("D0 overlay world measured", f"{len(rows_o)} row(s)")

for row in rows_o:
    rid, jid = row["row_id"], row["job_id"]
    check(row["jid"] is not None, f"D1 [{rid}] overlay row's job FK resolves to a live job", jid)
    try:
        stored = json.loads(row["data"])
    except Exception as e:
        bad(f"D2 [{rid}] overlay row data parses as JSON", repr(e))
        continue
    if not isinstance(stored, list):
        bad(f"D2 [{rid}] overlay row data is a JSON array", type(stored).__name__)
        continue

    check(len(stored) <= 12, f"D3 [{rid}] overlay entries within the door's cap of 12", f"{len(stored)}")

    # D4 — the reference-resolution twin of A4: every stored path must sit
    # in the job's live mrc outputs listing (the restore filter's necessary
    # condition).  A miss here is NOT corruption — the contract self-heals
    # on next visit — but the census measures the staleness debt honestly.
    live_mrc = None
    try:
        outp = fetch_json(f"{BASE}/api/jobs/{jid}/outputs")
        live_mrc = {f.get("path") for f in (outp.get("files") or []) if f.get("kind") == "mrc"}
    except Exception as e:
        bad(f"D4 [{jid}] live outputs listing reachable", repr(e))
    if live_mrc is not None:
        for e in stored:
            if not isinstance(e, dict):
                continue
            p = e.get("path")
            tag = f"[{rid}/{p}]"
            check(isinstance(p, str) and p in live_mrc, f"D4 {tag} path resolves into the job's live mrc outputs (self-heal debt: none)")
            shape_ok = (
                isinstance(e.get("name"), str) and bool(e.get("name"))
                and isinstance(e.get("color"), str) and bool(re.match(r"^#[0-9a-f]{6}$", e.get("color", "")))
                and isinstance(e.get("alpha"), (int, float)) and 0.05 <= e["alpha"] <= 1
                and isinstance(e.get("sigmaOffset"), (int, float)) and -3 <= e["sigmaOffset"] <= 3
            )
            check(shape_ok, f"D2 {tag} entry shape (path/name/color/alpha/sigmaOffset within door clamps)")

    replay = overlay_sanitize(stored)
    check(stored == replay, f"D5 [{rid}] stored overlay row survives its own door unchanged", f"{len(stored)} -> {len(replay)}")
    try:
        live = fetch_json(f"{BASE}/api/jobs/{jid}/overlay-session")
        check(live.get("entries") == replay, f"D6 [{jid}] live GET overlay-session == door replay of storage", f"{len(live.get('entries') or [])} entries")
    except Exception as e:
        bad(f"D6 [{jid}] live GET overlay-session reachable", repr(e))

print(f"== totals: entries audited = {total_entries}, rows = {len(rows)} ==")
print(f"==== t704 bookmark census: {PASS} pass / {FAIL} fail ====")
sys.exit(1 if FAIL else 0)
