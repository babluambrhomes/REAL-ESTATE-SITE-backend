import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import {
  CreateBuyerQuestionInput,
  UpdateBuyerQuestionInput,
  AnswerBuyerQuestionInput,
  UpdateBuyerQuestionStatusInput,
  ListBuyerQuestionsQueryInput,
} from "./buyerQuestion.validation";
import * as buyerQuestionService from "./buyerQuestion.service";

// --- Buyer side ---

const createQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.createQuestion(
    req.user!.id,
    req.body as CreateBuyerQuestionInput
  );
  res.status(201).json(new ApiResponse(201, question, "Question sent to seller"));
});

const listMyQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const questions = await buyerQuestionService.listMyQuestions(
    req.user!.id,
    (req as any).validatedQuery as ListBuyerQuestionsQueryInput
  );
  res.status(200).json(new ApiResponse(200, questions));
});

const getMyQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.getQuestion(
    { userId: req.user!.id },
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, question));
});

const updateMyQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.updateMyQuestion(
    req.user!.id,
    String(req.params.id),
    req.body as UpdateBuyerQuestionInput
  );
  res.status(200).json(new ApiResponse(200, question, "Question updated"));
});

const deleteMyQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await buyerQuestionService.deleteMyQuestion(req.user!.id, String(req.params.id));
  res.status(200).json(new ApiResponse(200, result, result.message));
});

// --- Seller side ---

const listSellerQuestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const questions = await buyerQuestionService.listSellerQuestions(
    requireSellerContext(req).sellerId,
    (req as any).validatedQuery as ListBuyerQuestionsQueryInput
  );
  res.status(200).json(new ApiResponse(200, questions));
});

const getSellerStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const stats = await buyerQuestionService.getSellerStats(requireSellerContext(req).sellerId);
  res.status(200).json(new ApiResponse(200, stats));
});

const getSellerQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.getQuestion(
    { sellerId: requireSellerContext(req).sellerId },
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, question));
});

const answerSellerQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.answerQuestion(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    req.body as AnswerBuyerQuestionInput
  );
  res.status(200).json(new ApiResponse(200, question, "Answer sent to buyer"));
});

const updateSellerQuestionStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const question = await buyerQuestionService.updateStatus(
    requireSellerContext(req).sellerId,
    String(req.params.id),
    req.body as UpdateBuyerQuestionStatusInput
  );
  res.status(200).json(new ApiResponse(200, question, "Question status updated"));
});

const deleteSellerQuestion = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await buyerQuestionService.deleteSellerQuestion(
    requireSellerContext(req).sellerId,
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, result.message));
});

export {
  createQuestion,
  listMyQuestions,
  getMyQuestion,
  updateMyQuestion,
  deleteMyQuestion,
  listSellerQuestions,
  getSellerStats,
  getSellerQuestion,
  answerSellerQuestion,
  updateSellerQuestionStatus,
  deleteSellerQuestion,
};