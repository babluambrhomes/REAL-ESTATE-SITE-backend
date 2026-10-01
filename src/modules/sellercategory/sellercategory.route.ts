import { Router } from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
} from "./sellercategory.controller";
import { protect, requirePermission, validate, upload } from "../../middlewares";
import { PermissionScope } from "../../generated/prisma/enums";
import { createCategorySchema, updateCategorySchema } from "./sellercategory.validation";

const router = Router();

router.use(protect);
// Permission rather than a role name: the role list is data, the permission
// is the capability this route actually needs. Renaming "Staff" to something
// else must not silently open or close category management.
router.use(requirePermission(PermissionScope.PLATFORM, "category:manage"));

router.get("/", listCategories);
router.post("/", validate(createCategorySchema), createCategory);
router.post("/:id/image", upload.single("image"), uploadCategoryImage);
router.get("/:id", getCategory);
router.patch("/:id", validate(updateCategorySchema), updateCategory);
router.delete("/:id", deleteCategory);

export default router;
