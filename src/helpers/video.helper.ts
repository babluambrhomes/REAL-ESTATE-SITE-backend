import prisma from "../config/prisma";
import { getMuxClient } from "../config/mux";
import type { Prisma } from "../generated/prisma/client";
import { VideoEntityType, VideoStatus } from "../generated/prisma/enums";

export const videoPublicSelect = {
  id: true,
  name: true,
  originalName: true,
  sizeBytes: true,
  lengthSeconds: true,
  entityType: true,
  status: true,
  playbackId: true,
  thumbnailUrl: true,
  duration: true,
  error: true,
  readyAt: true,
  propertyId: true,
  variantId: true,
  sellerId: true,
  organizationId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VideoSelect;

export const videoOwnerSelect = {
  ...videoPublicSelect,
  userId: true,
} satisfies Prisma.VideoSelect;

export type VideoPublic = Prisma.VideoGetPayload<{
  select: typeof videoPublicSelect;
}>;

export const buildPlaybackUrl = (
  playbackId: string | null | undefined
): string | null =>
  playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;

export const toVideoResponse = <T extends VideoPublic>(video: T) => {
  const rest = { ...video } as T & { userId?: string | null };
  delete rest.userId;

  return {
    ...rest,
    playbackUrl: buildPlaybackUrl(video.playbackId),
  };
};

export const toVideoResponses = (
  videos: VideoPublic[] | null | undefined
) => (videos ?? []).map(toVideoResponse);

export const readyVideoRelationSelect = {
  where: { status: VideoStatus.READY },
  orderBy: { createdAt: "asc" },
  select: videoPublicSelect,
} as const;

/**
 * Adds the derived Mux playback URL to attached videos. Handles both the
 * entity-level relation and variant-level relations in one place so property,
 * seller and organization responses stay consistent.
 */
export const withVideoUrls = <T extends Record<string, any>>(entity: T): T => {
  const result: Record<string, any> = { ...entity };

  if (Array.isArray(result.videoUploads)) {
    result.videoUploads = toVideoResponses(result.videoUploads);
  }

  if (Array.isArray(result.variants)) {
    result.variants = result.variants.map((variant: Record<string, any>) =>
      Array.isArray(variant.videoUploads)
        ? {
            ...variant,
            videoUploads: toVideoResponses(variant.videoUploads),
          }
        : variant
    );
  }

  return result as T;
};

type DeletableVideo = {
  status: VideoStatus;
  uploadId: string;
  assetId: string | null;
};

/**
 * Best-effort Mux cleanup. Never throws: a Mux outage must not prevent the
 * local row from being removed, otherwise the video becomes undeletable.
 */
export const deleteMuxVideo = async (
  video: Pick<DeletableVideo, "status" | "uploadId" | "assetId">
): Promise<void> => {
  try {
    const mux = getMuxClient();

    if (video.assetId) {
      await mux.video.assets.delete(video.assetId).catch(() => undefined);
      return;
    }

    if (
      video.status === VideoStatus.WAITING ||
      video.status === VideoStatus.UPLOADING
    ) {
      await mux.video.uploads.cancel(video.uploadId).catch(() => undefined);
    }
  } catch {
    // Mux is not configured or the request failed — cleanup is best effort.
  }
};

const deleteVideosWhere = async (where: Prisma.VideoWhereInput): Promise<void> => {
  const videos = await prisma.video.findMany({
    where,
    select: { id: true, status: true, uploadId: true, assetId: true },
  });

  if (videos.length === 0) return;

  await Promise.all(videos.map((video) => deleteMuxVideo(video)));

  await prisma.video.deleteMany({
    where: { id: { in: videos.map((video) => video.id) } },
  });
};

/**
 * Deletes every Mux video attached to an entity and its variants.
 *
 * PROPERTY intentionally filters only by propertyId: variant videos also
 * carry propertyId, so they are covered by the same query.
 */
export const deleteVideosForEntity = async (
  entityType: VideoEntityType,
  entityId: string
): Promise<void> => {
  const where: Prisma.VideoWhereInput =
    entityType === VideoEntityType.PROPERTY
      ? { propertyId: entityId }
      : entityType === VideoEntityType.SELLER
        ? { sellerId: entityId }
        : { organizationId: entityId };

  await deleteVideosWhere(where);
};

export const deleteVideosForVariant = async (
  variantId: string
): Promise<void> => {
  await deleteVideosWhere({ variantId });
};
