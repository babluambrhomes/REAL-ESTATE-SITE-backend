import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination, isRecordNotFound } from "../../helpers";
import { CreateFaqInput, UpdateFaqInput } from "./sellerfaq.validation";

const faqSelect = {
  id: true,
  sellerId: true,
  question: true,
  answer: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

const listFaqs = async (sellerId: string, page: number, limit: number) => {
  const { skip, take, page: p, limit: l } = getPaginationParams({ page, limit });

  const [faqs, total] = await Promise.all([
    prisma.sellerFaq.findMany({
      where: { sellerId },
      skip,
      take,
      orderBy: { displayOrder: "asc" },
      select: faqSelect,
    }),
    prisma.sellerFaq.count({ where: { sellerId } }),
  ]);

  return {
    data: faqs,
    ...buildPagination(total, p, l),
  };
};

const getFaq = async (sellerId: string, id: string) => {
  const faq = await prisma.sellerFaq.findFirst({
    where: { id, sellerId },
    select: faqSelect,
  });

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  return faq;
};

const createFaq = async (sellerId: string, data: CreateFaqInput) => {
  return prisma.sellerFaq.create({
    data: {
      sellerId,
      ...data,
    },
    select: faqSelect,
  });
};

const updateFaq = async (sellerId: string, id: string, data: UpdateFaqInput) => {
  try {
    return await prisma.sellerFaq.update({
      where: { id },
      data,
      select: faqSelect,
    });
  } catch (err) {
    if (isRecordNotFound(err)) {
      throw new ApiError(404, "FAQ not found");
    }
    throw err;
  }
};

const deleteFaq = async (sellerId: string, id: string) => {
  
  const faq = await prisma.sellerFaq.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  await prisma.sellerFaq.delete({ where: { id } });

  return { message: "FAQ deleted" };
};

export {
  listFaqs,
  getFaq,
  createFaq,
  updateFaq,
  deleteFaq,
};
