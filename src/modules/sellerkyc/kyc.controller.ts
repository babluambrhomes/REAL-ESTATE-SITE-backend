import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { DocumentUploadInput } from "./kyc.validation";
import * as kycService from "./kyc.service";

const uploadDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const document = await kycService.uploadDocument(
    req.user!.id,
    req.file,
    (req.body as unknown as DocumentUploadInput) ?? {}
  );
  res.status(201).json(new ApiResponse(201, document, "Document uploaded"));
});

const getDocuments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await kycService.getDocuments(req.user!.id);
  res.status(200).json(new ApiResponse(200, result));
});

const deleteDocument = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await kycService.deleteDocument(req.user!.id, String(req.params.docId));
  res.status(200).json(new ApiResponse(200, result));
});

const getDocumentFile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const absPath = await kycService.getDocumentFile(req.user!.id, String(req.params.docId));
  res.sendFile(absPath);
});

export { uploadDocument, getDocuments, deleteDocument, getDocumentFile };
