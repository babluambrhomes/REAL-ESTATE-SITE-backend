import prisma from "../src/config/prisma";

const categories = [
  {
    name: "Builder",
    slug: "builder",
    imageUrl: "/uploads/categories/builder.png",
    description: "Developers who build and manage property projects",
  },
  {
    name: "Broker",
    slug: "broker",
    imageUrl: "/uploads/categories/broker.png",
    description: "Professionals who connect buyers and sellers for property deals",
  },
  {
    name: "Consultant",
    slug: "consultant",
    imageUrl: "/uploads/categories/consultant.png",
    description: "Experts providing property valuation, legal, and investment advice",
  },
  {
    name: "Property Dealer",
    slug: "property-dealer",
    imageUrl: "/uploads/categories/property-dealer.png",
    description: "Dealers who facilitate buying, selling, and renting of properties",
  },
];

const main = async () => {
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

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
