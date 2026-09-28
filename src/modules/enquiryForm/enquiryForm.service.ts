import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { EnquirySource, SellerType } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  SubmitEnquiryInput,
  UpdateEnquiryStatusInput,
  ListEnquiriesQueryInput,
} from "./enquiryForm.validation";

const enquiryDetailSelect = {
  id: true,
  sellerId: true,
  organizationId: true,
  userId: true,
  propertyId: true,
  source: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  comment: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      person: { select: { firstName: true, lastName: true, avatarUrl: true } },
    },
  },
  seller: {
    select: {
      id: true,
      slug: true,
      referenceCode: true,
      sellerType: true,
      logoUrl: true,
      user: {
        select: {
          person: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
      organization: { select: { id: true, name: true } },
    },
  },
  organization: {
    select: { id: true, name: true },
  },
  property: {
    select: { id: true, title: true, slug: true, propertyCode: true },
  },
} as const;

// Linked ids exist karte hain ya nahi — FK error se bachne ke liye
const ensureLinkExists = async (
  model: "sellerProfile" | "organization" | "property",
  id: string
) => {
  const exists =
    model === "sellerProfile"
      ? await prisma.sellerProfile.findFirst({ where: { id, deletedAt: null }, select: { id: true } })
      : await (prisma[model] as any).findUnique({ where: { id }, select: { id: true } });

  if (!exists) {
    const label = model === "sellerProfile" ? "Seller" : model === "organization" ? "Organization" : "Property";
    throw new ApiError(404, `${label} not found`);
  }
};

type EnquiryRow = Prisma.EnquiryFormGetPayload<{ select: typeof enquiryDetailSelect }>;

// Seller ke basic details (name + profile image) response me clean kar ke deta hai
const mapEnquiry = (row: EnquiryRow) => {
  const s = row.seller;
  const name = s
    ? s.sellerType === SellerType.ORGANIZATION
      ? (s.organization?.name ?? null)
      : [s.user?.person?.firstName, s.user?.person?.lastName].filter(Boolean).join(" ") || null
    : null;
  const image = s
    ? s.sellerType === SellerType.ORGANIZATION
      ? s.logoUrl
      : (s.user?.person?.avatarUrl ?? s.logoUrl)
    : null;

  return {
    ...row,
    seller: s
      ? {
          id: s.id,
          slug: s.slug,
          referenceCode: s.referenceCode,
          sellerType: s.sellerType,
          name,
          image,
        }
      : null,
  };
};

const submitEnquiry = async (userId: string | undefined, data: SubmitEnquiryInput) => {
  if (data.sellerId) {
    await ensureLinkExists("sellerProfile", data.sellerId);
  }
  if (data.organizationId) {
    await ensureLinkExists("organization", data.organizationId);
  }
  if (data.propertyId) {
    await ensureLinkExists("property", data.propertyId);
  }

  return mapEnquiry(
    await prisma.enquiryForm.create({
      data: {
        sellerId: data.sellerId ?? null,
        organizationId: data.organizationId ?? null,
        userId: userId ?? null,
        propertyId: data.propertyId ?? null,
        source: data.propertyId ? EnquirySource.PROPERTY : EnquirySource.SELLER_PROFILE,
        name: data.name,
        email: data.email,
        phone: data.phone ?? null,
        message: data.message ?? null,
      },
      select: enquiryDetailSelect,
    })
  );
};

const listEnquiries = async (sellerId: string, query: ListEnquiriesQueryInput) => {
  const { skip, take, page: p, limit: l } = getPaginationParams({
    page: query.page,
    limit: query.limit,
  });

  const where = {
    sellerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };

  const [enquiries, total] = await Promise.all([
    prisma.enquiryForm.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: enquiryDetailSelect,
    }),
    prisma.enquiryForm.count({ where }),
  ]);

  return {
    data: enquiries.map(mapEnquiry),
    ...buildPagination(total, p, l),
  };
};

const getEnquiryStats = async (sellerId: string) => {
  const grouped = await prisma.enquiryForm.groupBy({
    by: ["status"],
    where: { sellerId },
    _count: { _all: true },
  });

  const countByStatus = grouped.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const byStatus = [
    "NEW",
    "CONTACTED",
    "SITE_VISIT",
    "NEGOTIATION",
    "WON",
    "LOST",
  ].map((status) => ({
    status,
    count: countByStatus[status] ?? 0,
  }));

  const total = byStatus.reduce((sum, s) => sum + s.count, 0);

  return { total, byStatus };
};

const getEnquiry = async (sellerId: string, id: string) => {
  const enquiry = await prisma.enquiryForm.findFirst({
    where: { id, sellerId },
    select: enquiryDetailSelect,
  });

  if (!enquiry) {
    throw new ApiError(404, "Enquiry not found");
  }

  return mapEnquiry(enquiry);
};

const updateEnquiryStatus = async (
  sellerId: string,
  id: string,
  data: UpdateEnquiryStatusInput
) => {
  const existing = await prisma.enquiryForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Enquiry not found");
  }

  return mapEnquiry(
    await prisma.enquiryForm.update({
      where: { id },
      data: { status: data.status },
      select: enquiryDetailSelect,
    })
  );
};

const updateEnquiryComment = async (sellerId: string, id: string, comment: string) => {
  const existing = await prisma.enquiryForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Enquiry not found");
  }

  return mapEnquiry(
    await prisma.enquiryForm.update({
      where: { id },
      data: { comment },
      select: enquiryDetailSelect,
    })
  );
};

const deleteEnquiry = async (sellerId: string, id: string) => {
  const existing = await prisma.enquiryForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Enquiry not found");
  }

  await prisma.enquiryForm.delete({ where: { id } });

  return { message: "Enquiry deleted" };
};

export {
  submitEnquiry,
  listEnquiries,
  getEnquiryStats,
  getEnquiry,
  updateEnquiryStatus,
  updateEnquiryComment,
  deleteEnquiry,
};