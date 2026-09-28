import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import {
  SubmitEnquiryInput,
  UpdateEnquiryStatusInput,
  UpdateEnquiryCommentInput,
  ListEnquiriesQueryInput,
} from "./enquiryForm.validation";
import * as enquiryFormService from "./enquiryForm.service";

const submitEnquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enquiry = await enquiryFormService.submitEnquiry(
    req.user?.id,
    req.body as SubmitEnquiryInput
  );
  res.status(201).json(new ApiResponse(201, enquiry, "Enquiry submitted"));
});

const listEnquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enquiries = await enquiryFormService.listEnquiries(
    (req as any).sellerId,
    req.query as unknown as ListEnquiriesQueryInput
  );
  res.status(200).json(new ApiResponse(200, enquiries));
});

const getEnquiryStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await enquiryFormService.getEnquiryStats((req as any).sellerId);
  res.status(200).json(new ApiResponse(200, stats));
});

const getEnquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enquiry = await enquiryFormService.getEnquiry(
    (req as any).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, enquiry));
});

const updateEnquiryStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enquiry = await enquiryFormService.updateEnquiryStatus(
    (req as any).sellerId,
    String(req.params.id),
    req.body as UpdateEnquiryStatusInput
  );
  res.status(200).json(new ApiResponse(200, enquiry, "Enquiry status updated"));
});

const updateEnquiryComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const enquiry = await enquiryFormService.updateEnquiryComment(
    (req as any).sellerId,
    String(req.params.id),
    (req.body as UpdateEnquiryCommentInput).comment
  );
  res.status(200).json(new ApiResponse(200, enquiry, "Comment updated"));
});

const deleteEnquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await enquiryFormService.deleteEnquiry(
    (req as any).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result));
});

export {
  submitEnquiry,
  listEnquiries,
  getEnquiryStats,
  getEnquiry,
  updateEnquiryStatus,
  updateEnquiryComment,
  deleteEnquiry,
};