import prisma from "../config/prisma";

const SELLER_CATEGORIES = [
  {
    name: "Builder",
    slug: "builder",
    description:
      "Residential and commercial property construction and development.",
    isActive: true,
    imageUrl: null,
  },
  {
    name: "Real Estate Broker",
    slug: "real-estate-broker",
    description: "Buying, selling, and rental brokerage services.",
    isActive: true,
    imageUrl: null,
  },
  {
    name: "Real Estate Consultant",
    slug: "real-estate-consultant",
    description: "Property investment, valuation, and transaction advisory.",
    isActive: true,
    imageUrl: null,
  },
  {
    name: "Property Manager",
    slug: "property-manager",
    description: "Leasing, tenant coordination, and day-to-day property operations.",
    isActive: true,
    imageUrl: null,
  },
  {
    name: "Home Loan Consultant",
    slug: "home-loan-consultant",
    description: "Home loan guidance, documentation, and lender coordination.",
    isActive: true,
    imageUrl: null,
  },
];

export async function seedSellerCategories(): Promise<void> {
  await prisma.sellerCategory.createMany({
    data: SELLER_CATEGORIES,
    skipDuplicates: true,
  });

  const total = await prisma.sellerCategory.count({
    where: { isActive: true },
  });

  console.log(`seller categories: ${SELLER_CATEGORIES.length} seeded, ${total} active total`);
}
