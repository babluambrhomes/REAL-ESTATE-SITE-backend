import { z } from "zod";

export const transactionTypes = [
  "SALE",
  "RENT",
] as const;

export const propertyTypes = [
  "APARTMENT",
  "HOUSE",
  "VILLA",
  "PLOT",
  "COMMERCIAL_SHOP",
  "COMMERCIAL_OFFICE",
  "COMMERCIAL_BUILDING",
  "FARM_HOUSE",
  "PENTHOUSE",
  "STUDIO",
] as const;

export const propertyStatuses = [
  "AVAILABLE",
  "UNDER_OFFER",
  "SOLD",
  "RENTED",
  "LEASED",
  "WITHDRAWN",
  "DRAFT",
] as const;

export const ownershipTypes = [
  "FREEHOLD",
  "LEASEHOLD",
  "CO_OPERATIVE",
] as const;

export const listedBys = ["OWNER", "AGENT", "BUILDER"] as const;

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

const decimalString = (label: string) =>
  z.union([
    z.string().regex(/^-?\d+(\.\d+)?$/, `${label} must be a valid number`),
    z.number(),
  ]);

const latSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .refine((v) => Number(v) >= -90 && Number(v) <= 90, "Latitude must be between -90 and 90");

const lngSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(\.\d+)?$/)])
  .refine((v) => Number(v) >= -180 && Number(v) <= 180, "Longitude must be between -180 and 180");

const imageObject = z.object({
  url: z.string().trim().min(1, "Image url is required"),
  isFeatured: z.boolean().optional(),
});

export const createVariantSchema = z.object({
  variantName: z.string().trim().min(1, "Variant name is required").max(100),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().int().min(0).optional(),
  balconies: z.number().int().min(0).optional(),
  price: decimalString("Price"),
  mrpPrice: decimalString("MRP price").optional(),
  pricePerSqft: decimalString("Price per sqft").optional(),
  totalArea: decimalString("Total area"),
  totalAreaUnit: z
    .enum(["sqft", "sqmt", "sqyd", "hectare", "acre"])
    .or(z.string()),
  carpetArea: decimalString("Carpet area").optional(),
  carpetAreaUnit: z.string().optional(),
  superBuiltUpArea: decimalString("Super built-up area").optional(),
  superBuiltUpAreaUnit: z.string().optional(),
  plotArea: decimalString("Plot area").optional(),
  plotAreaUnit: z.string().optional(),
  floorNumber: z.number().int().min(0).optional(),
  totalFloors: z.number().int().min(0).optional(),
  availabilityStatus: z.enum(availabilityStatuses).optional(),
  possessionDate: z.coerce.date().optional(),
  isAvailable: z.boolean().optional(),
  inventoryCount: z.number().int().min(0).optional(),
  furnishingStatus: z.enum(furnishingStatuses).optional(),
  furnishingItems: z.array(z.record(z.string(), z.any())).optional(),
  images: z.array(imageObject).optional(),
  brochure: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const updateVariantSchema = createVariantSchema.partial();

export const createPropertySchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(300),
  description: z.string().trim().max(10000).optional(),
  transactionType: z.enum(transactionTypes),
  propertyType: z.enum(propertyTypes),
  propertyStatus: z.enum(propertyStatuses).optional(),
  organizationId: z.string().uuid("Invalid organization").optional(),

  addressLine: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  latitude: latSchema.optional(),
  longitude: lngSchema.optional(),
  googleMapLink: z.string().trim().max(2000).optional(),

  ownershipType: z.enum(ownershipTypes).optional(),
  listedBy: z.enum(listedBys).optional(),
  ageOfProperty: z.number().int().min(0).max(200).optional(),

  amenities: z.array(z.string()).optional(),
  nearbyPlaces: z.array(z.string()).optional(),
  societyInfo: z.record(z.string(), z.any()).optional(),

  videoUrl: z.string().trim().max(2000).optional(),
  virtualTourUrl: z.string().trim().max(2000).optional(),

  reraNumber: z.string().trim().max(100).optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  taxAssessment: z.string().trim().max(100).optional(),
  encumbrance: z.string().trim().max(1000).optional(),

  contactName: z.string().trim().max(200).optional(),
  contactPhone: z.string().trim().max(20).optional(),
  contactEmail: z.string().email("Enter a valid email").trim().toLowerCase().optional(),

  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(500).optional(),
  metaKeywords: z.string().trim().max(500).optional(),

  variants: z
    .array(createVariantSchema)
    .min(1, "At least one variant (BHK config) is required"),
});

export const updatePropertySchema = createPropertySchema.partial();

export const updatePropertyStatusSchema = z.object({
  propertyStatus: z.enum(propertyStatuses),
});

export const verifyPropertySchema = z.object({
  isVerified: z.boolean(),
});

export const toggleActiveSchema = z.object({
  isActive: z.boolean(),
});

export const setImagesSchema = z.object({
  images: z.array(imageObject).max(30, "Maximum 30 images allowed"),
});

export const removeImageSchema = z.object({
  url: z.string().trim().min(1, "Image url is required"),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).optional(),
  q: z.string().trim().max(200).optional(),
  transactionType: z.enum(transactionTypes).optional(),
  propertyType: z.enum(propertyTypes).optional(),
  propertyStatus: z.enum(propertyStatuses).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(20).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).optional(),
  furnishingStatus: z.enum(furnishingStatuses).optional(),
  availabilityStatus: z.enum(availabilityStatuses).optional(),
  isFeatured: z.enum(["true", "false"]).optional(),
  sellerSlug: z.string().trim().max(100).optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "popular"])
    .optional(),
});

export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>;
export type CreateVariantInput = z.infer<typeof createVariantSchema>;
export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
