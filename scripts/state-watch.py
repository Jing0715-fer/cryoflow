#!/usr/bin/env python3
"""Watch data/engine-state.json for SHRINK events (the QA-state clobber).
Polls mtime/size every 150ms; on any change logs timestamp+size+keys;
on shrink also dumps which keys vanished. Runs until killed."""
import json, os, sys, time

STATE = "/home/z/my-project/data/engine-state.json"
LOG = "/home/z/my-project/.qa-logs/state-watch.log"

def log(msg):
    with open(LOG, "a") as f:
        f.write(f"[{time.strftime('%H:%M:%S')}] {msg}\n")

prev = None
prev_keys = None
log("watch start")
while True:
    try:
        st = os.stat(STATE)
        sig = (st.st_mtime_ns, st.st_size)
        if sig != prev:
            data = json.load(open(STATE))
            keys = set(data.keys())
            if prev_keys is not None:
                gone = prev_keys - keys
                added = keys - prev_keys
                if gone:
                    log(f"SHRINK size={st.st_size} keys={len(keys)} GONE={sorted(gone)}")
                elif added:
                    log(f"grow size={st.st_size} keys={len(keys)} ADDED={len(added)}")
                else:
                    log(f"rewrite size={st.st_size} keys={len(keys)} (same keys)")
            else:
                log(f"baseline size={st.st_size} keys={len(keys)}")
            prev = sig
            prev_keys = keys
    except Exception as e:
        log(f"err: {e}")
    time.sleep(0.15)
