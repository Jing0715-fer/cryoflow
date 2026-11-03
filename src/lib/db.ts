import { PrismaClient } from '@prisma/client'
import { RUNTIME_DB_BASELINE, templateWorldWarnOf } from './db-world'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// t1167 — THE ROOT CLOSED (the t1114/t1115 two-db trap, ended code-side).
// The client rides the ONE world the bare instruments ride:
//   CRYOFLOW_DB_URL (the ONE override knob — world-snapshot.mjs's own
//   first choice) || file:${RUNTIME_DB_BASELINE} (db-world.ts, the ONE
//   path birthplace).
// .env's DATABASE_URL — the platform's regenerated template
// (db/custom.db, a User/Post-only world) — can no longer split the app
// from its world: the t1130 gate flapped when the template returned at a
// boot, and the t1166 census caught a bare `next dev` reading a 3-job
// world the instruments never saw. A dev-only warn (the t1115 watchman)
// was the right alarm but not a cure — the landing itself is pinned here,
// so no launch method, no env drift, no regenerated .env can move the
// world under the app. The prisma CLI keeps reading .env (the schema's
// DATABASE_URL fallback stays the record for the CLI) — the .env contract
// is the t1130 gate's watch, healed to the living lane this window.
// The watchman STAYS (defense in depth — closing the root never retires
// the guard): dev-only, now watching the RESOLVED world, so even a
// template-pointing CRYOFLOW_DB_URL sings before a query is born.
const resolvedDbUrl = process.env.CRYOFLOW_DB_URL || `file:${RUNTIME_DB_BASELINE}`

const devWarn = templateWorldWarnOf(resolvedDbUrl, {
  production: process.env.NODE_ENV === "production",
})
if (devWarn) console.warn(devWarn)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // t1167 — the root closed: the resolved world above, never the env's
    // template. (t341's log law stands: opt in with CF_PRISMA_LOG=1.)
    datasourceUrl: resolvedDbUrl,
    ...(process.env.CF_PRISMA_LOG === "1" ? { log: ["query"] as const } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
