import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import {
  CreateFaqInput,
  UpdateFaqInput,
  ReorderFaqsInput,
} from "./propertyFaq.validation";
import * as propertyFaqService from "./propertyFaq.service";

const createFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await propertyFaqService.createFaq(
    requireSellerContext(req),
    req.body as CreateFaqInput
  );
  res.status(201).json(new ApiResponse(201, faq, "FAQ created"));
});

const listFaqs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyFaqService.listFaqs(
    requireSellerContext(req),
    String(req.query.propertyId)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const getFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await propertyFaqService.getFaq(requireSellerContext(req), String(req.params.id));
  res.status(200).json(new ApiResponse(200, faq));
});

const updateFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await propertyFaqService.updateFaq(
    requireSellerContext(req),
    String(req.params.id),
    req.body as UpdateFaqInput
  );
  res.status(200).json(new ApiResponse(200, faq, "FAQ updated"));
});

const deleteFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyFaqService.deleteFaq(
    requireSellerContext(req),
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result));
});

const reorderFaqs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await propertyFaqService.reorderFaqs(
    requireSellerContext(req),
    req.body as ReorderFaqsInput
  );
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createFaq,
  listFaqs,
  getFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
};
