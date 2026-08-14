import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { CreateCategoryInput, UpdateCategoryInput } from "./sellercategory.validation";
import * as sellercategoryService from "./sellercategory.service";

const listCategories = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const categories = await sellercategoryService.listCategories(page, limit);
  res.status(200).json(new ApiResponse(200, categories));
});

const getCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = await sellercategoryService.getCategory(String(req.params.id));
  res.status(200).json(new ApiResponse(200, category));
});

const createCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = await sellercategoryService.createCategory(
    req.body as CreateCategoryInput
  );
  res.status(201).json(new ApiResponse(201, category, "Category created"));
});

const updateCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = await sellercategoryService.updateCategory(
    String(req.params.id),
    req.body as UpdateCategoryInput
  );
  res.status(200).json(new ApiResponse(200, category, "Category updated"));
});

const deleteCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await sellercategoryService.deleteCategory(String(req.params.id));
  res.status(200).json(new ApiResponse(200, result));
});

const uploadCategoryImage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const category = await sellercategoryService.updateCategoryImage(
    String(req.params.id),
    req.file
  );
  res.status(200).json(new ApiResponse(200, category, "Category image updated"));
});

export {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
};
