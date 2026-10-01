import prisma from "../../config/prisma";
import { NOT_DELETED } from "../../helpers";
import { SellerStatus } from "../../generated/prisma/enums";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { SellerType } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  CreateBuyerQuestionInput,
  UpdateBuyerQuestionInput,
  AnswerBuyerQuestionInput,
  UpdateBuyerQuestionStatusInput,
  ListBuyerQuestionsQueryInput,
  buyerQuestionStatuses,
} from "./buyerQuestion.validation";

// Detail select dono side (buyer list + seller inbox) ke liye ek hi —
// buyer ko seller ka naam/logo dikhta hai, seller ko buyer ka contact
const buyerQuestionDetailSelect = {
  id: true,
  userId: true,
  sellerId: true,
  propertyId: true,
  question: true,
  answer: true,
  status: true,
  answeredAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      person: {
        select: { firstName: true, lastName: true, avatarUrl: true },
      },
    },
  },
  seller: {
    select: {
      id: true,
      slug: true,
      referenceCode: true,
      sellerType: true,
      logoUrl: true,
      organization: { select: { id: true, name: true } },
      user: {
        select: {
          person: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
    },
  },
  property: {
    select: { id: true, title: true, slug: true, propertyCode: true, city: true },
  },
} as const;

type BuyerQuestionRow = Prisma.BuyerQuestionGetPayload<{
  select: typeof buyerQuestionDetailSelect;
}>;

// Buyer/seller/property ko clean shape me deta hai (jaisa SiteVisit karta hai)
const mapBuyerQuestion = (row: BuyerQuestionRow) => {
  const s = row.seller;

  const seller = {
    id: s.id,
    slug: s.slug,
    referenceCode: s.referenceCode,
    sellerType: s.sellerType,
    name:
      s.sellerType === SellerType.ORGANIZATION
        ? (s.organization?.name ?? null)
        : [s.user?.person?.firstName, s.user?.person?.lastName].filter(Boolean).join(" ") ||
          null,
    image:
      s.sellerType === SellerType.ORGANIZATION
        ? s.logoUrl
        : (s.user?.person?.avatarUrl ?? s.logoUrl),
  };

  const buyer = row.user
    ? {
        id: row.user.id,
        name:
          [row.user.person?.firstName, row.user.person?.lastName].filter(Boolean).join(" ") ||
          "Buyer",
        email: row.user.email,
        phone: row.user.phone,
        avatarUrl: row.user.person?.avatarUrl ?? null,
      }
    : null;

  const property = row.property
    ? {
        id: row.property.id,
        title: row.property.title,
        slug: row.property.slug,
        propertyCode: row.property.propertyCode,
        city: row.property.city,
      }
    : null;

  return {
    ...row,
    seller,
    user: buyer,
    property,
  };
};

// --- Buyer side ---

// Buyer seller ko sawal bhejta hai (login compulsory, rate-limited)
const createQuestion = async (userId: string, data: CreateBuyerQuestionInput) => {
  const seller = await prisma.sellerProfile.findFirst({
    where: { id: data.sellerId, sellerStatus: SellerStatus.ACTIVE },
    select: { id: true, userId: true, organizationId: true, sellerType: true },
  });

  if (!seller) {
    throw new ApiError(404, "Seller not found");
  }

  // Property bheji hai to verify — wo usi selling entity ki honi chahiye.
  // Property ab SellerProfile se linked nahi hai, ownership user + org se
  // decide hoti hai, isliye yahi se resolve karna padta hai.
  if (data.propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: data.propertyId, ...NOT_DELETED },
      select: { id: true, userId: true, organizationId: true },
    });

    if (!property) {
      throw new ApiError(404, "Property not found");
    }

    const matches =
      seller.sellerType === "ORGANIZATION"
        ? property.organizationId === seller.organizationId
        : property.userId === seller.userId && property.organizationId === null;

    if (!matches) {
      throw new ApiError(400, "Property does not belong to this seller");
    }
  }

  const question = await prisma.buyerQuestion.create({
    data: {
      userId,
      sellerId: data.sellerId,
      propertyId: data.propertyId,
      question: data.question,
    },
    select: buyerQuestionDetailSelect,
  });

  return mapBuyerQuestion(question);
};

// Buyer ke apne saare sawaal (dashboard) — reply ke saath
const listMyQuestions = async (userId: string, query: ListBuyerQuestionsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.BuyerQuestionWhereInput = { userId };

  const [questions, total] = await Promise.all([
    prisma.buyerQuestion.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: buyerQuestionDetailSelect,
    }),
    prisma.buyerQuestion.count({ where }),
  ]);

  return {
    data: questions.map(mapBuyerQuestion),
    ...buildPagination(total, page, limit),
  };
};

// Ek sawal — buyer ko usi ka sawal, seller ko usi ka sawal (ownership-checked)
const getQuestion = async (scope: { userId?: string; sellerId?: string }, id: string) => {
  const question = await prisma.buyerQuestion.findFirst({
    where: { id, ...scope },
    select: buyerQuestionDetailSelect,
  });

  if (!question) {
    throw new ApiError(404, "Question not found");
  }

  return mapBuyerQuestion(question);
};

// Buyer apna sawal edit karta hai — sirf tab tak jab PENDING ho
const updateMyQuestion = async (
  userId: string,
  id: string,
  data: UpdateBuyerQuestionInput
) => {
  const existing = await prisma.buyerQuestion.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new ApiError(404, "Question not found");
  }

  if (existing.status !== "PENDING") {
    throw new ApiError(400, "Only pending questions can be edited");
  }

  const updated = await prisma.buyerQuestion.update({
    where: { id },
    data: { question: data.question },
    select: buyerQuestionDetailSelect,
  });

  return mapBuyerQuestion(updated);
};

// Buyer apna sawal delete karta hai — sirf PENDING me
const deleteMyQuestion = async (userId: string, id: string) => {
  const existing = await prisma.buyerQuestion.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new ApiError(404, "Question not found");
  }

  if (existing.status !== "PENDING") {
    throw new ApiError(400, "Only pending questions can be deleted");
  }

  await prisma.buyerQuestion.delete({ where: { id } });

  return { message: "Question deleted" };
};

// --- Seller side ---

// Seller ko aaye sawaal (inbox) — status/property filter + pagination
const listSellerQuestions = async (sellerId: string, query: ListBuyerQuestionsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.BuyerQuestionWhereInput = {
    sellerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };

  const [questions, total] = await Promise.all([
    prisma.buyerQuestion.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: buyerQuestionDetailSelect,
    }),
    prisma.buyerQuestion.count({ where }),
  ]);

  return {
    data: questions.map(mapBuyerQuestion),
    ...buildPagination(total, page, limit),
  };
};

// Seller ke sawaal ka status-wise breakdown
const getSellerStats = async (sellerId: string) => {
  const grouped = await prisma.buyerQuestion.groupBy({
    by: ["status"],
    where: { sellerId },
    _count: { _all: true },
  });

  const countByStatus = grouped.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const byStatus = buyerQuestionStatuses.map((status) => ({
    status,
    count: countByStatus[status] ?? 0,
  }));

  const total = byStatus.reduce((sum, s) => sum + s.count, 0);

  return { total, unanswered: countByStatus.PENDING ?? 0, byStatus };
};

// Seller jawab deta hai — status auto ANSWERED + answeredAt set
const answerQuestion = async (sellerId: string, id: string, data: AnswerBuyerQuestionInput) => {
  const existing = await prisma.buyerQuestion.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Question not found");
  }

  const updated = await prisma.buyerQuestion.update({
    where: { id },
    data: { answer: data.answer, status: "ANSWERED", answeredAt: new Date() },
    select: buyerQuestionDetailSelect,
  });

  return mapBuyerQuestion(updated);
};

// Seller status badalta hai (close/reopen/etc.)
const updateStatus = async (
  sellerId: string,
  id: string,
  data: UpdateBuyerQuestionStatusInput
) => {
  const existing = await prisma.buyerQuestion.findFirst({
    where: { id, sellerId },
    select: { id: true, answer: true },
  });

  if (!existing) {
    throw new ApiError(404, "Question not found");
  }

  if (data.status === "ANSWERED" && !existing.answer) {
    throw new ApiError(400, "Question must have an answer before marking as answered");
  }

  const updated = await prisma.buyerQuestion.update({
    where: { id },
    data: {
      status: data.status,
      answeredAt: data.status === "ANSWERED" ? new Date() : null,
    },
    select: buyerQuestionDetailSelect,
  });

  return mapBuyerQuestion(updated);
};

// Seller apna aaya sawal delete karta hai
const deleteSellerQuestion = async (sellerId: string, id: string) => {
  const existing = await prisma.buyerQuestion.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Question not found");
  }

  await prisma.buyerQuestion.delete({ where: { id } });

  return { message: "Question deleted" };
};

export {
  createQuestion,
  listMyQuestions,
  getQuestion,
  updateMyQuestion,
  deleteMyQuestion,
  listSellerQuestions,
  getSellerStats,
  answerQuestion,
  updateStatus,
  deleteSellerQuestion,
};