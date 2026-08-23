import { PrismaClient } from "@prisma/client";

// Reuse a single PrismaClient across Next.js hot-reloads in dev to avoid
// exhausting Supabase's connection pool.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
