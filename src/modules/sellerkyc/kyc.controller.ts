import { Response } from "express";
import { ApiResponse, asyncHandler, ApiError } from "../../utils";
import { AuthRequest, SellerContext } from "../../types";
import { DocumentUploadInput } from "./kyc.validation";
import * as kycService from "./kyc.service";

/**
 * The selling context the middlewares already resolved for this request.
 *
 * Handed to the service rather than letting the service re-derive it from the
 * user id: the middleware sees which organization the caller named, and a
 * user id alone cannot say whether a document belongs to the person or to
 * their company. Double-resolving is how company papers end up filed against
 * an individual profile.
 */
const requireKycContext = (req: AuthRequest): SellerContext => {
  const ctx = req.sellerContext;
  if (!ctx) {
    throw new ApiError(401, "No selling context — authentication required");
  }
  return ctx;
};

const uploadDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const document = await kycService.uploadDocument(
    requireKycContext(req),
    req.user!.id,
    req.file,
    (req.body as unknown as DocumentUploadInput) ?? {}
  );
  res.status(201).json(new ApiResponse(201, document, "Document uploaded"));
});

const getDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await kycService.getDocuments(requireKycContext(req));
  res.status(200).json(new ApiResponse(200, result));
});

const deleteDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await kycService.deleteDocument(
    requireKycContext(req),
    String(req.params.docId)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getDocumentFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await kycService.getDocumentFile(
    requireKycContext(req),
    String(req.params.docId)
  );
  // --- CLOUDINARY (new) ---
  if ("cloudinaryUrl" in result) {
    res.status(200).json(new ApiResponse(200, { url: result.cloudinaryUrl! }));
    return;
  }
  // --- LOCAL (old) -- keep for reference ---
  // res.redirect(result.cloudinaryUrl!);
  res.sendFile(result.absPath);
});

export { uploadDocument, getDocuments, deleteDocument, getDocumentFile };
