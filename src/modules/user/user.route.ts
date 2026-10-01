import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateProfilePicture,
  getAllUsers,
  getUserById,
} from "./user.controller";
import { getMyWishlist } from "../propertyWishlist/propertyWishlist.controller";
import { protect, requirePermission, validate, upload } from "../../middlewares";
import { PermissionScope } from "../../generated/prisma/enums";
import { updateUserSchema } from "./user.validation";

const router = Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, validate(updateUserSchema), updateProfile);
router.put("/profile/avatar", protect, upload.single("avatar"), updateProfilePicture);

router.get("/wishlist", protect, getMyWishlist);

// User administration is platform-only. Guarded by the `user:read`
// capability rather than a role name, so it cannot be opened up by adding an
// org member who happens to be called "PLATFORM", and cannot be closed
// accidentally when a platform role is renamed.
router.get("/", protect, requirePermission(PermissionScope.PLATFORM, "user:read"), getAllUsers);
router.get("/:id", protect, requirePermission(PermissionScope.PLATFORM, "user:read"), getUserById);

export default router;
