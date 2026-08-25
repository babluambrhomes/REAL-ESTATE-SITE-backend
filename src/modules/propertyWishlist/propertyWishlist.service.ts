import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPaginatedResponse } from "../../helpers";
import { WishlistQueryInput } from "./propertyWishlist.validation";

const propertyCardSelect = {
  id: true,
  propertyCode: true,
  title: true,
  slug: true,
  description: true,
  transactionType: true,
  propertyType: true,
  propertyStatus: true,
  city: true,
  state: true,
  pincode: true,
  images: true,
  isFeatured: true,
  isVerified: true,
  viewsCount: true,
  likesCount: true,
  averageRating: true,
  ratingCount: true,
  createdAt: true,
  seller: {
    select: {
      id: true,
      referenceCode: true,
      slug: true,
      sellerType: true,
      headline: true,
      logoUrl: true,
    },
  },
  variants: {
    where: { isActive: true },
    orderBy: { price: "asc" as const },
    select: {
      id: true,
      variantName: true,
      bedrooms: true,
      price: true,
      mrpPrice: true,
      pricePerSqft: true,
      totalArea: true,
      totalAreaUnit: true,
      furnishingStatus: true,
      availabilityStatus: true,
      isAvailable: true,
      images: true,
    },
  },
};

const toCard = (property: any) => {
  const images: { url: string; isFeatured?: boolean }[] = Array.isArray(property.images)
    ? property.images
    : [];
  const featuredImage =
    images.find((i) => i.isFeatured)?.url ?? images[0]?.url ?? null;
  const minPrice = property.variants?.[0]?.price ?? null;

  const { images: _imgs, variants: _variants, ...rest } = property;

  return {
    ...rest,
    minPrice,
    featuredImage,
    imagesCount: images.length,
    variants: property.variants,
  };
};

const toggleWishlist = async (userId: string, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  const existing = await prisma.propertyLike.findUnique({
    where: {
      userId_propertyId: { userId, propertyId },
    },
    select: { id: true },
  });

  if (existing) {
    const [, updatedProperty] = await prisma.$transaction([
      prisma.propertyLike.delete({
        where: { id: existing.id },
      }),
      prisma.property.update({
        where: { id: propertyId },
        data: { likesCount: { decrement: 1 } },
        select: { likesCount: true },
      }),
    ]);

    return {
      saved: false,
      likesCount: updatedProperty.likesCount,
    };
  }

  const [, updatedProperty] = await prisma.$transaction([
    prisma.propertyLike.create({
      data: { userId, propertyId },
    }),
    prisma.property.update({
      where: { id: propertyId },
      data: { likesCount: { increment: 1 } },
      select: { likesCount: true },
    }),
  ]);

  return {
    saved: true,
    likesCount: updatedProperty.likesCount,
  };
};

const getMyWishlist = async (userId: string, query: WishlistQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const [likes, total] = await Promise.all([
    prisma.propertyLike.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take,
      select: {
        createdAt: true,
        property: {
          select: propertyCardSelect,
        },
      },
    }),
    prisma.propertyLike.count({ where: { userId } }),
  ]);

  const data = likes.map((like) => ({
    savedAt: like.createdAt,
    ...toCard(like.property),
  }));

  return buildPaginatedResponse(data, total, page, limit);
};

export { toggleWishlist, getMyWishlist };
