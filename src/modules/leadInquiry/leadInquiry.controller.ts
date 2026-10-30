import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { requireSellerContext } from "../../helpers";
import { AuthRequest } from "../../types";
import {
  type AddCommentInput,
  type AssignInput,
  type CancelInput,
  type CreateGeneralLeadInput,
  type CreateOrganizationInquiryInput,
  type CreateSiteVisitInput,
  type ListLeadInquiriesQueryInput,
  type RescheduleInput,
  type UpdateStatusInput,
} from "./leadInquiry.validation";
import * as leadInquiryService from "./leadInquiry.service";

const query = (req: AuthRequest) =>
  (req as any).validatedQuery as ListLeadInquiriesQueryInput;

// --- Buyer side ---

const createGeneralLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.createGeneralLead(
    req.user!.id,
    req.body as CreateGeneralLeadInput
  );
  res.status(201).json(new ApiResponse(201, inquiry, "Lead submitted successfully"));
});

const createOrganizationInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.createOrganizationInquiry(
    req.user!.id,
    req.body as CreateOrganizationInquiryInput
  );
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        inquiry,
        "Thank you — the organization will contact you shortly"
      )
    );
});

const createSiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.createSiteVisit(
    req.user!.id,
    req.body as CreateSiteVisitInput
  );
  res.status(201).json(new ApiResponse(201, inquiry, "Site visit booked successfully"));
});

const listMyLeadInquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await leadInquiryService.listMyLeadInquiries(req.user!.id, query(req));
  res.status(200).json(new ApiResponse(200, result));
});

const getMyLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.getMyLeadInquiry(
    req.user!.id,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, inquiry));
});

const rescheduleMyLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.rescheduleMyLeadInquiry(
    req.user!.id,
    String(req.params.id),
    req.body as RescheduleInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Site visit rescheduled"));
});

const cancelMyLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.cancelMyLeadInquiry(
    req.user!.id,
    String(req.params.id),
    req.body as CancelInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Site visit cancelled"));
});

// --- Seller / organization side ---

const listManagedLeadInquiries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await leadInquiryService.listManagedLeadInquiries(
    requireSellerContext(req),
    query(req)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getManagedLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.getManagedLeadInquiry(
    requireSellerContext(req),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, inquiry));
});

const getManagedStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await leadInquiryService.getManagedStats(
    requireSellerContext(req),
    query(req)
  );
  res.status(200).json(new ApiResponse(200, stats));
});

const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.updateStatus(
    req.user!.id,
    requireSellerContext(req),
    String(req.params.id),
    req.body as UpdateStatusInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Lead status updated"));
});

const addComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.addComment(
    req.user!.id,
    requireSellerContext(req),
    String(req.params.id),
    req.body as AddCommentInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Comment added"));
});

const assignLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.assignLeadInquiry(
    req.user!.id,
    requireSellerContext(req),
    String(req.params.id),
    req.body as AssignInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Lead assignment updated"));
});

const rescheduleManagedLeadInquiry = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const inquiry = await leadInquiryService.rescheduleManagedLeadInquiry(
      req.user!.id,
      requireSellerContext(req),
      String(req.params.id),
      req.body as RescheduleInput
    );
    res.status(200).json(new ApiResponse(200, inquiry, "Site visit rescheduled"));
  }
);

const cancelManagedLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const inquiry = await leadInquiryService.cancelManagedLeadInquiry(
    req.user!.id,
    requireSellerContext(req),
    String(req.params.id),
    req.body as CancelInput
  );
  res.status(200).json(new ApiResponse(200, inquiry, "Site visit cancelled"));
});

const deleteLeadInquiry = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await leadInquiryService.deleteLeadInquiry(
    requireSellerContext(req),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createGeneralLead,
  createOrganizationInquiry,
  createSiteVisit,
  listMyLeadInquiries,
  getMyLeadInquiry,
  rescheduleMyLeadInquiry,
  cancelMyLeadInquiry,
  listManagedLeadInquiries,
  getManagedLeadInquiry,
  getManagedStats,
  updateStatus,
  addComment,
  assignLeadInquiry,
  rescheduleManagedLeadInquiry,
  cancelManagedLeadInquiry,
  deleteLeadInquiry,
};
