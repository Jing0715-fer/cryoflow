#!/usr/bin/env python3
"""t263 row flip — parameterized DB write for the crafted sweep fixtures.

The restore-gallery precedent: PATCH only allows idle, so suites that need
running/pending rows (the sweep heal inputs) write them straight in the DB.
Values travel as argv and land in parameterized SQL — no quoting nests.

t291 — the db is RESOLVED BY JOB ID, not hardcoded. This sandbox carries a
stale db/custom.db next to the canonical db/cryoflow.db (.env.example's
documented path), and a poisoned .env pointing at the former — the previous
hardcode flipped rows in a db the server never read, the crafted rows stayed
idle, and the orphan heals never fired (t263 phase C6 failures with zero
product-code involvement). The suite creates its jobs through the API seconds
before flipping, so the db where the job's row actually lives IS the server's
db — follow the job, not the path.
"""
import os
import sqlite3
import sys

jid, status, progress = sys.argv[1], sys.argv[2], int(sys.argv[3])
result = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "" else None

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def candidate_paths():
    """Where the server's db might live, most-likely first."""
    # 1. DATABASE_URL (Prisma resolves `file:` relative to prisma/)
    url = os.environ.get("DATABASE_URL", "")
    if url.startswith("file:"):
        yield os.path.normpath(os.path.join(REPO, "prisma", url[len("file:"):]))
    # 2. the canonical documented path (.env.example)
    yield os.path.join(REPO, "db", "cryoflow.db")


def flip(path):
    """Flip the row IF this db holds the job; None = wrong db."""
    if not os.path.exists(path):
        return None
    con = sqlite3.connect(path, timeout=10)
    try:
        cur = con.cursor()
        has = cur.execute("SELECT COUNT(*) FROM Job WHERE id=?", (jid,)).fetchone()[0]
        if not has:
            return None
        if result is None:
            cur.execute("UPDATE Job SET status=?, progress=? WHERE id=?", (status, progress, jid))
        else:
            cur.execute(
                "UPDATE Job SET status=?, progress=?, result=? WHERE id=?",
                (status, progress, result, jid),
            )
        con.commit()
        return cur.execute("SELECT changes()").fetchone()[0]
    finally:
        con.close()


for path in candidate_paths():
    flipped = flip(path)
    if flipped is not None:
        print(flipped)
        sys.exit(0)
# the job lives in no candidate db — an honest 0 for the suite's warning path
print(0)
