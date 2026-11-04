import crypto from "crypto";
import path from "path";

import prisma from "../../config/prisma";
import { getMuxClient, getMuxCorsOrigin } from "../../config/mux";
import { buildPagination, getPaginationParams } from "../../helpers";
import {
  buildPlaybackUrl,
  deleteMuxVideo,
  toVideoResponse,
  toVideoResponses,
  videoOwnerSelect,
  videoPublicSelect,
} from "../../helpers/video.helper";
import { ApiError } from "../../utils";
import type { Prisma } from "../../generated/prisma/client";
import {
  ListingStatus,
  MemberScope,
  MemberStatus,
  OrganizationStatus,
  SellerStatus,
  SellerType,
  VideoEntityType,
  VideoStatus,
} from "../../generated/prisma/enums";
import {
  VIDEO_ALLOWED_EXTENSIONS,
  VIDEO_MAX_LENGTH_SECONDS,
  VIDEO_MAX_SIZE_BYTES,
  VIDEO_UPLOAD_TIMEOUT_SECONDS,
} from "../upload/upload.constants";
import type { VideoListQueryInput, VideoPresignInput } from "./video.validation";

export interface VideoPresignResult {
  videoId: string;
  name: string;
  size: number;
  length: number;
  entityType: VideoEntityType;
  propertyId: string | null;
  variantId: string | null;
  sellerId: string | null;
  organizationId: string | null;
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
}

type VideoTarget = {
  entityType: VideoEntityType;
  propertyId: string | null;
  variantId: string | null;
  sellerId: string | null;
  organizationId: string | null;
};

const sanitizeBaseName = (name: string): string =>
  path
    .parse(name)
    .name.replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 150) || "video";

const buildVideoName = (originalName: string, videoId: string): string => {
  const ext = path.extname(originalName).toLowerCase();

  if (
    !VIDEO_ALLOWED_EXTENSIONS.includes(
      ext as (typeof VIDEO_ALLOWED_EXTENSIONS)[number]
    )
  ) {
    throw new ApiError(400, "Unsupported video format");
  }

  return `${sanitizeBaseName(originalName)}-${videoId}${ext}`;
};

const hasPropertyAccess = async (
  userId: string,
  propertyId: string
): Promise<boolean> => {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, listingStatus: { not: ListingStatus.DELETED } },
    select: { userId: true, organizationId: true },
  });

  if (!property) return false;
  if (!property.organizationId) return property.userId === userId;

  const organization = await prisma.organization.findFirst({
    where: {
      id: property.organizationId,
      status: OrganizationStatus.ACTIVE,
    },
    select: { id: true },
  });

  if (!organization) return false;
  if (property.userId === userId) return true;

  const membership = await prisma.member.findFirst({
    where: {
      userId,
      contextId: property.organizationId,
      scope: MemberScope.ORGANIZATION,
      status: MemberStatus.ACTIVE,
    },
    select: { id: true },
  });

  return Boolean(membership);
};

const resolveVideoTarget = async (
  userId: string,
  input: VideoPresignInput
): Promise<VideoTarget> => {
  const targetCount = [
    input.propertyId,
    input.sellerId,
    input.organizationId,
  ].filter(Boolean).length;

  if (targetCount !== 1) {
    throw new ApiError(
      400,
      "Exactly one of propertyId, sellerId or organizationId is required"
    );
  }

  if (input.variantId && !input.propertyId) {
    throw new ApiError(400, "variantId can only be used with propertyId");
  }

  if (input.propertyId) {
    const hasAccess = await hasPropertyAccess(userId, input.propertyId);
    if (!hasAccess) {
      throw new ApiError(404, "Property not found or not accessible");
    }

    if (input.variantId) {
      const variant = await prisma.propertyVariant.findFirst({
        where: { id: input.variantId, propertyId: input.propertyId },
        select: { id: true },
      });

      if (!variant) {
        throw new ApiError(404, "Variant not found on this property");
      }
    }

    return {
      entityType: VideoEntityType.PROPERTY,
      propertyId: input.propertyId,
      variantId: input.variantId ?? null,
      sellerId: null,
      organizationId: null,
    };
  }

  if (input.sellerId) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: input.sellerId },
      select: {
        id: true,
        userId: true,
        sellerType: true,
        organizationId: true,
        sellerStatus: true,
      },
    });

    if (!seller) throw new ApiError(404, "Seller profile not found");

    if (seller.userId !== userId) {
      throw new ApiError(403, "You can only upload videos to your own seller profile");
    }

    if (
      seller.sellerType !== SellerType.INDIVIDUAL ||
      seller.organizationId !== null
    ) {
      throw new ApiError(
        400,
        "This is an organization profile — use organizationId for organization videos"
      );
    }

    if (
      seller.sellerStatus === SellerStatus.DELETED ||
      seller.sellerStatus === SellerStatus.SUSPENDED
    ) {
      throw new ApiError(403, "This seller profile is not active");
    }

    return {
      entityType: VideoEntityType.SELLER,
      propertyId: null,
      variantId: null,
      sellerId: seller.id,
      organizationId: null,
    };
  }

  const membership = await prisma.member.findFirst({
    where: {
      userId,
      contextId: input.organizationId!,
      scope: MemberScope.ORGANIZATION,
      status: MemberStatus.ACTIVE,
      organization: { status: OrganizationStatus.ACTIVE },
    },
    select: { id: true },
  });

  if (!membership) {
    throw new ApiError(
      403,
      "You are not an active member of this organization"
    );
  }

  return {
    entityType: VideoEntityType.ORGANIZATION,
    propertyId: null,
    variantId: null,
    sellerId: null,
    organizationId: input.organizationId!,
  };
};

const canManageVideo = async (
  userId: string,
  video: {
    userId: string | null;
    propertyId: string | null;
    sellerId: string | null;
    organizationId: string | null;
  }
): Promise<boolean> => {
  if (video.userId === userId) return true;

  if (video.propertyId) {
    return hasPropertyAccess(userId, video.propertyId);
  }

  if (video.sellerId) {
    const seller = await prisma.sellerProfile.findUnique({
      where: { id: video.sellerId },
      select: { userId: true },
    });
    return seller?.userId === userId;
  }

  if (video.organizationId) {
    const membership = await prisma.member.findFirst({
      where: {
        userId,
        contextId: video.organizationId,
        scope: MemberScope.ORGANIZATION,
        status: MemberStatus.ACTIVE,
      },
      select: { id: true },
    });
    return Boolean(membership);
  }

  return false;
};

export const createVideoPresign = async (
  input: VideoPresignInput,
  userId: string
): Promise<VideoPresignResult> => {
  if (input.size > VIDEO_MAX_SIZE_BYTES) {
    throw new ApiError(400, "Video must be 20MB or less");
  }

  if (input.length > VIDEO_MAX_LENGTH_SECONDS) {
    throw new ApiError(400, "Video must be 50 seconds or less");
  }

  const target = await resolveVideoTarget(userId, input);

  if (input.entityType && input.entityType !== target.entityType) {
    throw new ApiError(400, "entityType does not match the selected target");
  }

  const videoId = crypto.randomUUID();
  const name = buildVideoName(input.name, videoId);

  const upload = await getMuxClient().video.uploads.create({
    cors_origin: getMuxCorsOrigin(),
    timeout: VIDEO_UPLOAD_TIMEOUT_SECONDS,
    new_asset_settings: {
      playback_policies: ["public"],
      video_quality: "basic",
      max_resolution_tier: "1080p",
      passthrough: videoId,
      meta: {
        title: name,
        external_id: videoId,
        creator_id: userId,
      },
    },
  });

  if (!upload.url) {
    await getMuxClient().video.uploads.cancel(upload.id).catch(() => undefined);
    throw new ApiError(502, "Mux did not return an upload URL");
  }

  try {
    await prisma.video.create({
      data: {
        id: videoId,
        userId,
        entityType: target.entityType,
        propertyId: target.propertyId,
        variantId: target.variantId,
        sellerId: target.sellerId,
        organizationId: target.organizationId,
        name,
        originalName: input.name,
        sizeBytes: input.size,
        lengthSeconds: input.length,
        uploadId: upload.id,
        status: VideoStatus.WAITING,
      },
    });
  } catch (error) {
    await getMuxClient().video.uploads.cancel(upload.id).catch(() => undefined);
    throw error;
  }

  return {
    videoId,
    name,
    size: input.size,
    length: input.length,
    entityType: target.entityType,
    propertyId: target.propertyId,
    variantId: target.variantId,
    sellerId: target.sellerId,
    organizationId: target.organizationId,
    uploadId: upload.id,
    uploadUrl: upload.url,
    expiresAt: new Date(
      Date.now() + VIDEO_UPLOAD_TIMEOUT_SECONDS * 1000
    ).toISOString(),
  };
};

export const listMyVideos = async (
  userId: string,
  query: VideoListQueryInput
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.VideoWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
  };

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: videoPublicSelect,
    }),
    prisma.video.count({ where }),
  ]);

  return {
    data: toVideoResponses(videos),
    ...buildPagination(total, page, limit),
  };
};

export const getVideo = async (userId: string, videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: videoOwnerSelect,
  });

  if (!video) throw new ApiError(404, "Video not found");

  const allowed = await canManageVideo(userId, video);
  if (!allowed) throw new ApiError(403, "You do not have access to this video");

  return toVideoResponse(video);
};

export const getVideoStatus = async (userId: string, videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      propertyId: true,
      sellerId: true,
      organizationId: true,
      status: true,
      error: true,
      playbackId: true,
      thumbnailUrl: true,
      updatedAt: true,
    },
  });

  if (!video) throw new ApiError(404, "Video not found");

  const allowed = await canManageVideo(userId, video);
  if (!allowed) throw new ApiError(403, "You do not have access to this video");

  return {
    id: video.id,
    status: video.status,
    error: video.error,
    playbackId: video.playbackId,
    playbackUrl: buildPlaybackUrl(video.playbackId),
    thumbnailUrl: video.thumbnailUrl,
    updatedAt: video.updatedAt,
  };
};

export const listVideosForEntity = async (
  entityType: VideoEntityType,
  entityId: string,
  query: VideoListQueryInput
) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const emptyResult = () => ({
    data: [],
    ...buildPagination(0, page, limit),
  });

  if (entityType === VideoEntityType.PROPERTY) {
    const property = await prisma.property.findFirst({
      where: {
        id: entityId,
        listingStatus: { not: ListingStatus.DELETED },
      },
      select: { id: true },
    });
    if (!property) return emptyResult();
  } else if (entityType === VideoEntityType.SELLER) {
    const seller = await prisma.sellerProfile.findFirst({
      where: {
        id: entityId,
        sellerStatus: { notIn: [SellerStatus.DELETED, SellerStatus.SUSPENDED] },
      },
      select: { id: true },
    });
    if (!seller) return emptyResult();
  } else {
    const organization = await prisma.organization.findFirst({
      where: { id: entityId, status: OrganizationStatus.ACTIVE },
      select: { id: true },
    });
    if (!organization) return emptyResult();
  }

  const where: Prisma.VideoWhereInput =
    entityType === VideoEntityType.PROPERTY
      ? { propertyId: entityId, status: VideoStatus.READY }
      : entityType === VideoEntityType.SELLER
        ? { sellerId: entityId, status: VideoStatus.READY }
        : { organizationId: entityId, status: VideoStatus.READY };

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "asc" },
      select: videoPublicSelect,
    }),
    prisma.video.count({ where }),
  ]);

  return {
    data: toVideoResponses(videos),
    ...buildPagination(total, page, limit),
  };
};

export const cancelVideo = async (userId: string, videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      propertyId: true,
      sellerId: true,
      organizationId: true,
      status: true,
      uploadId: true,
    },
  });

  if (!video) throw new ApiError(404, "Video not found");

  const allowed = await canManageVideo(userId, video);
  if (!allowed) throw new ApiError(403, "You do not have access to this video");

  if (
    video.status !== VideoStatus.WAITING &&
    video.status !== VideoStatus.UPLOADING
  ) {
    throw new ApiError(409, "This upload can no longer be cancelled");
  }

  await getMuxClient().video.uploads.cancel(video.uploadId).catch(() => undefined);

  const updated = await prisma.video.update({
    where: { id: video.id },
    data: { status: VideoStatus.CANCELLED },
    select: videoPublicSelect,
  });

  return toVideoResponse(updated);
};

export const deleteVideo = async (userId: string, videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      propertyId: true,
      sellerId: true,
      organizationId: true,
      status: true,
      uploadId: true,
      assetId: true,
    },
  });

  if (!video) throw new ApiError(404, "Video not found");

  const allowed = await canManageVideo(userId, video);
  if (!allowed) throw new ApiError(403, "You do not have access to this video");

  await deleteMuxVideo(video);
  await prisma.video.delete({ where: { id: video.id } });

  return { message: "Video deleted" };
};
