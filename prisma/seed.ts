/**
 * CLI entry point for the RBAC seed.
 *
 * Kept in prisma/ because that is where `prisma db seed` looks, but the logic
 * lives in src/seed/rbac.seed.ts so that `tsc --noEmit` type-checks it
 * (tsconfig only includes src/**).
 *
 *   npm run prisma:seed
 *   PLATFORM_BOOTSTRAP_USER_ID=<uuid> npx tsx prisma/seed.ts
 *
 * Exits non-zero on failure so CI / a deploy step can gate on it.
 */

import prisma from "../src/config/prisma";
import { seedRbac } from "../src/seed/rbac.seed";

seedRbac({ createdByUserId: process.env.PLATFORM_BOOTSTRAP_USER_ID })
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("\nseed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
