# The World-DB Law — two worlds, one resurrection, one armor

> Canon since the t867 resurrection; written down in the t871 window
> (the corpse-pin census's dedicated window). Every script, launcher and
> seeder that touches the database answers to THIS document.

## 1. The two reversals

**The t377-era truth (until 2026-10-13):** `db/cryoflow.db` was the
正统 world — the dev-server.sh HARD-override pinned it, the QA seed
fleet (qa-t635 and its descendants) pinned it, and `t774`'s binding law
said "the QA world lives in db/cryoflow.db". `.env` pointed at
`db/custom.db`, which was a stale Oct-8 world kept as a poison-guard
template (the t377 lesson: the sandbox tool environment exports a
TEMPLATE `DATABASE_URL`; trusting the process env poisoned Prisma into
a User/Post-only database).

**The t867 resurrection (2026-10-14):** the sandbox died with the old
data layer and the world was rebuilt through the product's own run door.
The rebuild landed in **`db/custom.db`** — because the platform's
`start.sh` writes `.env` with `DATABASE_URL=file:.../db/custom.db` on
EVERY boot (both branches — fresh and restore), and the cron boot's
plain `next dev` (which reads `.env`) drank exactly that. The healer's
15-node chain and every window since (t867 → t871) ride that file.

**The reversal, in one line:** `.env → db/custom.db` is THE living
world; `db/cryoflow.db` is the frozen 0-byte corpse. Any script that
pins the corpse answers P2021 one layer down ("the table main.Project
does not exist", the t868 lesson's voice).

## 2. The armor (the t869 pattern, fleet-wide since t871)

```js
import { readFileSync as __t871EnvRead } from 'node:fs';
process.env.DATABASE_URL = (() => {
  try {
    const m = __t871EnvRead('/home/z/my-project/.env', 'utf8').match(/^DATABASE_URL=(.*)$/m);
    if (m) {
      let u = m[1].trim().replace(/^["']|["']$/g, '');
      if (!u.startsWith('file:')) u = 'file:' + u;
      if (/^file:[^/]/.test(u)) u = 'file:/home/z/my-project/prisma/' + u.slice(5);
      return u;
    }
  } catch { /* fall through */ }
  return 'file:/home/z/my-project/db/cryoflow.db';
})();
console.log(`db pin: ${process.env.DATABASE_URL} (the t869 armor: .env-first, frozen fallback)`);
```

The three clauses, and why each is load-bearing:

1. **`.env` FIRST** — the platform owns `.env` and rewrites it every
   boot; the living world is wherever it says. A pin that never reads
   it is a pin on a corpse.
2. **Prisma's own resolution mirrored** — absolute `file:/...` kept
   as-is; relative `file:db/x.db` resolved from `prisma/` (Prisma
   resolves schema-relative paths).
3. **The frozen pin as fallback + the world NAMED at the gate** —
   absent `.env` (a fresh tar world), the script still runs; and every
   run PRINTS which world it rides, so a corpse-reading instrument is
   caught in its own first line, not three layers down.

## 3. Who owns what

| Surface | Law |
| --- | --- |
| `.env` | Owned by the platform's `start.sh` (rewritten EVERY boot, both branches). Recovery and QA must NEVER overwrite it. |
| `db/custom.db` | THE living world (gitignored). The healer + the seeder family rebuild it after any wipe. |
| `db/cryoflow.db` | The frozen 0-byte corpse. Kept only as the armor's fallback marker. NEVER pin a live reader here. |
| `dev-server.sh` | Armored (t867): `_prisma_env_url` reads `.env` first, corpse fallback. |
| `scripts/reboot-recover.sh` | t871: step 1 was "ENV PIN" (re-pinned `.env` to the corpse on every recovery — post-resurrection that re-armed the t867 wound on the next reboot). Now "ENV RIDE": `.env` read, never written (fresh-world append only), world named at the gate. |
| `scripts/t636-world-census.mjs` | Armored (the t871 cron car): the census names the world in its first line. |
| `scripts/t260/t258/t257` | Armored (t870): the 3D family's flip legs resolve `.env` first. |

## 4. The fleet census (the t871 retarget)

`scripts/t871-retarget-corpse-pins.py` is the idempotent retargeter
(dry-run default, `--apply` writes the receipt
`shots-qa/t871-corpse-pin-retarget.json`).

- **33 files retargeted (t871)**: the simple-form pins
  (`process.env.DATABASE_URL = '...' / \`file:${REPO}/db/cryoflow.db\``)
  at top level — 4 seeders (qa-t521/qa-t531/qa-t635/qa-t639), qa78-e2e,
  the t486–t501 bench fleet, t522/t523 stop instruments, t677–t687
  judge/palette/roster diagnostics, t705/t715/t774. All 17 `.mjs` pass
  `node --check`; the 16 `.ts` are pattern-safe (line-scoped, aliased
  collision-free import, top-level only).
- **The 65-file tail (reported, not touched)**: spawn-env and inline
  `execSync` forms, `.py` seeds (qa58/qa60/restore-gallery/seed-twin),
  `.sh` launchers (3001/3005 lanes, start-prod, build-until-green),
  and the t119–t534 fossil strata. Each next window that touches one,
  arms it with the same armor. `reboot-recover.sh` was hand-fixed this
  window (see §3).
- **The seeders' target after the retarget**: the LIVING world. The
  seed family is the living world's rebuilder ("run before t531, after
  any wipe") — idempotent upserts by name. There is no third world to
  isolate into; the corpse is not a world.

## 5. The proof rides (t871)

- `t774-canon-reset.mjs` — `db pin: .../db/custom.db`, no P2021,
  "sibling already absent — no-op", then its own canon alarm (the old
  world's 17/18 canon reads 0/0 here — exit 2 is the DESIGNED drift
  voice, not a crash).
- `t684-palette-recent.mjs` — armor names the living world, then rides
  the real palette on :3000 against the 15-job roster (exit 0).
- `t636-world-census.mjs` — 1 project / 15 jobs / 14 edges / 23 job
  dirs, world named in the first line.
