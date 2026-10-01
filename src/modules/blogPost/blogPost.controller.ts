import { Response } from "express";
import { z } from "zod";
import { ApiResponse, asyncHandler, ApiError } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import {
  myPostsQuerySchema,
  publicFeedQuerySchema,
  CreateBlogPostInput,
  UpdateBlogPostInput,
  ChangeStatusInput,
} from "./blogPost.validation";
import * as blogPostService from "./blogPost.service";

/**
 * Query strings arrive as strings, so they are parsed here rather than through
 * the validate middleware — `validate(schema, "query")` intentionally leaves
 * req.query untouched, which would hand the service uncoerced values. Same
 * approach as property.controller.
 */
const parseOrThrow = <T extends z.ZodType>(
  schema: T,
  value: unknown
): z.infer<T> => {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid query");
  }
  return result.data;
};

const listMyPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await blogPostService.listMyPosts(
    requireSellerContext(req),
    parseOrThrow(myPostsQuerySchema, req.query)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getMyPost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.getMyPost(
    requireSellerContext(req),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, post));
});

const createPost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.createPost(
    requireSellerContext(req),
    req.body as CreateBlogPostInput
  );
  res.status(201).json(
    new ApiResponse(201, post, "Blog post created as a draft")
  );
});

const updatePost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.updatePost(
    requireSellerContext(req),
    String(req.params.id),
    req.body as UpdateBlogPostInput
  );
  res.status(200).json(new ApiResponse(200, post, "Blog post updated"));
});

const changePostStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.changePostStatus(
    requireSellerContext(req),
    String(req.params.id),
    req.body as ChangeStatusInput
  );
  res.status(200).json(new ApiResponse(200, post, `Blog post is now ${post.status}`));
});

const archivePost = asyncHandler(async (req: AuthRequest, res: Response) => {
  await blogPostService.archivePost(requireSellerContext(req), String(req.params.id));
  res.status(200).json(new ApiResponse(200, { message: "Blog post archived" }));
});

const uploadCover = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file;
  if (!file) {
    throw new ApiError(400, "Cover image file is required");
  }

  const post = await blogPostService.uploadCover(
    requireSellerContext(req),
    String(req.params.id),
    file
  );
  res.status(200).json(new ApiResponse(200, post, "Cover image updated"));
});

const removeCover = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.removeCover(
    requireSellerContext(req),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, post, "Cover image removed"));
});

const listPublicPosts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await blogPostService.listPublicPosts(
    parseOrThrow(publicFeedQuerySchema, req.query)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getPublicPost = asyncHandler(async (req: AuthRequest, res: Response) => {
  const post = await blogPostService.getPublicPost(String(req.params.slug));
  res.status(200).json(new ApiResponse(200, post));
});

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
