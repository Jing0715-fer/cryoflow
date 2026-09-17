#!/usr/bin/env python3
"""t263 row flip — parameterized DB write for the crafted sweep fixtures.

The restore-gallery precedent: PATCH only allows idle, so suites that need
running/pending rows (the sweep heal inputs) write them straight in the DB.
Values travel as argv and land in parameterized SQL — no quoting nests.
"""
import sqlite3
import sys

jid, status, progress = sys.argv[1], sys.argv[2], int(sys.argv[3])
result = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "" else None

con = sqlite3.connect("/home/z/my-project/db/custom.db", timeout=10)
cur = con.cursor()
if result is None:
    cur.execute("UPDATE Job SET status=?, progress=? WHERE id=?", (status, progress, jid))
else:
    cur.execute(
        "UPDATE Job SET status=?, progress=?, result=? WHERE id=?",
        (status, progress, result, jid),
    )
con.commit()
print(cur.execute("SELECT changes()").fetchone()[0])
