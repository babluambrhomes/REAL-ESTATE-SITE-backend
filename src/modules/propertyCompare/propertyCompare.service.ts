import prisma from "../../config/prisma";
import { ListingStatus } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  PUBLIC_PROPERTY_STATUSES,
  propertyCardSelect,
  toCard,
} from "../property/property.select";
import type {
  ComparePropertiesInput,
  SuggestPropertiesQueryInput,
} from "./propertyCompare.validation";

export const compareProperties = async (input: ComparePropertiesInput) => {
  const propertyIds = [
    ...new Set(input.properties.map((item) => item.propertyId)),
  ];

  const properties = await prisma.property.findMany({
    where: {
      id: { in: propertyIds },
      listingStatus: ListingStatus.PUBLISHED,
      propertyStatus: { in: PUBLIC_PROPERTY_STATUSES },
    },
    select: propertyCardSelect,
  });

  const byId = new Map(properties.map((property) => [property.id, property]));

  const results = [];
  for (const { propertyId, variantId } of input.properties) {
    const property = byId.get(propertyId);
    if (!property) continue;

    const hasVariant = property.variants.some(
      (variant) => variant.id === variantId
    );
    if (!hasVariant) continue;

    results.push({ ...toCard(property), selectedVariantId: variantId });
  }

  return results;
};

const pickVariantId = (
  property: {
    variants?: { id: string; price: unknown; bedrooms: number | null }[] | null;
  },
  query: SuggestPropertiesQueryInput
): string | null => {
  const variants = property.variants ?? [];
  if (variants.length === 0) return null;

  const targetPrice = query.maxPrice ?? query.minPrice;

  return variants
    .map((variant, index) => {
      const priceScore =
        targetPrice === undefined
          ? index
          : Math.abs(Number(variant.price) - targetPrice) /
            Math.max(targetPrice, 1);
      const bedroomScore =
        query.bedrooms !== undefined && variant.bedrooms !== query.bedrooms
          ? 1000
          : 0;

      return {
        id: variant.id,
        score: priceScore + bedroomScore + index * 0.0001,
      };
    })
    .sort((a, b) => a.score - b.score)[0].id;
};

export const suggestPropertyPairs = async (
  query: SuggestPropertiesQueryInput
) => {
  const where: Prisma.PropertyWhereInput = {
    listingStatus: ListingStatus.PUBLISHED,
    propertyStatus: { in: PUBLIC_PROPERTY_STATUSES },
  };

  if (query.city) where.city = { equals: query.city, mode: "insensitive" };
  if (query.propertyType) where.propertyType = query.propertyType;
  if (query.transactionType) where.transactionType = query.transactionType;

  const variantFilter: Prisma.PropertyVariantWhereInput = { isActive: true };
  if (query.bedrooms !== undefined) variantFilter.bedrooms = query.bedrooms;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    variantFilter.price = {
      ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
      ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
    };
  }
  if (Object.keys(variantFilter).length > 1) {
    where.variants = { some: variantFilter };
  }

  const properties = await prisma.property.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10,
    select: propertyCardSelect,
  });

  const cards = properties.map((property) => ({
    ...toCard(property),
    selectedVariantId: pickVariantId(property, query),
  }));

  const pairs: { source: (typeof cards)[number]; suggestion: (typeof cards)[number] }[] = [];
  for (let index = 0; index + 1 < cards.length && pairs.length < 5; index += 2) {
    pairs.push({ source: cards[index], suggestion: cards[index + 1] });
  }

  return pairs;
};
