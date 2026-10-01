import { z } from "zod";

const MAX_IMAGES = 10;
const MAX_TAGS = 15;

// Slug shape mirrors updateSlugSchema in seller.validation.ts so a post URL
// and a seller URL are built the same way.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const imageListSchema = z
  .array(z.string().url("Invalid image URL").max(500))
  .max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images allowed`);

const tagListSchema = z
  .array(z.string().trim().min(1).max(40))
  .max(MAX_TAGS, `Maximum ${MAX_TAGS} tags allowed`);

/**
 * Blog post bodies are HTML/Markdown supplied by sellers, so the ceiling is
 * deliberately generous. The 5 MB request limit in upload.middleware is the
 * real transport bound.
 */
const contentField = z
  .string()
  .min(20, "Content must be at least 20 characters")
  .max(200_000, "Content is too long")
  .trim();

const titleField = z
  .string()
  .min(5, "Title must be at least 5 characters")
  .max(200, "Title must be at most 200 characters")
  .trim();

const seoFields = {
  metaTitle: z.string().max(70, "Meta title must be at most 70 characters").trim().optional(),
  metaDescription: z
    .string()
    .max(200, "Meta description must be at most 200 characters")
    .trim()
    .optional(),
  metaKeywords: z
    .string()
    .max(300, "Meta keywords must be at most 300 characters")
    .trim()
    .optional(),
};

/**
 * A new post always starts as DRAFT.
 *
 * `status` is deliberately absent from this schema. Publishing is a separate
 * endpoint (PATCH /:id/status) so that saving an edit can never accidentally
 * put a draft in front of buyers, and so the publish decision is something a
 * seller takes deliberately rather than something that rides along in the
 * body of an unrelated update.
 */
export const createBlogPostSchema = z.object({
  title: titleField,
  content: contentField,
  excerpt: z
    .string()
    .max(500, "Excerpt must be at most 500 characters")
    .trim()
    .optional(),
  images: imageListSchema.optional(),
  tags: tagListSchema.optional(),
  ...seoFields,
});

/** Content edits. Status and slug are NOT editable here — see changeStatusSchema. */
export const updateBlogPostSchema = z
  .object({
    title: titleField.optional(),
    content: contentField.optional(),
    excerpt: z
      .string()
      .max(500, "Excerpt must be at most 500 characters")
      .trim()
      .optional(),
    images: imageListSchema.optional(),
    tags: tagListSchema.optional(),
    ...seoFields,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

/**
 * Publishing / unpublishing / archiving.
 *
 * ARCHIVED is this model's soft delete (SellerBlogPost.prisma notes there is
 * deliberately no `deletedAt` column), so DELETE /:id and `status: ARCHIVED`
 * mean the same thing. Both exist: the verb reads better in a UI, the status
 * lets a seller restore an archived post.
 */
export const changeStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

/** Seller's own post list — includes unpublished work. */
export const myPostsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

/**
 * Public feed.
 *
 * `seller` is a filter, not part of a post's URL. Post URLs are globally
 * unique and carry no seller identity, so browsing one seller's posts is a
 * query on the feed rather than a nested path.
 */
export const publicFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  seller: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(40).optional(),
  q: z.string().trim().max(200).optional(),
});

export const postIdParamsSchema = z.object({
  id: z.string().uuid("Invalid blog post"),
});

export const slugParamsSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(SLUG_PATTERN, "Invalid slug")
    .trim(),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
export type MyPostsQueryInput = z.infer<typeof myPostsQuerySchema>;
export type PublicFeedQueryInput = z.infer<typeof publicFeedQuerySchema>;
