import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import {
  CreateInquiryInput,
  UpdateInquiryStatusInput,
  UpdateInquiryCommentInput,
  AssignInquiryInput,
  ListInquiriesQueryInput,
} from "./organizationInquiry.validation";
import * as inquiryService from "./organizationInquiry.service";

// --- Buyer side ---

const createInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await inquiryService.createInquiry(
    String(req.params.orgId),
    req.user!.id,
    req.body as CreateInquiryInput
  );
  res.status(201).json(
    new ApiResponse(201, inquiry, "Thank you — the organization will contact you shortly")
  );
});

// --- Org side ---

const listInquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await inquiryService.listInquiries(
    String(req.params.orgId),
    (req as any).validatedQuery as ListInquiriesQueryInput
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await inquiryService.getInquiry(
    String(req.params.orgId),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, inquiry));
});

const getInquiryStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await inquiryService.getInquiryStats(String(req.params.orgId));
  res.status(200).json(new ApiResponse(200, stats));
});

const updateInquiryStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await inquiryService.updateInquiryStatus(
    String(req.params.orgId),
    String(req.params.id),
    req.body as UpdateInquiryStatusInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Inquiry status updated"));
});

const updateInquiryComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await inquiryService.updateInquiryComment(
    String(req.params.orgId),
    String(req.params.id),
    (req.body as UpdateInquiryCommentInput).comment
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Internal note updated"));
});

const assignInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await inquiryService.assignInquiry(
    String(req.params.orgId),
    String(req.params.id),
    req.body as AssignInquiryInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Inquiry assignment updated"));
});

const deleteInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await inquiryService.deleteInquiry(
    String(req.params.orgId),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createInquiry,
  listInquiries,
  getInquiry,
  getInquiryStats,
  updateInquiryStatus,
  updateInquiryComment,
  assignInquiry,
  deleteInquiry,
};
