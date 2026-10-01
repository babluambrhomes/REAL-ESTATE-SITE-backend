import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { propertyCardSelect, toCard } from "../property/property.select";
import { ListingStatus } from "../../generated/prisma/enums";
import { WishlistQueryInput } from "./propertyWishlist.validation";


const toggleWishlist = async (userId: string, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      listingStatus: ListingStatus.PUBLISHED,
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

  return {
    data,
    ...buildPagination(total, page, limit),
  };
};

export { toggleWishlist, getMyWishlist };
