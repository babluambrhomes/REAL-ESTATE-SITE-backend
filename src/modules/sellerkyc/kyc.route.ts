import fs from "fs/promises";
import { Router, NextFunction, Response } from "express";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  getDocumentFile,
} from "./kyc.controller";
import {
  protect,
  checkSeller,
  checkSellerPermission,
  validate,
  uploadDocument as uploadDocumentMiddleware,
} from "../../middlewares";
import { documentUploadSchema } from "./kyc.validation";
import { AuthRequest } from "../../types";

const router = Router();

/**
 * KYC documents for whichever selling entity the caller names.
 *
 * To act for a company: send `x-organization-id`, or `?organizationId=`, or
 * `organizationId` in the multipart body. Nothing else about the request
 * changes — the same endpoints serve an individual's documents and a
 * company's, and which one you get is decided by that one header.
 */
router.use(protect);

/**
 * Deletes a just-uploaded temp file if anything downstream rejects the
 * request.
 *
 * multer writes to disk before validation runs, so a rejected upload would
 * otherwise leave an orphan image/PDF in the user's KYC folder forever —
 * nobody deletes those, and a user retrying a rejected upload accumulates
 * one per attempt.
 */
const cleanupUploadOnError = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const cleanup = () => {
    const file = req.file;
    if (file?.path) {
      fs.unlink(file.path).catch(() => {
        /* best effort — the request already failed */
      });
    }
  };

  res.on("finish", () => {
    if (res.statusCode >= 400) cleanup();
  });
  next();
};

const canReadKyc = checkSellerPermission("kyc:read");
const canSubmitKyc = checkSellerPermission("kyc:submit");

router.get("/documents", checkSeller, canReadKyc, getDocuments);
router.get("/documents/:docId/file", checkSeller, canReadKyc, getDocumentFile);
router.delete("/documents/:docId", checkSeller, canSubmitKyc, deleteDocument);

/**
 * multer runs BEFORE checkSeller here, and that ordering is load-bearing.
 *
 * For a multipart request the body is not parsed until multer handles it, so
 * a checkSeller running first cannot see `organizationId` in the body and
 * would fall back to the caller's individual profile — filing company GST
 * papers against the person. Running multer first means the body exists by the
 * time the selling context is resolved.
 *
 * The tradeoff is that the file hits disk before the org is validated, which
 * cleanupUploadOnError above handles.
 */
router.post(
  "/documents",
  uploadDocumentMiddleware.single("document"),
  cleanupUploadOnError,
  checkSeller,
  canSubmitKyc,
  validate(documentUploadSchema),
  uploadDocument
);

export default router;
