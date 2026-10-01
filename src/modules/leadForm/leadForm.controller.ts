import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import {
  CreateLeadInput,
  UpdateLeadStatusInput,
  UpdateLeadCommentInput,
  ListLeadsQueryInput,
} from "./leadForm.validation";
import * as leadFormService from "./leadForm.service";

// --- Buyer: kisi bhi action se lead create (login mandatory, rate-limited) ---
const createLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await leadFormService.createLead(req.user!.id, req.body as CreateLeadInput);
  res.status(201).json(new ApiResponse(201, lead, "Lead created"));
});

// --- Seller: apne leads manage kare ---

const listLeads = asyncHandler(async (req: AuthRequest, res: Response) => {
  const leads = await leadFormService.listLeads(
    requireSellerContext(req).sellerId,
    (req as any).validatedQuery as ListLeadsQueryInput
  );
  res.status(200).json(new ApiResponse(200, leads));
});

const getLeadStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await leadFormService.getLeadStats(requireSellerContext(req).sellerId);
  res.status(200).json(new ApiResponse(200, stats));
});

const getLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await leadFormService.getLead(requireSellerContext(req).sellerId, String(req.params.id));
  res.status(200).json(new ApiResponse(200, lead));
});

const updateLeadStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await leadFormService.updateLeadStatus(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    req.body as UpdateLeadStatusInput
  );
  res.status(200).json(new ApiResponse(200, lead, "Lead status updated"));
});

const updateLeadComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const lead = await leadFormService.updateLeadComment(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    (req.body as UpdateLeadCommentInput).comment
  );
  res.status(200).json(new ApiResponse(200, lead, "Comment updated"));
});

const deleteLead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await leadFormService.deleteLead(requireSellerContext(req).sellerId, String(req.params.id));
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createLead,
  listLeads,
  getLeadStats,
  getLead,
  updateLeadStatus,
  updateLeadComment,
  deleteLead,
};