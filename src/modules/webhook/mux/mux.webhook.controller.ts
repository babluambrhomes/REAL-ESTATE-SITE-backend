import { Request, Response } from "express";
import { ApiError } from "../../../utils";
import {
  processMuxWebhookEvent,
  verifyMuxWebhook,
} from "./mux.webhook.service";

export const handleMuxWebhook = async (
  req: Request,
  res: Response
) => {
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody) || rawBody.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid webhook payload",
    });
  }

  let event: Awaited<ReturnType<typeof verifyMuxWebhook>>;

  try {
    event = await verifyMuxWebhook(rawBody, req.headers);
  } catch (error) {
    if (error instanceof ApiError && error.statusCode >= 500) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid webhook signature or payload",
    });
  }

  try {
    await processMuxWebhookEvent(event);
  } catch (error) {
    console.error("Mux webhook processing error:", error);

    return res.status(500).json({
      success: false,
      message: "Webhook processing failed",
    });
  }

  return res.status(200).json({
    success: true,
    received: true,
  });
};
