import path from "path";
import slugify from "slugify";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import {
  getPaginationParams,
  buildPagination,
  withUniqueRetry,
  sellerIdentitySelect,
} from "../../helpers";
import { processImage } from "../../workers/image/imageWorker.pool";
import {
  uploadFile,
  deleteCloudinaryFile,
  isCloudinaryUrl,
} from "../../helpers/cloudinary.helper";
import { BlogStatus, SellerStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { SellerContext } from "../../types";
import {
  CreateBlogPostInput,
  UpdateBlogPostInput,
  ChangeStatusInput,
  MyPostsQueryInput,
  PublicFeedQueryInput,
} from "./blogPost.validation";

/**
 * Seller blog posts.
 *
 * Every table involved here hangs off SellerProfile, so an organization gets
 * blog posts for free: an org member resolves to the org's shared profile via
 * checkSeller and the post belongs to the company, not to the person. The
 * author is the acting user, which is why two colleagues at the same company
 * produce posts with different `authorId` but the same `sellerId`.
 *
 * Two ownership rules hold throughout:
 *   sellerId  always comes from the resolved context, never from the body
 *   authorId  always the acting user, never from the body
 */

// Owner's view — includes the workflow fields the public never sees.
const postManageSelect = {
  id: true,
  sellerId: true,
  authorId: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  coverImage: true,
  images: true,
  tags: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  status: true,
  publishedAt: true,
  viewsCount: true,
  createdAt: true,
  updatedAt: true,
} as const;

// One author block, shared by the card and the detail selects. A post without
// an author is possible in principle (the author user was deleted), so every
// field is read defensively downstream rather than assumed present.
const authorSelect = {
  id: true,
  person: {
    select: { firstName: true, lastName: true, avatarUrl: true },
  },
} as const;

const publicCardSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverImage: true,
  tags: true,
  viewsCount: true,
  publishedAt: true,
  createdAt: true,
  seller: { select: sellerIdentitySelect },
  author: { select: authorSelect },
} as const;

const publicDetailSelect = {
  ...publicCardSelect,
  content: true,
  images: true,
  metaTitle: true,
  metaDescription: true,
  metaKeywords: true,
  updatedAt: true,
} as const;

const MAX_SLUG_ATTEMPTS = 50;
const MAX_SLUG_BASE_LENGTH = 120;

/**
 * Builds a slug that no other post on the platform is using.
 *
 * `slug` is UNIQUE across the whole table, not per seller, so "home-loan-tips"
 * can only ever be claimed once even though two unrelated sellers will both
 * want it. Rather than stamping every URL with a random suffix the way
 * generateSlug does for seller profiles, the first claimant gets the clean
 * slug and later ones get -2, -3. URLs stay readable and stay unique.
 */
const uniquePostSlug = async (title: string): Promise<string> => {
  const base =
    slugify(title, { lower: true, strict: true })
      .slice(0, MAX_SLUG_BASE_LENGTH)
      .replace(/-+$/, "") || "post";

  const clashes = await prisma.sellerBlogPost.findMany({
    where: { OR: [{ slug: base }, { slug: { startsWith: `${base}-` } }] },
    select: { slug: true },
  });

  if (!clashes.some((row) => row.slug === base)) return base;

  const taken = new Set(clashes.map((row) => row.slug));
  for (let n = 2; n <= MAX_SLUG_ATTEMPTS; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new ApiError(
    409,
    "Could not generate a unique URL for this post — please use a different title"
  );
};

/**
 * Ownership check for a single post.
 *
 * Filters on sellerId inline rather than after fetching, so a post belonging
 * to another seller is never even loaded. 404 rather than 403 so the response
 * does not confirm that someone else's post exists.
 */
const findOwnPost = async (ctx: SellerContext, id: string) => {
  const post = await prisma.sellerBlogPost.findFirst({
    where: { id, sellerId: ctx.sellerId },
    select: postManageSelect,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found");
  }

  return post;
};

/**
 * Legal status moves.
 *
 * The point of listing these instead of just accepting any enum value is that
 * ARCHIVED is this model's soft delete. Allowing PUBLISHED → ARCHIVED but not
 * ARCHIVED → PUBLISHED means an archived post can only come back as a draft
 * that someone re-publishes on purpose, which keeps the publish decision
 * explicit rather than a side effect of un-archiving.
 */
const ALLOWED_TRANSITIONS: Record<BlogStatus, readonly BlogStatus[]> = {
  [BlogStatus.DRAFT]: [BlogStatus.PUBLISHED, BlogStatus.ARCHIVED],
  [BlogStatus.PUBLISHED]: [BlogStatus.DRAFT, BlogStatus.ARCHIVED],
  [BlogStatus.ARCHIVED]: [BlogStatus.DRAFT],
};

const listMyPosts = async (ctx: SellerContext, query: MyPostsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.SellerBlogPostWhereInput = {
    sellerId: ctx.sellerId,
    ...(query.status ? { status: query.status as BlogStatus } : {}),
  };

  const [posts, total] = await prisma.$transaction([
    prisma.sellerBlogPost.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      skip,
      take,
      select: postManageSelect,
    }),
    prisma.sellerBlogPost.count({ where }),
  ]);

  return { data: posts, ...buildPagination(total, page, limit) };
};

const getMyPost = async (ctx: SellerContext, id: string) => {
  return findOwnPost(ctx, id);
};

const createPost = async (ctx: SellerContext, data: CreateBlogPostInput) => {
  // The slug is resolved inside the retried closure on purpose. Two sellers
  // publishing "Home Loan Tips" at the same moment both read "home-loan-tips"
  // as free, one loses with P2002, and the retry re-derives a slug that is
  // now taken.
  return withUniqueRetry(async () => {
    const slug = await uniquePostSlug(data.title);

    return prisma.sellerBlogPost.create({
      data: {
        sellerId: ctx.sellerId,
        authorId: ctx.userId,
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt,
        images: data.images,
        tags: data.tags,
        metaTitle: data.metaTitle,
        metaDescription: data.metaDescription,
        metaKeywords: data.metaKeywords,
        status: BlogStatus.DRAFT,
      },
      select: postManageSelect,
    });
  });
};

const updatePost = async (
  ctx: SellerContext,
  id: string,
  data: UpdateBlogPostInput
) => {
  const post = await findOwnPost(ctx, id);

  return prisma.sellerBlogPost.update({
    where: { id: post.id },
    data,
    select: postManageSelect,
  });
};

const changePostStatus = async (
  ctx: SellerContext,
  id: string,
  data: ChangeStatusInput
) => {
  const post = await findOwnPost(ctx, id);
  const next = data.status as BlogStatus;

  // Re-sending the current status is a no-op, not an error — idempotent
  // retries should not fail.
  if (next === post.status) return post;

  if (!ALLOWED_TRANSITIONS[post.status].includes(next)) {
    throw new ApiError(
      400,
      `Cannot change a ${post.status} post to ${next}`
    );
  }

  // publishedAt records when the post last went live. Coming off PUBLISHED
  // clears it, so it never disagrees with `status`.
  const publishedAt =
    next === BlogStatus.PUBLISHED ? post.publishedAt ?? new Date() : null;

  return prisma.sellerBlogPost.update({
    where: { id: post.id },
    data: { status: next, publishedAt },
    select: postManageSelect,
  });
};

/** DELETE /:id — soft delete via ARCHIVED, per the model's soft-delete design. */
const archivePost = async (ctx: SellerContext, id: string) => {
  const post = await findOwnPost(ctx, id);

  if (post.status === BlogStatus.ARCHIVED) return post;

  return prisma.sellerBlogPost.update({
    where: { id: post.id },
    data: { status: BlogStatus.ARCHIVED, publishedAt: null },
    select: postManageSelect,
  });
};

const uploadCover = async (
  ctx: SellerContext,
  id: string,
  file: Express.Multer.File
) => {
  const post = await findOwnPost(ctx, id);
  const previous = post.coverImage;

  const parsed = path.parse(file.path);
  const result = await processImage({
    inputPath: file.path,
    outputDir: parsed.dir,
    originalName: path.parse(file.originalname).name,
    deleteOriginal: true,
    outputs: [
      {
        suffix: "blog-cover",
        // 1200x630 is the Open Graph image size — the cover doubles as the
        // social share card, so a square crop would break link previews.
        width: 1200,
        height: 630,
        fit: "cover",
        format: "webp",
        quality: 82,
      },
    ],
  });

  if (!result.ok) {
    throw new ApiError(500, result.error || "Image processing failed");
  }

  const uploaded = await uploadFile(result.outputs[0], {
    folder: `${process.env.CLOUDINARY_FOLDER || "real-estate"}/blog-posts/cover`,
    resourceType: "image",
  });

  const updated = await prisma.sellerBlogPost.update({
    where: { id: post.id },
    data: { coverImage: uploaded.url },
    select: postManageSelect,
  });

  // Only after the row points at the new image — if Cloudinary fails here the
  // database still holds a working URL.
  if (previous && isCloudinaryUrl(previous)) {
    await deleteCloudinaryFile(previous);
  }

  return updated;
};

const removeCover = async (ctx: SellerContext, id: string) => {
  const post = await findOwnPost(ctx, id);

  if (!post.coverImage) return post;

  const cleared = await prisma.sellerBlogPost.update({
    where: { id: post.id },
    data: { coverImage: null },
    select: postManageSelect,
  });

  if (isCloudinaryUrl(post.coverImage)) {
    await deleteCloudinaryFile(post.coverImage);
  }

  return cleared;
};

/**
 * Published posts, newest first.
 *
 * `seller` filters by seller slug rather than nesting the path, because a
 * post's own URL is globally unique and deliberately says nothing about who
 * wrote it. The seller's identity rides along in the response instead.
 */
const listPublicPosts = async (query: PublicFeedQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.SellerBlogPostWhereInput = {
    status: BlogStatus.PUBLISHED,
    seller: {
      sellerStatus: SellerStatus.ACTIVE,
      ...(query.seller ? { slug: query.seller } : {}),
    },
    ...(query.tag ? { tags: { array_contains: [query.tag] } } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { excerpt: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [posts, total] = await prisma.$transaction([
    prisma.sellerBlogPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }],
      skip,
      take,
      select: publicCardSelect,
    }),
    prisma.sellerBlogPost.count({ where }),
  ]);

  return { data: posts, ...buildPagination(total, page, limit) };
};

const getPublicPost = async (slug: string) => {
  const post = await prisma.sellerBlogPost.findFirst({
    where: {
      slug,
      status: BlogStatus.PUBLISHED,
      seller: { sellerStatus: SellerStatus.ACTIVE },
    },
    select: publicDetailSelect,
  });

  if (!post) {
    throw new ApiError(404, "Blog post not found");
  }

  // Counting the view after the read means a slow counter can never delay the
  // page, and the response reports the post's view count including this hit
  // without a second round trip.
  await prisma.sellerBlogPost.update({
    where: { id: post.id },
    data: { viewsCount: { increment: 1 } },
  });

  return { ...post, viewsCount: post.viewsCount + 1 };
};

export {
  listMyPosts,
  getMyPost,
  createPost,
  updatePost,
  changePostStatus,
  archivePost,
  uploadCover,
  removeCover,
  listPublicPosts,
  getPublicPost,
};
