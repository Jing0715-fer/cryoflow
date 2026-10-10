import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // t341 (review) — the unconditional `log: ['query']` printed every SQL
    // statement on the hot 2-5s poll path (jobs GET, log tail, outputs…),
    // amplifying memory pressure and log noise for zero benefit. Opt in
    // with CF_PRISMA_LOG=1 when a query actually needs watching.
    ...(process.env.CF_PRISMA_LOG === "1" ? { log: ["query"] as const } : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db