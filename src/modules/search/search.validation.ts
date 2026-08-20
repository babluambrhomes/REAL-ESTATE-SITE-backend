import { z } from "zod";

export const transactionTypes = ["SALE", "RENT"] as const;

export const propertyTypes = [
  "APARTMENT",
  "HOUSE",
  "VILLA",
  "BUILDER_FLOOR",
  "PENTHOUSE",
  "STUDIO",
  "PLOT",
  "AGRICULTURAL_LAND",
  "FARM_HOUSE",
  "COMMERCIAL_SHOP",
  "COMMERCIAL_OFFICE",
  "COMMERCIAL_BUILDING",
  "SHOWROOM",
  "WAREHOUSE",
] as const;

export const propertyStatuses = [
  "AVAILABLE",
  "UNDER_OFFER",
  "SOLD",
  "RENTED",
  "LEASED",
  "WITHDRAWN",
] as const;

export const furnishingStatuses = [
  "FURNISHED",
  "SEMI_FURNISHED",
  "UNFURNISHED",
] as const;

export const availabilityStatuses = [
  "READY_TO_MOVE",
  "UNDER_CONSTRUCTION",
  "NEW_LAUNCH",
] as const;

export const sortOptions = [
  "relevance",
  "distance",
  "newest",
  "price_asc",
  "price_desc",
  "popular",
] as const;

const boundsRegex = /^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/;

export const searchQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).optional(),

  // Text search
  q: z.string().trim().max(200).optional(),

  // Location
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(0.1).max(100).optional(),

  // Map viewport bounding box: "lat1,lng1,lat2,lng2"
  bounds: z
    .string()
    .regex(boundsRegex, "Bounds format: lat1,lng1,lat2,lng2")
    .optional(),

  // Property filters
  transactionType: z.enum(transactionTypes).optional(),
  propertyType: z.enum(propertyTypes).optional(),
  propertyStatus: z.enum(propertyStatuses).optional(),

  // Price
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),

  // Rooms
  bedrooms: z.coerce.number().int().min(0).optional(),
  bathrooms: z.coerce.number().int().min(0).optional(),

  // BHK shortcut
  bhk: z.enum(["1", "2", "3", "4", "5", "6", "7", "8"]).optional(),

  // Location text
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),

  // Property features
  furnishingStatus: z.enum(furnishingStatuses).optional(),
  availabilityStatus: z.enum(availabilityStatuses).optional(),
  ownershipType: z.enum(["FREEHOLD", "LEASEHOLD", "CO_OPERATIVE", "POWER_OF_ATTORNEY"]).optional(),
  listedBy: z.enum(["OWNER", "AGENT", "BUILDER"]).optional(),

  // Flags
  isFeatured: z.enum(["true", "false"]).optional(),
  isVerified: z.enum(["true", "false"]).optional(),

  // Seller
  sellerSlug: z.string().trim().max(100).optional(),

  // Sort
  sort: z.enum(sortOptions).optional(),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
