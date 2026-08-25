import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { ToggleWishlistParams, WishlistQueryInput } from "./propertyWishlist.validation";
import * as propertyWishlistService from "./propertyWishlist.service";

const toggleWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyWishlistService.toggleWishlist(
    req.user!.id,
    (req.params as ToggleWishlistParams).id
  );

  const message = result.saved ? "Property saved to wishlist" : "Property removed from wishlist";
  res.status(200).json(new ApiResponse(200, result, message));
});

const getMyWishlist = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyWishlistService.getMyWishlist(
    req.user!.id,
    req.query as unknown as WishlistQueryInput
  );
  res.status(200).json(new ApiResponse(200, result));
});

export { toggleWishlist, getMyWishlist };
