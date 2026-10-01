import { Router } from "express";
import { listPublicPosts, getPublicPost } from "./blogPost.controller";
import { validate } from "../../middlewares";
import { slugParamsSchema } from "./blogPost.validation";

const router = Router();

/**
 * Public blog. Mounted at /api/v1/blog-posts.
 *
 * A post's URL is globally unique and names nobody — it is just
 * /blog-posts/home-loan-tips. Which seller it belongs to is a filter
 * (`?seller=<slug>`) and a field in the response, never part of the path, so
 * renaming a company or moving a post between sellers never breaks a link
 * that was already shared.
 *
 * Slug uniqueness is enforced in uniquePostSlug (blogPost.service) with -2, -3
 * suffixes on collision rather than the random suffix generateSlug uses for
 * seller profiles, because these URLs are meant to stay readable.
 *
 * Drafts and archived posts never appear here: the service filters on
 * status PUBLISHED and sellerStatus ACTIVE.
 */
router.get("/", listPublicPosts);
router.get("/:slug", validate(slugParamsSchema, "params"), getPublicPost);

export default router;
