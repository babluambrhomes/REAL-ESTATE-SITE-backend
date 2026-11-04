import path from "path";
import { z } from "zod";
import {
  VIDEO_ALLOWED_EXTENSIONS,
  VIDEO_ENTITY_TYPES,
  VIDEO_MAX_LENGTH_SECONDS,
  VIDEO_MAX_SIZE_BYTES,
  VIDEO_STATUSES,
} from "../upload/upload.constants";

const videoNameSchema = z
  .string()
  .trim()
  .min(1, "Video name is required")
  .max(200, "Video name is too long")
  .refine(
    (name) =>
      VIDEO_ALLOWED_EXTENSIONS.includes(
        path.extname(name).toLowerCase() as (typeof VIDEO_ALLOWED_EXTENSIONS)[number]
      ),
    "Unsupported video format"
  );

export const videoPresignSchema = z
  .object({
    name: videoNameSchema,
    size: z.coerce
      .number()
      .int("Video size must be a whole number")
      .positive("Video size must be greater than 0")
      .max(VIDEO_MAX_SIZE_BYTES, "Video must be 20MB or less"),
    length: z.coerce
      .number()
      .positive("Video length must be greater than 0")
      .max(VIDEO_MAX_LENGTH_SECONDS, "Video must be 50 seconds or less"),

    propertyId: z.string().uuid("Invalid property").optional(),
    variantId: z.string().uuid("Invalid variant").optional(),
    sellerId: z.string().uuid("Invalid seller").optional(),
    organizationId: z.string().uuid("Invalid organization").optional(),

    /** Optional compatibility field. The server derives and validates it. */
    entityType: z.enum(VIDEO_ENTITY_TYPES).optional(),
  })
  .superRefine((data, ctx) => {
    const targets = [
      data.propertyId,
      data.sellerId,
      data.organizationId,
    ].filter(Boolean);

    if (targets.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["propertyId"],
        message:
          "Exactly one of propertyId, sellerId or organizationId is required",
      });
    }

    if (data.variantId && !data.propertyId) {
      ctx.addIssue({
        code: "custom",
        path: ["variantId"],
        message: "variantId can only be used together with propertyId",
      });
    }
  });

export type VideoPresignInput = z.infer<typeof videoPresignSchema>;

export const videoListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(VIDEO_STATUSES).optional(),
  entityType: z.enum(VIDEO_ENTITY_TYPES).optional(),
});

export type VideoListQueryInput = z.infer<typeof videoListQuerySchema>;

export const videoEntityParamsSchema = z.object({
  entityType: z.enum(VIDEO_ENTITY_TYPES),
  entityId: z.string().uuid("Invalid entity id"),
});

export type VideoEntityParamsInput = z.infer<typeof videoEntityParamsSchema>;
