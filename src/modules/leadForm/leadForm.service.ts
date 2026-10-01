import prisma from "../../config/prisma";
import { SellerStatus } from "../../generated/prisma/enums";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { LeadSource, SellerType } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  CreateLeadInput,
  UpdateLeadStatusInput,
  UpdateLeadCommentInput,
  ListLeadsQueryInput,
  leadStatuses,
  leadSources,
} from "./leadForm.validation";

const leadDetailSelect = {
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
      ? await prisma.sellerProfile.findFirst({ where: { id, sellerStatus: SellerStatus.ACTIVE }, select: { id: true } })
      : await (prisma[model] as any).findUnique({ where: { id }, select: { id: true } });

  if (!exists) {
    const label = model === "sellerProfile" ? "Seller" : model === "organization" ? "Organization" : "Property";
    throw new ApiError(404, `${label} not found`);
  }
};

type LeadRow = Prisma.LeadFormGetPayload<{ select: typeof leadDetailSelect }>;

// Seller ke basic details (name + profile image) response me clean kar ke deta hai
const mapLead = (row: LeadRow) => {
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

// Lead create — kisi bhi action (form/call/whatsapp/callback/contact) se aata hai.
// Login mandatory: name/phone profile se auto-fill hote hain, email optional.
const createLead = async (userId: string, data: CreateLeadInput) => {
  if (data.sellerId) {
    await ensureLinkExists("sellerProfile", data.sellerId);
  }
  if (data.organizationId) {
    await ensureLinkExists("organization", data.organizationId);
  }
  if (data.propertyId) {
    await ensureLinkExists("property", data.propertyId);
  }

  const source = data.source ?? LeadSource.ENQUIRY_FORM;

  // Profile se jaankari auto-fill (siteVisit jaisa pattern): request value → profile → required check
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      person: { select: { firstName: true, lastName: true } },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const name =
    data.name?.trim() ||
    [user.person?.firstName, user.person?.lastName].filter(Boolean).join(" ").trim() ||
    null;

  if (!name) {
    throw new ApiError(400, "Name is required for this lead");
  }

  const email = (data.email ?? user.email)?.trim() || null;
  const phone = (data.phone ?? user.phone)?.trim() || null;

  if (!phone) {
    throw new ApiError(400, "Phone number is required for this lead");
  }

  return mapLead(
    await prisma.leadForm.create({
      data: {
        sellerId: data.sellerId ?? null,
        organizationId: data.organizationId ?? null,
        propertyId: data.propertyId ?? null,
        userId,
        source,
        name,
        email,
        phone,
        message: data.message ?? null,
      },
      select: leadDetailSelect,
    })
  );
};

const listLeads = async (sellerId: string, query: ListLeadsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams({
    page: query.page,
    limit: query.limit,
  });

  const where: Prisma.LeadFormWhereInput = {
    sellerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
  };

  const [leads, total] = await Promise.all([
    prisma.leadForm.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: leadDetailSelect,
    }),
    prisma.leadForm.count({ where }),
  ]);

  return {
    data: leads.map(mapLead),
    ...buildPagination(total, page, limit),
  };
};

const getLeadStats = async (sellerId: string) => {
  const [byStatusGroup, bySourceGroup] = await Promise.all([
    prisma.leadForm.groupBy({
      by: ["status"],
      where: { sellerId },
      _count: { _all: true },
    }),
    prisma.leadForm.groupBy({
      by: ["source"],
      where: { sellerId },
      _count: { _all: true },
    }),
  ]);

  const statusCount = byStatusGroup.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const sourceCount = bySourceGroup.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = row._count._all;
    return acc;
  }, {});

  const byStatus = leadStatuses.map((status) => ({
    status,
    count: statusCount[status] ?? 0,
  }));

  const bySource = leadSources.map((source) => ({
    source,
    count: sourceCount[source] ?? 0,
  }));

  const total = byStatus.reduce((sum, s) => sum + s.count, 0);

  return { total, byStatus, bySource };
};

const getLead = async (sellerId: string, id: string) => {
  const lead = await prisma.leadForm.findFirst({
    where: { id, sellerId },
    select: leadDetailSelect,
  });

  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  return mapLead(lead);
};

const updateLeadStatus = async (sellerId: string, id: string, data: UpdateLeadStatusInput) => {
  const existing = await prisma.leadForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Lead not found");
  }

  return mapLead(
    await prisma.leadForm.update({
      where: { id },
      data: { status: data.status },
      select: leadDetailSelect,
    })
  );
};

const updateLeadComment = async (sellerId: string, id: string, comment: string) => {
  const existing = await prisma.leadForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Lead not found");
  }

  return mapLead(
    await prisma.leadForm.update({
      where: { id },
      data: { comment },
      select: leadDetailSelect,
    })
  );
};

const deleteLead = async (sellerId: string, id: string) => {
  const existing = await prisma.leadForm.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Lead not found");
  }

  await prisma.leadForm.delete({ where: { id } });

  return { message: "Lead deleted" };
};

export {
  createLead,
  listLeads,
  getLeadStats,
  getLead,
  updateLeadStatus,
  updateLeadComment,
  deleteLead,
};