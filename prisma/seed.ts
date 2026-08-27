import prisma from "../src/config/prisma";
import { hashPassword } from "../src/helpers/password.helper";

// ============================================================
// PLATFORM ADMIN SEED
// ============================================================

const ADMIN_EMAIL = "admin@ambrhomes.com";
const ADMIN_PASSWORD = "Admin@123456";
const ADMIN_FIRST_NAME = "Platform";
const ADMIN_LAST_NAME = "Admin";

// ============================================================
// SELLER CATEGORIES
// ============================================================

const categories = [
  {
    name: "Sell Your Property",
    slug: "sell-your-property",
    imageUrl: "/uploads/categories/sell-your-property.png",
    description: "List and sell your property directly to potential buyers",
  },
  {
    name: "Builder",
    slug: "builder",
    imageUrl: "/uploads/categories/builder.png",
    description:
      "Developers who build and manage residential and commercial projects",
  },
  {
    name: "Broker",
    slug: "broker",
    imageUrl: "/uploads/categories/broker.png",
    description:
      "Professionals who connect buyers, sellers, landlords, and tenants",
  },
  {
    name: "Property Consultant",
    slug: "property-consultant",
    imageUrl: "/uploads/categories/property-consultant.png",
    description:
      "Experts providing property, investment, and real estate guidance",
  },
  {
    name: "Property Valuation",
    slug: "property-valuation",
    imageUrl: "/uploads/categories/property-valuation.png",
    description:
      "Professional property valuation and market price assessment services",
  },
];

// ============================================================
// PLATFORM PERMISSIONS (scope: PLATFORM)
// ============================================================

const platformPermissions = [
  { resource: "property", action: "verify", displayName: "Property Verify Kare" },
  { resource: "property", action: "reject", displayName: "Property Reject Kare" },
  { resource: "member", action: "manage", displayName: "Member Manage Kare" },
  { resource: "member", action: "suspend", displayName: "Member Suspend Kare" },
  { resource: "organization", action: "manage", displayName: "Organization Manage Kare" },
  { resource: "organization", action: "verify", displayName: "Organization Verify Kare" },
  { resource: "seller", action: "manage", displayName: "Seller Manage Kare" },
  { resource: "seller", action: "verify", displayName: "Seller Verify Kare" },
  { resource: "report", action: "manage", displayName: "Report Manage Kare" },
  { resource: "platform", action: "manage", displayName: "Platform Settings Manage Kare" },
  { resource: "category", action: "manage", displayName: "Category Manage Kare" },
  { resource: "blog", action: "moderate", displayName: "Blog Moderate Kare" },
];

// ============================================================
// SEED: CATEGORIES
// ============================================================

const seedCategories = async () => {
  const whitelist = new Set(categories.map((c) => c.slug));

  for (const category of categories) {
    await prisma.sellerCategory.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        imageUrl: category.imageUrl,
        description: category.description,
      },
      create: {
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        description: category.description,
      },
    });
  }

  const stale = await prisma.sellerCategory.findMany({
    where: { slug: { notIn: [...whitelist] } },
    include: { _count: { select: { sellerProfiles: true } } },
  });

  for (const category of stale) {
    if (category._count.sellerProfiles > 0) {
      console.warn(
        `SKIP cleanup: "${category.name}" has ${category._count.sellerProfiles} sellers`
      );
      continue;
    }
    await prisma.sellerCategory.delete({ where: { id: category.id } });
    console.log(`Removed stale category: ${category.name}`);
  }

  console.log("Categories seeded successfully");
};

// ============================================================
// SEED: PLATFORM PERMISSIONS
// ============================================================

const seedPlatformPermissions = async () => {
  const permissionRecords = [];

  for (const perm of platformPermissions) {
    const record = await prisma.permission.upsert({
      where: {
        scope_resource_action: {
          scope: "PLATFORM",
          resource: perm.resource,
          action: perm.action,
        },
      },
      update: { displayName: perm.displayName },
      create: {
        scope: "PLATFORM",
        resource: perm.resource,
        action: perm.action,
        displayName: perm.displayName,
      },
    });
    permissionRecords.push(record);
  }

  console.log(`Platform permissions seeded: ${permissionRecords.length}`);
  return permissionRecords;
};

// ============================================================
// SEED: SUPER ADMIN ROLE + ROLE-PERMISSION MAPPING
// ============================================================

const seedSuperAdminRole = async (adminUserId: string, permissionIds: string[]) => {
  const existing = await prisma.role.findFirst({
    where: { scope: "PLATFORM", contextId: null, roleName: "Super Admin" },
  });

  const role = existing
    ? await prisma.role.update({
        where: { id: existing.id },
        data: { description: "Platform ka full access admin", isSystemRole: true },
      })
    : await prisma.role.create({
        data: {
          scope: "PLATFORM",
          roleName: "Super Admin",
          description: "Platform ka full access admin",
          isSystemRole: true,
          createdBy: adminUserId,
        },
      });

  // Assign all platform permissions to Super Admin role
  for (const permissionId of permissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId,
        },
      },
      update: {},
      create: {
        roleId: role.id,
        permissionId,
      },
    });
  }

  console.log(`Super Admin role seeded with ${permissionIds.length} permissions`);
  return role;
};

// ============================================================
// SEED: ADMIN USER + PERSON + MEMBER
// ============================================================

const seedAdminUser = async () => {
  const hashedPassword = await hashPassword(ADMIN_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      emailVerified: true,
      status: "ACTIVE",
    },
    create: {
      email: ADMIN_EMAIL,
      hasPassword: hashedPassword,
      emailVerified: true,
      phoneVerified: false,
      status: "ACTIVE",
      accountOrigin: "SELF_REGISTERED",
    },
  });

  await prisma.person.upsert({
    where: { userId: user.id },
    update: {
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
    },
    create: {
      userId: user.id,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
    },
  });

  console.log(`Admin user seeded: ${user.email} (${user.id})`);
  return user;
};

const seedAdminMember = async (userId: string, roleId: string) => {
  const existing = await prisma.member.findFirst({
    where: { scope: "PLATFORM", contextId: null, userId },
  });

  if (existing) {
    await prisma.member.update({
      where: { id: existing.id },
      data: { roleId, status: "ACTIVE" },
    });
  } else {
    await prisma.member.create({
      data: {
        scope: "PLATFORM",
        contextId: null,
        userId,
        roleId,
        status: "ACTIVE",
      },
    });
  }

  console.log("Admin member (PLATFORM scope) seeded");
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  // 1. Seed categories
  await seedCategories();

  // 2. Seed platform permissions
  const permissions = await seedPlatformPermissions();
  const permissionIds = permissions.map((p) => p.id);

  // 3. Seed admin user
  const adminUser = await seedAdminUser();

  // 4. Seed Super Admin role + assign permissions
  const superAdminRole = await seedSuperAdminRole(adminUser.id, permissionIds);

  // 5. Link admin user to Super Admin role
  await seedAdminMember(adminUser.id, superAdminRole.id);

  console.log("\nAll seeds completed successfully");
};

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
