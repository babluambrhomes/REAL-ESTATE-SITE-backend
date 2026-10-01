import { Prisma } from "../../generated/prisma/client";
import { PropertyStatus } from "../../generated/prisma/enums";
import { sellerIdentitySelect, resolveSellerIdentity, SellerIdentity } from "../../helpers";

/**
 * PropertyStatus values that may appear in a public listing.
 *
 * `DRAFT` is excluded on purpose: a draft property is an internal draft
 * and "public search results accidentally contain drafts" is a bug that
 * is both embarrassing and a data leak. `WITHDRAWN` is the seller's
 * explicit "take it off the market" signal.
 */
export const PUBLIC_PROPERTY_STATUSES: PropertyStatus[] = [
  PropertyStatus.AVAILABLE,
  PropertyStatus.UNDER_OFFER,
  PropertyStatus.SOLD,
  PropertyStatus.RENTED,
  PropertyStatus.LEASED,
];

export const propertyCardSelect: Prisma.PropertySelect = {
  id: true,
  propertyCode: true,
  title: true,
  slug: true,
  description: true,
  transactionType: true,
  propertyType: true,
  propertyStatus: true,
  listingStatus: true,
  verificationStatus: true,
  city: true,
  state: true,
  pincode: true,
  images: true,
  isFeatured: true,
  viewsCount: true,
  likesCount: true,
  averageRating: true,
  ratingCount: true,
  createdAt: true,
  // Property no longer belongs to a SellerProfile directly. The public
  // seller card is reached through whichever side actually owns it.
  user: { select: { id: true, sellerProfile: { select: sellerIdentitySelect } } },
  organization: {
    select: { id: true, name: true, sellerProfile: { select: sellerIdentitySelect } },
  },
  variants: {
    where: { isActive: true },
    orderBy: { price: "asc" },
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

export const propertyDetailSelect: Prisma.PropertySelect = {
  ...propertyCardSelect,
  addressLine: true,
  country: true,
  latitude: true,
  longitude: true,
  googleMapLink: true,
  ownershipType: true,
  listedBy: true,
  ageOfProperty: true,
  amenities: true,
  nearbyPlaces: true,
  societyInfo: true,
  videos: true,
  reraNumber: true,
  registrationNumber: true,
  taxAssessment: true,
  encumbrance: true,
  contactName: true,
  contactPhone: true,
  contactEmail: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  verifiedAt: true,
  verifiedBy: true,
  userId: true,
  organizationId: true,
  updatedAt: true,
  variants: {
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { price: "asc" }],
    select: {
      id: true,
      variantName: true,
      variantCode: true,
      bedrooms: true,
      bathrooms: true,
      balconies: true,
      price: true,
      mrpPrice: true,
      pricePerSqft: true,
      totalArea: true,
      totalAreaUnit: true,
      carpetArea: true,
      carpetAreaUnit: true,
      superBuiltUpArea: true,
      superBuiltUpAreaUnit: true,
      plotArea: true,
      plotAreaUnit: true,
      floorNumber: true,
      totalFloors: true,
      availabilityStatus: true,
      possessionDate: true,
      isAvailable: true,
      inventoryCount: true,
      furnishingStatus: true,
      furnishingItems: true,
      images: true,
      brochure: true,
      displayOrder: true,
    },
  },
  faqs: {
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
    select: { id: true, question: true, answer: true, displayOrder: true },
  },
};

export const asImageList = (
  value: unknown
): { url: string; isFeatured?: boolean }[] => {
  if (!Array.isArray(value)) return [];
  return value as { url: string; isFeatured?: boolean }[];
};

/**
 * Normalises a raw property row into the shape clients consume.
 *
 * Flattens the ownership columns into a single `seller` field so clients
 * keep reading `property.seller.slug` even though the backend no longer
 * stores a seller FK on the property.
 */
export const toCard = (property: any) => {
  const images = asImageList(property.images);
  const featuredImage =
    images.find((i) => i.isFeatured)?.url ?? images[0]?.url ?? null;
  const minPrice = property.variants?.[0]?.price ?? null;

  const seller: SellerIdentity | null = resolveSellerIdentity(property);
  const organization = property.organization
    ? { id: property.organization.id, name: property.organization.name }
    : null;

  const {
    images: _imgs,
    variants: _variants,
    user: _user,
    organization: _org,
    ...rest
  } = property;

  return {
    ...rest,
    organization,
    seller,
    minPrice,
    featuredImage,
    imagesCount: images.length,
    variants: property.variants,
  };
};
