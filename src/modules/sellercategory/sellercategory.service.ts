import slugify from "slugify";
import path from "path";
import fs from "fs/promises";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPaginatedResponse, isUniqueViolation, isRecordNotFound } from "../../helpers";
import { processImage } from "../../workers/image/imageWorker.pool";
import {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "./sellercategory.validation";

const generateSlug = (base: string): string => {
    return slugify(base, {
    lower: true,
    strict: true,
  }) || "category";
};

const listCategories = async (page: number, limit: number) => {
  const { skip, take, page: p, limit: l } = getPaginationParams({ page, limit });

  const [categories, total] = await Promise.all([
    prisma.sellerCategory.findMany({
      skip,
      take,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { sellerProfiles: true } },
      },
    }),
    prisma.sellerCategory.count(),
  ]);

  return buildPaginatedResponse(categories, total, p, l);
};

const getCategory = async (id: string) => {
  const category = await prisma.sellerCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { sellerProfiles: true } },
    },
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  return category;
};

const createCategory = async (data: CreateCategoryInput) => {
  const { name, ...rest } = data;

  // Name unique check
  const nameExists = await prisma.sellerCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
  });

  if (nameExists) {
    throw new ApiError(409, "A category with this name already exists");
  }

  // Slug from name
  const slug = generateSlug(name);

  try {
    return await prisma.sellerCategory.create({
      data: {
        name,
        slug,
        ...rest,
      },
      include: {
        _count: {
          select: {
            sellerProfiles: true,
          },
        },
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new ApiError(409, "A category with this name already exists");
    }
    throw err;
  }
};

const updateCategory = async (
  id: string,
  data: UpdateCategoryInput
) => {
  const { name, ...rest } = data;

  if (name !== undefined) {
    const nameExists = await prisma.sellerCategory.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        NOT: {
          id,
        },
      },
    });

    if (nameExists) {
      throw new ApiError(409, "A category with this name already exists");
    }
  }

  try {
    return await prisma.sellerCategory.update({
      where: { id },
      data: {
        ...(name !== undefined
          ? {
              name,
              slug: generateSlug(name),
            }
          : {}),
        ...rest,
      },
      include: {
        _count: {
          select: {
            sellerProfiles: true,
          },
        },
      },
    });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw new ApiError(404, "Category not found");
    }
    if (isUniqueViolation(err)) {
      throw new ApiError(409, "A category with this name already exists");
    }
    throw err;
  }
};

const deleteCategory = async (id: string) => {
  const category = await prisma.sellerCategory.findUnique({
    where: { id },
    include: {
      _count: { select: { sellerProfiles: true } },
    },
  });

  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  if (category._count.sellerProfiles > 0) {
    throw new ApiError(400, "Cannot delete a category assigned to sellers");
  }

  await prisma.sellerCategory.delete({ where: { id } });

  return { message: "Category deleted" };
};

const updateCategoryImage = async (
  id: string,
  file: Express.Multer.File | undefined
) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const category = await prisma.sellerCategory.findUnique({
    where: { id },
    select: { imageUrl: true },
  });
  if (!category) {
    throw new ApiError(404, "Category not found");
  }

  const parsed = path.parse(file.path);
  const result = await processImage({
    inputPath: file.path,
    outputDir: parsed.dir,
    originalName: path.parse(file.originalname).name,
    deleteOriginal: true,
    outputs: [
      {
        suffix: "category",
        width: 400,
        height: 400,
        fit: "cover",
        format: "webp",
        quality: 85,
      },
    ],
  });

  if (!result.ok) {
    throw new ApiError(500, result.error || "Image processing failed");
  }

  const relPath = path
    .relative(parsed.dir, result.outputs[0])
    .split(path.sep)
    .join("/");
  const url = `/uploads/${relPath}`;

  if (category.imageUrl?.startsWith("/uploads/")) {
    await fs
      .unlink(path.join(process.cwd(), category.imageUrl))
      .catch(() => {});
  }

  return prisma.sellerCategory.update({
    where: { id },
    data: { imageUrl: url },
    include: {
      _count: { select: { sellerProfiles: true } },
    },
  });
};


export {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  updateCategoryImage,
};
