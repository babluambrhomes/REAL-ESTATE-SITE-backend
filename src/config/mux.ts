import Mux from "@mux/ts";
import { ApiError } from "../utils";

let client: Mux | null = null;

/**
 * Lazily builds the Mux client so a missing Mux config does not stop the
 * whole server from booting. The error is raised only when a Mux-backed
 * endpoint is actually called.
 */
export const getMuxClient = (): Mux => {
  if (client) return client;

  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new ApiError(500, "Mux is not configured");
  }

  client = new Mux({ tokenId, tokenSecret });
  return client;
};

/** Browser origin allowed to PUT directly to the Mux upload URL. */
export const getMuxCorsOrigin = (): string =>
  process.env.MUX_CORS_ORIGIN || process.env.CLIENT_URL || "*";

/** Signing secret used to verify Mux webhook requests. */
export const getMuxWebhookSecret = (): string => {
  const secret = process.env.MUX_WEBHOOK_SECRET;

  if (!secret) {
    throw new ApiError(500, "Mux webhook secret is not configured");
  }

  return secret;
};
