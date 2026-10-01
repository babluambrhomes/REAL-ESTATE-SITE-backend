import { Router } from "express";
import {
  listMyPosts,
  getMyPost,
  createPost,
  updatePost,
  changePostStatus,
  archivePost,
  uploadCover,
  removeCover,
} from "./blogPost.controller";
import {
  protect,
  checkSeller,
  checkSellerVerified,
  validate,
  upload,
} from "../../middlewares";
import {
  createBlogPostSchema,
  updateBlogPostSchema,
  changeStatusSchema,
  postIdParamsSchema,
} from "./blogPost.validation";

const router = Router();

// :id UUID hona chahiye — warna Prisma raw error dekar 500 jayega
const validateId = validate(postIdParamsSchema, "params");

/**
 * A seller's own blog. Mounted at /api/v1/sellers/me/blog-posts.
 *
 * checkSeller resolves BOTH an individual seller and an org member to a
 * profile, so this router needs no separate org branch — a post created here
 * belongs to whichever selling entity the caller resolved to. A user who has
 * both an individual profile and an org membership must name the org
 * (x-organization-id header or organizationId in the body) to blog as the
 * company; see resolveRequestedOrgId.
 *
 * Reads only need checkSeller. Anything that creates, edits or publishes is
 * gated on checkSellerVerified, matching propertyFaq: an unverified seller can
 * look at their drafts but cannot put words in front of buyers.
 */
router.get("/", protect, checkSeller, listMyPosts);
router.get("/:id", protect, checkSeller, validateId, getMyPost);

router.post(
  "/",
  protect,
  checkSellerVerified,
  validate(createBlogPostSchema),
  createPost
);

router.patch(
  "/:id",
  protect,
  checkSellerVerified,
  validateId,
  validate(updateBlogPostSchema),
  updatePost
);

router.patch(
  "/:id/status",
  protect,
  checkSellerVerified,
  validateId,
  validate(changeStatusSchema),
  changePostStatus
);

// Soft delete — ARCHIVED, not a row removal. See SellerBlogPost.prisma.
router.delete("/:id", protect, checkSellerVerified, validateId, archivePost);

router.put(
  "/:id/cover",
  protect,
  checkSellerVerified,
  validateId,
  upload.single("cover"),
  uploadCover
);

router.delete(
  "/:id/cover",
  protect,
  checkSellerVerified,
  validateId,
  removeCover
);

export default router;
