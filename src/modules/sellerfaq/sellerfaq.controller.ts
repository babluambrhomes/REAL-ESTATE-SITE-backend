import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { CreateFaqInput, UpdateFaqInput } from "./sellerfaq.validation";
import * as sellerFaqService from "./sellerfaq.service";

const listFaqs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const faqs = await sellerFaqService.listFaqs((req as any).sellerId, page, limit);
  res.status(200).json(new ApiResponse(200, faqs));
});

const getFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await sellerFaqService.getFaq((req as any).sellerId, String(req.params.id));
  res.status(200).json(new ApiResponse(200, faq));
});

const createFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await sellerFaqService.createFaq(
    (req as any).sellerId,
    req.body as CreateFaqInput
  );
  res.status(201).json(new ApiResponse(201, faq, "FAQ created"));
});

const updateFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const faq = await sellerFaqService.updateFaq(
    (req as any).sellerId,
    String(req.params.id),
    req.body as UpdateFaqInput
  );
  res.status(200).json(new ApiResponse(200, faq, "FAQ updated"));
});

const deleteFaq = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await sellerFaqService.deleteFaq((req as any).sellerId, String(req.params.id));
  res.status(200).json(new ApiResponse(200, result));
});

export {
  listFaqs,
  getFaq,
  createFaq,
  updateFaq,
  deleteFaq,
};
