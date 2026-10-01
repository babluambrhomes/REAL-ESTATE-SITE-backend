import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { ownedPropertyWhere, ownedPropertyRelation } from "../../helpers";
import { SellerContext } from "../../types";
import {
  CreateFaqInput,
  UpdateFaqInput,
  ReorderFaqsInput,
} from "./propertyFaq.validation";

const faqSelect = {
  id: true,
  propertyId: true,
  question: true,
  answer: true,
  displayOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// Seller ka apna property hona chahiye — dusre ka nahi.
// 404 (403 nahi) taaki property exist karta hai ya nahi, ye leak na ho.
const ensureOwnProperty = async (ctx: SellerContext, propertyId: string) => {
  const property = await prisma.property.findFirst({
    where: { ...ownedPropertyWhere(ctx), id: propertyId },
    select: { id: true, title: true, slug: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  return property;
};

// FAQ id se ownership check — nested relation se, extra query nahi lagti
const findOwnFaq = async (ctx: SellerContext, id: string) => {
  const faq = await prisma.propertyFaq.findFirst({
    where: { id, property: ownedPropertyRelation(ctx) },
    select: faqSelect,
  });

  if (!faq) {
    throw new ApiError(404, "FAQ not found");
  }

  return faq;
};

// Naye FAQ ko end me rakhta hai — max order + 1
const nextDisplayOrder = async (propertyId: string) => {
  const last = await prisma.propertyFaq.findFirst({
    where: { propertyId },
    orderBy: { displayOrder: "desc" },
    select: { displayOrder: true },
  });

  return (last?.displayOrder ?? 0) + 1;
};

const createFaq = async (ctx: SellerContext, data: CreateFaqInput) => {
  const property = await ensureOwnProperty(ctx, data.propertyId);

  const displayOrder =
    data.displayOrder ?? (await nextDisplayOrder(property.id));

  return prisma.propertyFaq.create({
    data: {
      propertyId: property.id,
      question: data.question,
      answer: data.answer,
      displayOrder,
      isActive: data.isActive ?? true,
    },
    select: faqSelect,
  });
};

// Management view: active + inactive dono, order me
const listFaqs = async (ctx: SellerContext, propertyId: string) => {
  const property = await ensureOwnProperty(ctx, propertyId);

  const faqs = await prisma.propertyFaq.findMany({
    where: { propertyId: property.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: faqSelect,
  });

  return { property, data: faqs, total: faqs.length };
};

const getFaq = async (ctx: SellerContext, id: string) => {
  return findOwnFaq(ctx, id);
};

const updateFaq = async (ctx: SellerContext, id: string, data: UpdateFaqInput) => {
  const faq = await findOwnFaq(ctx, id);

  return prisma.propertyFaq.update({
    where: { id: faq.id },
    data,
    select: faqSelect,
  });
};

const deleteFaq = async (ctx: SellerContext, id: string) => {
  const faq = await findOwnFaq(ctx, id);

  await prisma.propertyFaq.delete({ where: { id: faq.id } });

  return { message: "FAQ deleted" };
};

// Poore property ka order ek saath update — saare ids verify karte hain
// taaki koi aur property ka FAQ id mix na ho jaye
const reorderFaqs = async (ctx: SellerContext, data: ReorderFaqsInput) => {
  const property = await ensureOwnProperty(ctx, data.propertyId);

  const ids = data.faqs.map((f) => f.id);
  const count = await prisma.propertyFaq.count({
    where: { id: { in: ids }, propertyId: property.id },
  });

  if (count !== new Set(ids).size) {
    throw new ApiError(400, "Some FAQs do not belong to this property");
  }

  await prisma.$transaction(
    data.faqs.map((f) =>
      prisma.propertyFaq.update({
        where: { id: f.id },
        data: { displayOrder: f.displayOrder },
      })
    )
  );

  const faqs = await prisma.propertyFaq.findMany({
    where: { propertyId: property.id },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: faqSelect,
  });

  return { message: "FAQ order updated", data: faqs, total: faqs.length };
};

export {
  createFaq,
  listFaqs,
  getFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
};
