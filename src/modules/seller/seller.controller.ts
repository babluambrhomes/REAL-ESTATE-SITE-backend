import { Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { BecomeSellerInput, UpdateSellerInput } from "./seller.validation";
import * as sellerService from "./seller.service";

const becomeSeller = asyncHandler(async (req: AuthRequest, res: Response) => {
  const seller = await sellerService.becomeSeller(
    req.user!.id,
    req.body as BecomeSellerInput
  );
  res.status(201).json(new ApiResponse(201, seller, "Seller account created"));
});

const getCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const categories = await sellerService.getCategories(page, limit);
  res.status(200).json(new ApiResponse(200, categories));
});

const getMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await sellerService.getMySeller(req.user!.id);
  res.status(200).json(new ApiResponse(200, profile));
});

const updateMyProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await sellerService.updateSeller(
    req.user!.id,
    req.body as UpdateSellerInput
  );
  res.status(200).json(new ApiResponse(200, profile, "Profile updated"));
});

const updateMySlug = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await sellerService.updateSlug(
    req.user!.id,
    (req.body as { slug: string }).slug
  );
  res.status(200).json(new ApiResponse(200, profile, "Slug updated"));
});

const updateLogo = asyncHandler(async (req: AuthRequest, res: Response) => {
  const logoUrl = await sellerService.updateMedia(req.user!.id, req.file, "logo", 512, 512);
  res.status(200).json(new ApiResponse(200, { logoUrl }, "Logo updated"));
});

const updateCover = asyncHandler(async (req: AuthRequest, res: Response) => {
  const coverUrl = await sellerService.updateMedia(req.user!.id, req.file, "cover", 1600);
  res.status(200).json(new ApiResponse(200, { coverUrl }, "Cover updated"));
});

const getPublicProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const profile = await sellerService.getPublicProfile(String(req.params.slug));
  res.status(200).json(new ApiResponse(200, profile));
});

export {
  becomeSeller,
  getCategories,
  getMyProfile,
  updateMyProfile,
  updateMySlug,
  updateLogo,
  updateCover,
  getPublicProfile,
};
