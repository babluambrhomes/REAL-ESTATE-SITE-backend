/**
 * Idempotent seed for the RBAC master list.
 *
 * This file holds the logic. `prisma/seed.ts` is a thin CLI wrapper, because
 * the logic needs to live under src/ where `tsc --noEmit` checks it — tsconfig
 * only includes src/**, so a seed living in prisma/ would be untyped code.
 *
 * Run with:  npm run prisma:seed
 *
 * What it does:
 *   1. Upserts every permission from the catalogue, keyed on
 *      (scope, resource, action) — the same key the schema's unique index
 *      uses. Re-running never creates duplicates and never fails.
 *   2. Optionally creates the PLATFORM system roles (Super Admin,
 *      Platform Staff, Support Agent) and wires their permissions.
 *      Platform roles need a `created_by` user, which is a real person, so
 *      they are only seeded when `createdByUserId` is supplied. Skipping them
 *      is safe: this seed is re-runnable and the admin account can be wired
 *      later by hand.
 *
 * What it deliberately does NOT do:
 *   - Create organizations or org roles. Those are per-tenant and are created
 *     transactionally when an org is created, not here.
 *   - Create users. Seeding a demo admin account is how known passwords end
 *     up in production.
 */

import prisma from "../config/prisma";
import {
  PERMISSIONS,
  SYSTEM_ORG_ROLES,
  OWNER_ROLE_NAME,
  type PermissionDef,
} from "./permissions.catalog";

export { SYSTEM_ORG_ROLES, OWNER_ROLE_NAME };

/**
 * Platform roles and what they can do. Kept next to the catalogue so both
 * halves of the RBAC master list are readable in one place.
 */
const PLATFORM_ROLES: ReadonlyArray<{
  roleName: string;
  description: string;
  isDefault: boolean;
  permissions: PermissionDef[];
}> = [
  {
    roleName: "Super Admin",
    description: "Unrestricted platform access",
    isDefault: false,
    permissions: PERMISSIONS.filter((p) => p.scope === "PLATFORM"),
  },
  {
    roleName: "Platform Staff",
    description: "Day-to-day platform operations",
    isDefault: false,
    permissions: PERMISSIONS.filter(
      (p) =>
        p.scope === "PLATFORM" &&
        // Staff operate the marketplace; they are not platform sysadmins.
        ![
          "permission:manage",
          "role:manage",
          "settings:manage",
          "user:delete",
          "auditLog:read",
        ].includes(`${p.resource}:${p.action}`)
    ),
  },
  {
    roleName: "Support Agent",
    description: "Handles user support and seller KYC review",
    isDefault: false,
    permissions: PERMISSIONS.filter((p) =>
      [
        "user:read",
        "seller:read",
        "seller:verify",
        "seller:reject",
        "organization:read",
        "organization:verify",
        "organization:reject",
        "lead:read",
        "siteVisit:read",
        "buyerQuestion:read",
        "buyerQuestion:answer",
        "property:read",
      ].includes(`${p.resource}:${p.action}`)
    ),
  },
];

/**
 * Fails before touching the database if the catalogue itself has a duplicate.
 * Prisma's upsert would silently collapse a duplicate onto the previous row,
 * so the bug would only surface as a missing permission on one route at
 * runtime.
 */
function assertCatalogueIsUnique(perms: PermissionDef[]): void {
  const seen = new Map<string, number>();
  perms.forEach((p, i) => {
    const key = `${p.scope}/${p.resource}/${p.action}`;
    if (seen.has(key)) {
      throw new Error(
        `Duplicate permission "${key}" in catalogue at indexes ${seen.get(key)} and ${i}`
      );
    }
    seen.set(key, i);
  });
}

export async function seedPermissions(): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const p of PERMISSIONS) {
    const key = {
      scope: p.scope,
      resource: p.resource,
      action: p.action,
    };

    const before = await prisma.permission.findUnique({
      where: { scope_resource_action: key },
      select: { displayName: true, description: true },
    });

    await prisma.permission.upsert({
      where: { scope_resource_action: key },
      create: { ...key, displayName: p.displayName, description: p.description },
      // Display text is edited here rather than by hand, so catalogue and
      // database cannot drift.
      update: {
        displayName: p.displayName,
        description: p.description,
      },
    });

    if (!before) created += 1;
    else if (
      before.displayName !== p.displayName ||
      before.description !== p.description
    ) {
      updated += 1;
    }
  }

  const total = await prisma.permission.count();
  const platform = PERMISSIONS.filter((p) => p.scope === "PLATFORM").length;
  const org = PERMISSIONS.filter((p) => p.scope === "ORGANIZATION").length;

  console.log(
    `permissions: ${created} created, ${updated} updated, ${total} total`
  );
  console.log(`  PLATFORM     : ${platform}`);
  console.log(`  ORGANIZATION : ${org}`);
}

export async function seedPlatformRoles(
  createdByUserId: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: createdByUserId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(
      `PLATFORM_BOOTSTRAP_USER_ID=${createdByUserId} does not match any user. ` +
        `Create the user first, or unset the variable to seed permissions only.`
    );
  }

  for (const role of PLATFORM_ROLES) {
    const wanted = new Set(
      role.permissions.map((p) => `${p.resource}:${p.action}`)
    );

    const permissions = await prisma.permission.findMany({
      where: { scope: "PLATFORM" },
      select: { id: true, resource: true, action: true },
    });

    const matched = permissions.filter((p) =>
      wanted.has(`${p.resource}:${p.action}`)
    );

    // Refuse to wire a partial role — a Super Admin missing half its
    // permissions is worse than no Super Admin, because it fails on the first
    // endpoint that needs the missing one, in production, at runtime.
    if (matched.length !== wanted.size) {
      const missing = [...wanted].filter(
        (k) =>
          !matched.some((p) => `${p.resource}:${p.action}` === k)
      );
      throw new Error(
        `Cannot seed role "${role.roleName}": ${missing.length} permission(s) missing from the database: ${missing.join(", ")}. Run the permission seed first.`
      );
    }

    const saved = await prisma.role.upsert({
      where: {
        scope_roleName: { scope: "PLATFORM", roleName: role.roleName },
      },
      create: {
        scope: "PLATFORM",
        roleName: role.roleName,
        description: role.description,
        isSystemRole: true,
        isDefault: role.isDefault,
        createdBy: user.id,
      },
      update: {
        description: role.description,
        isSystemRole: true,
      },
    });

    // Replace rather than append, so removing a permission from the catalogue
    // actually removes it from the role instead of leaving it stranded.
    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: matched.map((p) => ({ roleId: saved.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    console.log(
      `platform role: ${role.roleName} (${matched.length} permissions)`
    );
  }
}

export async function seedRbac(
  opts: { createdByUserId?: string } = {}
): Promise<void> {
  assertCatalogueIsUnique(PERMISSIONS);

  await seedPermissions();

  if (opts.createdByUserId) {
    console.log(`\nseeding platform roles for ${opts.createdByUserId}`);
    await seedPlatformRoles(opts.createdByUserId);
  } else {
    console.log(
      `\nNo bootstrap user supplied — skipped platform roles. ` +
        `Permissions only. Re-run with PLATFORM_BOOTSTRAP_USER_ID set to create Super Admin / Platform Staff / Support Agent.`
    );
  }

  const names = Object.keys(SYSTEM_ORG_ROLES);
  console.log(
    `\norganization roles (${names.length}: ${names.join(", ")}) are created per-org at organization creation time`
  );
}
