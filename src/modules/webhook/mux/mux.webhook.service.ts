import type { Request } from "express";
import prisma from "../../../config/prisma";
import { getMuxClient, getMuxWebhookSecret } from "../../../config/mux";
import { VideoStatus } from "../../../generated/prisma/enums";
import type { Prisma } from "../../../generated/prisma/client";

export type MuxWebhookEvent = Awaited<
  ReturnType<ReturnType<typeof getMuxClient>["webhooks"]["unwrap"]>
>;

type AssetEventData = {
  id: string;
  passthrough?: string;
};

const assetWhere = (data: AssetEventData): Prisma.VideoWhereInput =>
  data.passthrough
    ? { OR: [{ assetId: data.id }, { id: data.passthrough }] }
    : { assetId: data.id };

export const verifyMuxWebhook = async (
  rawBody: Buffer,
  headers: Request["headers"]
): Promise<MuxWebhookEvent> =>
  getMuxClient().webhooks.unwrap(
    rawBody,
    headers,
    getMuxWebhookSecret()
  );

export const processMuxWebhookEvent = async (
  event: MuxWebhookEvent
): Promise<void> => {
  switch (event.type) {
    case "video.upload.asset_created": {
      if (!event.data.asset_id) break;

      await prisma.video.updateMany({
        where: { uploadId: event.data.id },
        data: {
          assetId: event.data.asset_id,
          status: VideoStatus.ASSET_CREATED,
        },
      });

      break;
    }

    case "video.asset.created": {
      await prisma.video.updateMany({
        where: assetWhere(event.data),
        data: {
          assetId: event.data.id,
          status: VideoStatus.PROCESSING,
        },
      });

      break;
    }

    case "video.asset.ready": {
      const playbackId = event.data.playback_ids?.[0]?.id;

      await prisma.video.updateMany({
        where: assetWhere(event.data),
        data: {
          assetId: event.data.id,
          status: VideoStatus.READY,
          error: null,
          readyAt: new Date(),
          ...(event.data.duration !== undefined
            ? { duration: event.data.duration }
            : {}),
          ...(playbackId
            ? {
                playbackId,
                thumbnailUrl: `https://image.mux.com/${playbackId}/thumbnail.jpg`,
              }
            : {}),
        },
      });

      break;
    }

    case "video.asset.errored": {
      const errorMessage =
        event.data.errors?.messages?.join("; ") ||
        event.data.errors?.type ||
        "Mux asset processing failed";

      await prisma.video.updateMany({
        where: assetWhere(event.data),
        data: {
          assetId: event.data.id,
          status: VideoStatus.FAILED,
          error: errorMessage,
        },
      });

      break;
    }

    case "video.upload.errored": {
      await prisma.video.updateMany({
        where: { uploadId: event.data.id },
        data: {
          status: VideoStatus.FAILED,
          error: "Mux upload failed",
        },
      });

      break;
    }

    case "video.upload.cancelled": {
      await prisma.video.updateMany({
        where: { uploadId: event.data.id },
        data: {
          status: VideoStatus.CANCELLED,
        },
      });

      break;
    }

    default:
      break;
  }
};
