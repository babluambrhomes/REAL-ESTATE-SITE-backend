import { Router } from "express";
import {
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
} from "./buyerQuestion.controller";
import {
  protect,
  checkSeller,
  checkSellerVerified,
  checkSellerPermission,
  validate,
  parseQuery,
  buyerQuestionRateLimit,
} from "../../middlewares";
import {
  createBuyerQuestionSchema,
  updateBuyerQuestionSchema,
  answerBuyerQuestionSchema,
  updateBuyerQuestionStatusSchema,
  listBuyerQuestionsQuerySchema,
  buyerQuestionIdParamsSchema,
} from "./buyerQuestion.validation";

const validateId = validate(buyerQuestionIdParamsSchema, "params");

const router = Router();

// --- Buyer: seller ko sawal bheje (login compulsory + per-user rate limit) ---
router.post("/", protect, buyerQuestionRateLimit, validate(createBuyerQuestionSchema), createQuestion);

// --- Buyer: apne sawaal (dashboard) ---
const me = Router();
me.use(protect);

me.get("/", parseQuery(listBuyerQuestionsQuerySchema), listMyQuestions);
me.get("/:id", validateId, getMyQuestion);
me.patch("/:id", validateId, validate(updateBuyerQuestionSchema), updateMyQuestion);
me.delete("/:id", validateId, deleteMyQuestion);

router.use("/me", me);

// --- Seller: aaye sawaal manage kare (reads for any seller, writes need verified) ---
const seller = Router();
seller.use(protect);
seller.use(checkSeller);

const canReadQuestion = checkSellerPermission("buyerQuestion:read");
const canAnswerQuestion = checkSellerPermission("buyerQuestion:answer");
const canDeleteQuestion = checkSellerPermission("buyerQuestion:delete");

seller.get("/", canReadQuestion, parseQuery(listBuyerQuestionsQuerySchema), listSellerQuestions);
seller.get("/stats", canReadQuestion, getSellerStats);
seller.get("/:id", canReadQuestion, validateId, getSellerQuestion);
seller.patch("/:id/answer", checkSellerVerified, canAnswerQuestion, validateId, validate(answerBuyerQuestionSchema), answerSellerQuestion);
seller.patch("/:id/status", checkSellerVerified, canAnswerQuestion, validateId, validate(updateBuyerQuestionStatusSchema), updateSellerQuestionStatus);
seller.delete("/:id", checkSellerVerified, canDeleteQuestion, validateId, deleteSellerQuestion);

router.use("/seller", seller);

export default router;