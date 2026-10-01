import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import {
  BookSiteVisitInput,
  UpdateSiteVisitStatusInput,
  RescheduleSiteVisitInput,
  UpdateSiteVisitCommentInput,
  CancelSiteVisitInput,
  ListSiteVisitsQueryInput,
} from "./siteVisit.validation";
import * as siteVisitService from "./siteVisit.service";

const bookSiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.bookSiteVisit(
    req.user!.id,
    req.body as BookSiteVisitInput
  );
  res.status(201).json(new ApiResponse(201, visit, "Site visit booked successfully"));
});

const listMySiteVisits = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visits = await siteVisitService.listMySiteVisits(
    req.user!.id,
    (req as any).validatedQuery as ListSiteVisitsQueryInput
  );
  res.status(200).json(new ApiResponse(200, visits));
});

const getMySiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.getSiteVisit(
    { userId: req.user!.id },
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, visit));
});

const rescheduleMySiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.rescheduleSiteVisit(
    { userId: req.user!.id },
    String(req.params.id),
    req.body as RescheduleSiteVisitInput
  );
  res.status(200).json(new ApiResponse(200, visit, "Site visit rescheduled successfully"));
});

const cancelMySiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.cancelMySiteVisit(
    req.user!.id,
    String(req.params.id),
    (req.body as CancelSiteVisitInput).reason
  );
  res.status(200).json(new ApiResponse(200, visit, "Site visit cancelled successfully"));
});

// --- Seller side ---

const listSellerSiteVisits = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visits = await siteVisitService.listSellerSiteVisits(
    requireSellerContext(req).sellerId,
    (req as any).validatedQuery as ListSiteVisitsQueryInput
  );
  res.status(200).json(new ApiResponse(200, visits));
});

const getSellerSiteVisitStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await siteVisitService.getSellerSiteVisitStats(requireSellerContext(req).sellerId);
  res.status(200).json(new ApiResponse(200, stats));
});

const getSellerSiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.getSiteVisit(
    { sellerId: requireSellerContext(req).sellerId },
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, visit));
});

const updateSiteVisitStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.updateStatus(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    req.body as UpdateSiteVisitStatusInput
  );
  res.status(200).json(new ApiResponse(200, visit, "Site visit status updated"));
});

const rescheduleSellerSiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.rescheduleSiteVisit(
    { sellerId: requireSellerContext(req).sellerId },
    String(req.params.id),
    req.body as RescheduleSiteVisitInput
  );
  res.status(200).json(new ApiResponse(200, visit, "Site visit rescheduled successfully"));
});

const updateSiteVisitComment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const visit = await siteVisitService.updateComment(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    (req.body as UpdateSiteVisitCommentInput).comment
  );
  res.status(200).json(new ApiResponse(200, visit, "Comment updated"));
});

const deleteSiteVisit = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await siteVisitService.deleteSiteVisit(
    requireSellerContext(req).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  bookSiteVisit,
  listMySiteVisits,
  getMySiteVisit,
  rescheduleMySiteVisit,
  cancelMySiteVisit,
  listSellerSiteVisits,
  getSellerSiteVisitStats,
  getSellerSiteVisit,
  updateSiteVisitStatus,
  rescheduleSellerSiteVisit,
  updateSiteVisitComment,
  deleteSiteVisit,
};
