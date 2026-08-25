import { Router } from "express";
import { toggleWishlist, getMyWishlist } from "./propertyWishlist.controller";
import { protect } from "../../middlewares";

const router = Router();

router.patch("/:id/wishlist", protect, toggleWishlist);

router.get("/wishlist", protect, getMyWishlist);

export default router;
