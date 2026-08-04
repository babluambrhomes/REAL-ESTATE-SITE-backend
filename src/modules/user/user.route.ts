import { Router } from "express";
import {
  getProfile,
  updateProfile,
  updateProfilePicture,
  getAllUsers,
  getUserById,
} from "./user.controller";
import { protect, authorize, validate, upload } from "../../middlewares";
import { updateUserSchema } from "./user.validation";

const router = Router();

router.get("/profile", protect, getProfile);
router.put("/profile", protect, validate(updateUserSchema), updateProfile);
router.put("/profile/avatar", protect, upload.single("avatar"), updateProfilePicture);

router.get("/", protect, authorize("PLATFORM"), getAllUsers);
router.get("/:id", protect, authorize("PLATFORM"), getUserById);

export default router;
