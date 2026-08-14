import { Router } from "express";
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
} from "./sellercategory.controller";
import {
  protect,
  authorizePlatformRole,
  validate,
  upload,
} from "../../middlewares";
import { createCategorySchema, updateCategorySchema } from "./sellercategory.validation";

const router = Router();

router.use(protect);
router.use(authorizePlatformRole("Super Admin", "Staff"));

router.get("/", listCategories);
router.post("/", validate(createCategorySchema), createCategory);
router.post("/:id/image", upload.single("image"), uploadCategoryImage);
router.get("/:id", getCategory);
router.patch("/:id", validate(updateCategorySchema), updateCategory);
router.delete("/:id", deleteCategory);

export default router;
