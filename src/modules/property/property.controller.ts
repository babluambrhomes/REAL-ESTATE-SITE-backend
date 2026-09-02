import { Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import {
  CreatePropertyInput,
  UpdatePropertyInput,
  CreateVariantInput,
  UpdateVariantInput,
  ListQueryInput,
  listQuerySchema,
} from "./property.validation";
import * as propertyService from "./property.service";

const listProperties = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = listQuerySchema.safeParse(req.query ?? {});
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid query");
  }
  const query: ListQueryInput = result.data;
  const data = await propertyService.listPublicProperties(query);
  res.status(200).json(new ApiResponse(200, data));
});

const getPublicProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.getPublicProperty(
    String(req.params.slug),
    req.user?.id
  );
  res.status(200).json(new ApiResponse(200, property));
});

const getMyProperties = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyService.getMyProperties(
    (req as any).sellerId,
    req.query as unknown as { page?: number; limit?: number; propertyStatus?: string }
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getMyProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.getMyProperty(
    (req as any).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, property));
});

const createProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.createProperty(
    (req as any).sellerId,
    req.body as CreatePropertyInput
  );
  res.status(201).json(new ApiResponse(201, property, "Property created"));
});

const updateProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.updateProperty(
    (req as any).sellerId,
    String(req.params.id),
    req.body as UpdatePropertyInput
  );
  res.status(200).json(new ApiResponse(200, property, "Property updated"));
});

const updatePropertyStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.updatePropertyStatus(
    (req as any).sellerId,
    String(req.params.id),
    (req.body as { propertyStatus: string }).propertyStatus
  );
  res.status(200).json(new ApiResponse(200, property, "Property status updated"));
});

const deleteProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyService.softDeleteProperty(
    (req as any).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, "Property deleted"));
});

const uploadImages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    res.status(400).json(new ApiResponse(400, null, "No files uploaded"));
    return;
  }

  const property = await propertyService.addImages(
    (req as any).sellerId,
    String(req.params.id),
    files
  );
  res.status(200).json(new ApiResponse(200, property, "Images uploaded"));
});

const setImages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.setImageOrder(
    (req as any).sellerId,
    String(req.params.id),
    (req.body as { images: { url: string; isFeatured?: boolean }[] }).images
  );
  res.status(200).json(new ApiResponse(200, property, "Images updated"));
});

const removeImages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.removeImage(
    (req as any).sellerId,
    String(req.params.id),
    (req.body as { url: string }).url
  );
  res.status(200).json(new ApiResponse(200, property, "Image removed"));
});

const addVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await propertyService.addVariant(
    (req as any).sellerId,
    String(req.params.id),
    req.body as CreateVariantInput
  );
  res.status(201).json(new ApiResponse(201, variant, "Variant created"));
});

const updateVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await propertyService.updateVariant(
    (req as any).sellerId,
    String(req.params.id),
    String(req.params.variantId),
    req.body as UpdateVariantInput
  );
  res.status(200).json(new ApiResponse(200, variant, "Variant updated"));
});

const deleteVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyService.deleteVariant(
    (req as any).sellerId,
    String(req.params.id),
    String(req.params.variantId)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const uploadVariantImages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (files.length === 0) {
    res.status(400).json(new ApiResponse(400, null, "No files uploaded"));
    return;
  }

  const variant = await propertyService.addVariantImages(
    (req as any).sellerId,
    String(req.params.id),
    String(req.params.variantId),
    files
  );
  res.status(200).json(new ApiResponse(200, variant, "Variant images uploaded"));
});

const adminListProperties = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyService.adminListProperties(
    req.query as unknown as {
      page?: number;
      limit?: number;
      propertyStatus?: string;
      isVerified?: string;
      isActive?: string;
      includeDeleted?: string;
    }
  );
  res.status(200).json(new ApiResponse(200, result));
});

const verifyProperty = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.verifyProperty(
    req.user!.id,
    String(req.params.id),
    (req.body as { isVerified: boolean }).isVerified
  );
  res.status(200).json(new ApiResponse(200, property, "Property verification updated"));
});

const togglePropertyActive = asyncHandler(async (req: AuthRequest, res: Response) => {
  const property = await propertyService.togglePropertyActive(
    req.user!.id,
    String(req.params.id),
    (req.body as { isActive: boolean }).isActive
  );
  res.status(200).json(new ApiResponse(200, property, "Property status updated"));
});

export {
  listProperties,
  getPublicProperty,
  getMyProperties,
  getMyProperty,
  createProperty,
  updateProperty,
  updatePropertyStatus,
  deleteProperty,
  uploadImages,
  setImages,
  removeImages,
  addVariant,
  updateVariant,
  deleteVariant,
  uploadVariantImages,
  adminListProperties,
  verifyProperty,
  togglePropertyActive,
};
