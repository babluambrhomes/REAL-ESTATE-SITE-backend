/**
 * Single DB bootstrap script.
 *
 * Kyun zaroori hai:
 *  - Migrations sirf tables banati hain, unme master data nahi dalati.
 *  - RBAC data-driven hai (User → Member → Role → RolePermission → Permission).
 *    Permissions DB me na hon to organization/seller create fail hota hai.
 *  - Seller/profile create ke liye kam se kam ek active category chahiye.
 *
 * Order matlab rakhta hai:
 *   1. permissions       → roles banane ke liye DB me permission rows chahiye
 *   2. seller_categories → org/seller create ke liye active category chahiye
 *   3. role name sync    → purane system role naam naye constants par lane hain
 *   4. platform admin    → uski role ko PLATFORM permissions chahiye
 *
 * Sab steps idempotent hain — dobara chalana safe hai. Koi delete nahi hota.
 * Seed data alag files me hai: src/seed/permissions.catalog.ts aur
 * src/seed/categories.catalog.ts. Yahan sirf executable logic hai.
 */
import prisma from "../src/config/prisma";
import { hashPassword } from "../src/helpers/password.helper";
import {
  AccountOrigin,
  MemberScope,
  MemberStatus,
  PermissionScope,
  RoleScope,
  UserStatus,
} from "../src/generated/prisma/enums";
import {
  PERMISSIONS,
  PLATFORM_ROLE_NAME,
} from "../src/seed/permissions.catalog";
import { SELLER_CATEGORIES } from "../src/seed/categories.catalog";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Admin credentials env se aate hain. Local dev me env na ho to clearly marked
 * dummy values use hote hain (README me documented). Production me dummy
 * allowed nahi. Password kabhi log ya source file me nahi jata.
 */
const getAdminConfig = (): { email: string; password: string; name: string } => {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || (!isProduction ? "admin@example.com" : "");
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || (!isProduction ? "change-me-local-only" : "");
  const name = process.env.BOOTSTRAP_ADMIN_NAME || (!isProduction ? "Platform Admin" : "");

  if (!email || !password || !name) {
    throw new Error(
      "Platform admin bootstrap needs BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD and BOOTSTRAP_ADMIN_NAME (dummy values are only allowed outside production)."
    );
  }

  if (!isProduction && !process.env.BOOTSTRAP_ADMIN_EMAIL) {
    console.warn(
      "Using dummy local admin credentials from README. Change them in .env before using this outside local development."
    );
  }

  return { email, password, name };
};

const seedPermissions = async (): Promise<void> => {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: {
        scope_resource_action: {
          scope: permission.scope as PermissionScope,
          resource: permission.resource,
          action: permission.action,
        },
      },
      create: {
        scope: permission.scope as PermissionScope,
        resource: permission.resource,
        action: permission.action,
        displayName: permission.displayName,
        description: permission.description,
      },
      update: {
        displayName: permission.displayName,
        description: permission.description,
      },
    });
  }

  const scopes = [
    PermissionScope.PLATFORM,
    PermissionScope.ORGANIZATION,
    PermissionScope.INDIVIDUAL,
  ];
  const counts = await Promise.all(
    scopes.map((scope) => prisma.permission.count({ where: { scope } }))
  );

  console.log(
    `Permissions seeded: ${PERMISSIONS.length} catalog entries | DB counts ` +
      `PLATFORM=${counts[0]}, ORGANIZATION=${counts[1]}, INDIVIDUAL=${counts[2]}`
  );
};

const seedCategories = async (): Promise<void> => {
  for (const category of SELLER_CATEGORIES) {
    await prisma.sellerCategory.upsert({
      where: { slug: category.slug },
      create: {
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
      },
      update: {
        name: category.name,
        description: category.description,
        isActive: category.isActive,
      },
    });
  }

  const total = await prisma.sellerCategory.count();
  console.log(
    `Seller categories seeded: ${SELLER_CATEGORIES.length} entries | DB total=${total}`
  );
};

interface RenamePlan {
  scope: RoleScope;
  target: string;
  legacyNames: string[];
}


/**
 * Role/member ke liye upsert isliye nahi kyunki inke unique indexes PARTIAL
 * hain (context_id IS NULL). Prisma ka ON CONFLICT un predicates se match nahi
 * karta aur Postgres 42P10 deta hai. Isliye pehle dhoondo, na mile to create.
 * Race ho to dobara dhoondo.
 */
const ensurePlatformRole = async (createdBy: string): Promise<{ id: string }> => {
  const where = {
    scope: RoleScope.PLATFORM,
    contextId: null,
    roleName: PLATFORM_ROLE_NAME,
  };

  const existing = await prisma.role.findFirst({ where, select: { id: true } });
  if (existing) return existing;

  try {
    return await prisma.role.create({
      data: {
        ...where,
        description: "Platform-wide administrator with every PLATFORM permission",
        isSystemRole: true,
        isDefault: false,
        createdBy,
      },
      select: { id: true },
    });
  } catch (error) {
    const raced = await prisma.role.findFirst({ where, select: { id: true } });
    if (raced) return raced;
    throw error;
  }
};

const ensurePlatformMember = async (
  userId: string,
  roleId: string
): Promise<{ id: string }> => {
  const where = { scope: MemberScope.PLATFORM, contextId: null, userId };

  const existing = await prisma.member.findFirst({ where, select: { id: true } });
  if (existing) return existing;

  try {
    return await prisma.member.create({
      data: { ...where, roleId, status: MemberStatus.ACTIVE },
      select: { id: true },
    });
  } catch (error) {
    const raced = await prisma.member.findFirst({ where, select: { id: true } });
    if (raced) return raced;
    throw error;
  }
};

const seedPlatformAdmin = async (): Promise<void> => {
  const { email, password, name } = getAdminConfig();

  const platformPermissions = await prisma.permission.findMany({
    where: { scope: PermissionScope.PLATFORM },
    select: { id: true },
  });
  if (platformPermissions.length === 0) {
    throw new Error("No PLATFORM permissions found in DB. Run permissions step first.");
  }

  console.log("Admin step 1/5: user ensure...");
  let admin = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        email,
        hasPassword: await hashPassword(password),
        status: UserStatus.ACTIVE,
        emailVerified: true,
        accountOrigin: AccountOrigin.INVITED,
      },
      select: { id: true },
    });
  }

  console.log("Admin step 2/5: person ensure...");
  await prisma.person.upsert({
    where: { userId: admin.id },
    create: { userId: admin.id, firstName: name, lastName: null },
    update: {},
  });

  console.log("Admin step 3/5: platform role ensure...");
  const role = await ensurePlatformRole(admin.id);
  await prisma.role.update({
    where: { id: role.id },
    data: {
      description: "Platform-wide administrator with every PLATFORM permission",
      isSystemRole: true,
    },
  });

  console.log("Admin step 4/5: role permissions attach...");
  await prisma.rolePermission.createMany({
    data: platformPermissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  console.log("Admin step 5/5: platform membership ensure...");
  const member = await ensurePlatformMember(admin.id, role.id);
  await prisma.member.update({
    where: { id: member.id },
    data: { roleId: role.id, status: MemberStatus.ACTIVE },
  });

  console.log(
    `Platform admin ready: ${email} | role=${PLATFORM_ROLE_NAME} | permissions=${platformPermissions.length}`
  );
};

const bootstrap = async (): Promise<void> => {
  console.log("Starting DB bootstrap...");

  await seedPermissions();
  await seedCategories();
  await seedPlatformAdmin();

  console.log("DB bootstrap completed.");
};

bootstrap()
  .catch((error) => {
    console.error("DB bootstrap failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
