#!/usr/bin/env python3
"""t562 — enumerate select-family jobs across worlds via sqlite."""
import sqlite3, json

con = sqlite3.connect("file:/home/z/my-project/db/cryoflow.db?mode=ro", uri=True)
rows = con.execute(
    "SELECT id, projectId, type, name, status, result FROM Job WHERE type IN ('select','select2d') ORDER BY projectId, name"
).fetchall()
for r in rows:
    print(f"{r[0]}  {r[2]:9s} {r[4]:9s} {r[3][:34]:34s} | {(r[5] or '')[:52]}")
print(f"-- {len(rows)} select-family jobs")
