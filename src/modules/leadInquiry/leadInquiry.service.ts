import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { buildPagination, getPaginationParams } from "../../helpers";
import {
  appendComment,
  buildActivity,
  pushRecentActivity,
  VISIT_DURATION_MS,
} from "../../helpers/leadInquiry.helper";
import type { Prisma } from "../../generated/prisma/client";
import {
  LeadSource,
  LeadType,
  MemberStatus,
  SellerStatus,
  SellerType,
} from "../../generated/prisma/enums";
import type { SellerContext } from "../../types";
import {
  allStatuses,
  allowedStatusesForType,
  inquirySources,
  inquiryTypes,
  type AddCommentInput,
  type AssignInput,
  type CancelInput,
  type CreateGeneralLeadInput,
  type CreateOrganizationInquiryInput,
  type CreateSiteVisitInput,
  type ListLeadInquiriesQueryInput,
  type RescheduleInput,
  type UpdateStatusInput,
} from "./leadInquiry.validation";

const leadInquiryDetailSelect = {
  id: true,
  type: true,
  source: true,
  status: true,
  userId: true,
  sellerId: true,
  organizationId: true,
  propertyId: true,
  assignedToMemberId: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  comments: true,
  recentActivity: true,
  budgetRange: true,
  preferredProject: true,
  termsAccepted: true,
  termsAcceptedAt: true,
  visitDate: true,
  startTime: true,
  endTime: true,
  userAddress: true,
  confirmedAt: true,
  cancelledAt: true,
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
  organization: {
    select: { id: true, name: true },
  },
  property: {
    select: { id: true, title: true, slug: true, propertyCode: true, city: true },
  },
  assignedToMember: {
    select: {
      id: true,
      status: true,
      role: { select: { id: true, roleName: true } },
      user: {
        select: {
          id: true,
          person: {
            select: { firstName: true, lastName: true, avatarUrl: true },
          },
        },
      },
    },
  },
} as const;

type LeadInquiryRow = Prisma.LeadInquiryGetPayload<{ select: typeof leadInquiryDetailSelect }>;

// --- mapping / scope ---

const mapLeadInquiry = (row: LeadInquiryRow) => {
  const s = row.seller;
  const seller = s
    ? {
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
      }
    : null;

  const user = row.user
    ? {
        id: row.user.id,
        name:
          [row.user.person?.firstName, row.user.person?.lastName].filter(Boolean).join(" ") ||
          row.name,
        email: row.email ?? row.user.email,
        phone: row.phone ?? row.user.phone,
        avatarUrl: row.user.person?.avatarUrl ?? null,
      }
    : null;

  return { ...row, seller, user };
};

const managedScope = (ctx: SellerContext): Prisma.LeadInquiryWhereInput =>
  ctx.organizationId
    ? { organizationId: ctx.organizationId }
    : { sellerId: ctx.sellerId, organizationId: null };

const buildWhere = (
  base: Prisma.LeadInquiryWhereInput,
  query: ListLeadInquiriesQueryInput
): Prisma.LeadInquiryWhereInput => {
  const where: Prisma.LeadInquiryWhereInput = { ...base };

  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.source) where.source = query.source;
  if (query.propertyId) where.propertyId = query.propertyId;
  if (query.assignedToMemberId) where.assignedToMemberId = query.assignedToMemberId;

  const startTime: Prisma.DateTimeNullableFilter = {};
  if (query.from) startTime.gte = query.from;
  if (query.to) startTime.lte = query.to;
  if (query.upcoming) startTime.gte = new Date();
  if (Object.keys(startTime).length) where.startTime = startTime;

  return where;
};

const findScoped = async (scope: Prisma.LeadInquiryWhereInput, id: string) => {
  const row = await prisma.leadInquiry.findFirst({
    where: { id, ...scope },
    select: { id: true, type: true, status: true },
  });

  if (!row) {
    throw new ApiError(404, "Lead inquiry not found");
  }

  return row;
};

// --- contact + attribution ---

const buildAddress = (
  person: {
    addressLine?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
    pincode?: string | null;
  } | null
): string | null => {
  if (!person) return null;

  const parts = [person.addressLine, person.city, person.state, person.pincode, person.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
};

const resolveBuyer = async (
  userId: string,
  data: { name?: string; email?: string; phone?: string }
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      phone: true,
      person: {
        select: {
          firstName: true,
          lastName: true,
          addressLine: true,
          city: true,
          state: true,
          country: true,
          pincode: true,
        },
      },
    },
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const name =
    data.name ||
    [user.person?.firstName, user.person?.lastName].filter(Boolean).join(" ").trim();
  const phone = data.phone || user.phone;
  const email = data.email || user.email || null;

  if (!name) {
    throw new ApiError(400, "Name is required");
  }
  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  return {
    name,
    email,
    phone,
    address: buildAddress(user.person),
  };
};

const resolveTargets = async (data: {
  sellerId?: string;
  organizationId?: string;
  propertyId?: string;
}): Promise<{ sellerId: string | null; organizationId: string | null }> => {
  if (data.propertyId) {
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
      select: {
        organizationId: true,
        organization: { select: { sellerProfile: { select: { id: true } } } },
        user: { select: { sellerProfile: { select: { id: true } } } },
      },
    });

    if (!property) {
      throw new ApiError(404, "Property not found");
    }

    const derivedOrganizationId = property.organizationId ?? null;
    const derivedSellerId = derivedOrganizationId
      ? (property.organization?.sellerProfile?.id ?? null)
      : (property.user?.sellerProfile?.id ?? null);

    if (data.organizationId && data.organizationId !== derivedOrganizationId) {
      throw new ApiError(400, "organizationId does not match the property");
    }
    if (data.sellerId && derivedSellerId && data.sellerId !== derivedSellerId) {
      throw new ApiError(400, "sellerId does not match the property");
    }

    return {
      sellerId: data.sellerId ?? derivedSellerId,
      organizationId: data.organizationId ?? derivedOrganizationId,
    };
  }

  if (data.sellerId) {
    const seller = await prisma.sellerProfile.findFirst({
      where: { id: data.sellerId, sellerStatus: SellerStatus.ACTIVE },
      select: { id: true },
    });

    if (!seller) {
      throw new ApiError(404, "Seller not found");
    }
  }

  if (data.organizationId) {
    const organization = await prisma.organization.findUnique({
      where: { id: data.organizationId },
      select: { id: true },
    });

    if (!organization) {
      throw new ApiError(404, "Organization not found");
    }
  }

  return {
    sellerId: data.sellerId ?? null,
    organizationId: data.organizationId ?? null,
  };
};

// --- create ---

const createGeneralLead = async (userId: string, data: CreateGeneralLeadInput) => {
  const buyer = await resolveBuyer(userId, data);
  const targets = await resolveTargets(data);

  return mapLeadInquiry(
    await prisma.leadInquiry.create({
      data: {
        type: LeadType.GENERAL,
        source: data.source ?? LeadSource.ENQUIRY_FORM,
        status: "NEW",
        userId,
        sellerId: targets.sellerId,
        organizationId: targets.organizationId,
        propertyId: data.propertyId ?? null,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        message: data.message ?? null,
        recentActivity: [
          buildActivity({ action: "CREATED", byUserId: userId }),
        ] as unknown as Prisma.InputJsonValue,
      },
      select: leadInquiryDetailSelect,
    })
  );
};

const createOrganizationInquiry = async (
  userId: string,
  data: CreateOrganizationInquiryInput
) => {
  const organization = await prisma.organization.findUnique({
    where: { id: data.organizationId },
    select: { id: true, sellerProfile: { select: { id: true } } },
  });

  if (!organization) {
    throw new ApiError(404, "Organization not found");
  }

  const buyer = await resolveBuyer(userId, data);
  const now = new Date();

  return mapLeadInquiry(
    await prisma.leadInquiry.create({
      data: {
        type: LeadType.ORGANIZATION_INQUIRY,
        source: LeadSource.CONTACT,
        status: "NEW",
        userId,
        organizationId: organization.id,
        sellerId: organization.sellerProfile?.id ?? null,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        message: data.message ?? null,
        budgetRange: data.budgetRange ?? null,
        preferredProject: data.preferredProject ?? null,
        termsAccepted: true,
        termsAcceptedAt: now,
        recentActivity: [
          buildActivity({ action: "CREATED", byUserId: userId }),
        ] as unknown as Prisma.InputJsonValue,
      },
      select: leadInquiryDetailSelect,
    })
  );
};

const createSiteVisit = async (userId: string, data: CreateSiteVisitInput) => {
  const buyer = await resolveBuyer(userId, data);
  const targets = await resolveTargets(data);

  const startTime = data.startTime;
  const endTime = data.endTime ?? new Date(startTime.getTime() + VISIT_DURATION_MS);

  return mapLeadInquiry(
    await prisma.leadInquiry.create({
      data: {
        type: LeadType.SITE_VISIT,
        source: data.source ?? LeadSource.ENQUIRY_FORM,
        status: "NEW",
        userId,
        sellerId: targets.sellerId,
        organizationId: targets.organizationId,
        propertyId: data.propertyId ?? null,
        name: buyer.name,
        email: buyer.email,
        phone: buyer.phone,
        message: data.message ?? null,
        userAddress: data.userAddress?.trim() || buyer.address,
        visitDate: data.visitDate,
        startTime,
        endTime,
        recentActivity: [
          buildActivity({ action: "CREATED", byUserId: userId }),
        ] as unknown as Prisma.InputJsonValue,
      },
      select: leadInquiryDetailSelect,
    })
  );
};

// --- read ---

const listMyLeadInquiries = async (userId: string, query: ListLeadInquiriesQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);
  const where = buildWhere({ userId }, query);

  const [rows, total] = await Promise.all([
    prisma.leadInquiry.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: leadInquiryDetailSelect,
    }),
    prisma.leadInquiry.count({ where }),
  ]);

  return {
    data: rows.map(mapLeadInquiry),
    ...buildPagination(total, page, limit),
  };
};

const getMyLeadInquiry = async (userId: string, id: string) => {
  const row = await prisma.leadInquiry.findFirst({
    where: { id, userId },
    select: leadInquiryDetailSelect,
  });

  if (!row) {
    throw new ApiError(404, "Lead inquiry not found");
  }

  return mapLeadInquiry(row);
};

const listManagedLeadInquiries = async (
  ctx: SellerContext,
  query: ListLeadInquiriesQueryInput
) => {
  const { skip, take, page, limit } = getPaginationParams(query);
  const where = buildWhere(managedScope(ctx), query);

  const [rows, total] = await Promise.all([
    prisma.leadInquiry.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: leadInquiryDetailSelect,
    }),
    prisma.leadInquiry.count({ where }),
  ]);

  return {
    data: rows.map(mapLeadInquiry),
    ...buildPagination(total, page, limit),
  };
};

const getManagedLeadInquiry = async (ctx: SellerContext, id: string) => {
  const row = await prisma.leadInquiry.findFirst({
    where: { id, ...managedScope(ctx) },
    select: leadInquiryDetailSelect,
  });

  if (!row) {
    throw new ApiError(404, "Lead inquiry not found");
  }

  return mapLeadInquiry(row);
};

const getManagedStats = async (
  ctx: SellerContext,
  query: ListLeadInquiriesQueryInput
) => {
  const scope = managedScope(ctx);
  const where = buildWhere(scope, query);

  const [byStatusGroup, bySourceGroup, byTypeGroup, upcoming] = await Promise.all([
    prisma.leadInquiry.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.leadInquiry.groupBy({ by: ["source"], where, _count: { _all: true } }),
    prisma.leadInquiry.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.leadInquiry.count({
      where: {
        ...scope,
        type: LeadType.SITE_VISIT,
        status: { in: ["NEW", "CONFIRMED", "RESCHEDULED"] },
        startTime: { gte: new Date() },
      },
    }),
  ]);

  const statusCounts = byStatusGroup.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});
  const sourceCounts = bySourceGroup.reduce<Record<string, number>>((acc, row) => {
    acc[row.source] = row._count._all;
    return acc;
  }, {});
  const typeCounts = byTypeGroup.reduce<Record<string, number>>((acc, row) => {
    acc[row.type] = row._count._all;
    return acc;
  }, {});

  const byStatus = allStatuses.map((status) => ({
    status,
    count: statusCounts[status] ?? 0,
  }));
  const bySource = inquirySources.map((source) => ({
    source,
    count: sourceCounts[source] ?? 0,
  }));
  const byType = inquiryTypes.map((type) => ({
    type,
    count: typeCounts[type] ?? 0,
  }));

  const total = byType.reduce((sum, row) => sum + row.count, 0);

  return { total, upcoming, byStatus, bySource, byType };
};

// --- mutations ---

const statusTimestamps = (status: string) => {
  const now = new Date();
  switch (status) {
    case "CONFIRMED":
    case "COMPLETED":
      return { confirmedAt: now, cancelledAt: null };
    case "CANCELLED":
      return { confirmedAt: null, cancelledAt: now };
    default:
      return { confirmedAt: null, cancelledAt: null };
  }
};

const updateStatus = async (
  actorId: string,
  ctx: SellerContext,
  id: string,
  data: UpdateStatusInput
) => {
  const existing = await findScoped(managedScope(ctx), id);
  const allowed = allowedStatusesForType(existing.type);

  if (!allowed.includes(data.status)) {
    throw new ApiError(400, `Invalid status for ${existing.type}`);
  }

  return prisma.$transaction(async (tx) => {
    await tx.leadInquiry.update({
      where: { id },
      data: {
        status: data.status,
        ...(existing.type === LeadType.SITE_VISIT ? statusTimestamps(data.status) : {}),
        ...(data.comment ? { comments: { push: data.comment } } : {}),
      },
    });

    await pushRecentActivity(
      tx,
      id,
      buildActivity({
        action: "STATUS_CHANGED",
        byUserId: actorId,
        from: existing.status,
        to: data.status,
        note: data.comment ?? null,
      })
    );

    if (data.comment) {
      await pushRecentActivity(
        tx,
        id,
        buildActivity({
          action: "COMMENT_ADDED",
          byUserId: actorId,
          note: data.comment,
        })
      );
    }

    const row = await tx.leadInquiry.findUniqueOrThrow({
      where: { id },
      select: leadInquiryDetailSelect,
    });

    return mapLeadInquiry(row);
  });
};

const addComment = async (
  actorId: string,
  ctx: SellerContext,
  id: string,
  data: AddCommentInput
) => {
  await findScoped(managedScope(ctx), id);

  return prisma.$transaction(async (tx) => {
    await appendComment(tx, id, data.comment);

    await pushRecentActivity(
      tx,
      id,
      buildActivity({
        action: "COMMENT_ADDED",
        byUserId: actorId,
        note: data.comment,
      })
    );

    const row = await tx.leadInquiry.findUniqueOrThrow({
      where: { id },
      select: leadInquiryDetailSelect,
    });

    return mapLeadInquiry(row);
  });
};

const assignLeadInquiry = async (
  actorId: string,
  ctx: SellerContext,
  id: string,
  data: AssignInput
) => {
  if (!ctx.organizationId) {
    throw new ApiError(400, "Assignment is only available for organization leads");
  }

  await findScoped(managedScope(ctx), id);

  if (data.memberId) {
    const member = await prisma.member.findFirst({
      where: {
        id: data.memberId,
        status: MemberStatus.ACTIVE,
        contextId: ctx.organizationId,
      },
      select: { id: true },
    });

    if (!member) {
      throw new ApiError(400, "Member not found in this organization");
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.leadInquiry.update({
      where: { id },
      data: { assignedToMemberId: data.memberId },
    });

    await pushRecentActivity(
      tx,
      id,
      buildActivity({
        action: "ASSIGNED",
        byUserId: actorId,
        note: data.memberId ? `Assigned to member ${data.memberId}` : "Unassigned",
      })
    );

    const row = await tx.leadInquiry.findUniqueOrThrow({
      where: { id },
      select: leadInquiryDetailSelect,
    });

    return mapLeadInquiry(row);
  });
};

const reschedule = async (
  scope: Prisma.LeadInquiryWhereInput,
  actorId: string,
  id: string,
  data: RescheduleInput
) => {
  const existing = await findScoped(scope, id);

  if (existing.type !== LeadType.SITE_VISIT) {
    throw new ApiError(400, "Only site visits can be rescheduled");
  }

  const startTime = data.startTime;
  const endTime = data.endTime ?? new Date(startTime.getTime() + VISIT_DURATION_MS);

  return prisma.$transaction(async (tx) => {
    await tx.leadInquiry.update({
      where: { id },
      data: {
        visitDate: data.visitDate,
        startTime,
        endTime,
        status: "RESCHEDULED",
        ...statusTimestamps("RESCHEDULED"),
        ...(data.comment ? { comments: { push: data.comment } } : {}),
      },
    });

    await pushRecentActivity(
      tx,
      id,
      buildActivity({
        action: "RESCHEDULED",
        byUserId: actorId,
        note: data.comment ?? null,
      })
    );

    const row = await tx.leadInquiry.findUniqueOrThrow({
      where: { id },
      select: leadInquiryDetailSelect,
    });

    return mapLeadInquiry(row);
  });
};

const rescheduleMyLeadInquiry = async (
  userId: string,
  id: string,
  data: RescheduleInput
) => reschedule({ userId }, userId, id, data);

const rescheduleManagedLeadInquiry = async (
  actorId: string,
  ctx: SellerContext,
  id: string,
  data: RescheduleInput
) => reschedule(managedScope(ctx), actorId, id, data);

const cancel = async (
  scope: Prisma.LeadInquiryWhereInput,
  actorId: string,
  id: string,
  data: CancelInput
) => {
  const existing = await findScoped(scope, id);

  if (existing.type !== LeadType.SITE_VISIT) {
    throw new ApiError(400, "Only site visits can be cancelled");
  }

  return prisma.$transaction(async (tx) => {
    await tx.leadInquiry.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...statusTimestamps("CANCELLED"),
        ...(data.reason ? { comments: { push: data.reason } } : {}),
      },
    });

    await pushRecentActivity(
      tx,
      id,
      buildActivity({
        action: "CANCELLED",
        byUserId: actorId,
        from: existing.status,
        to: "CANCELLED",
        note: data.reason ?? null,
      })
    );

    const row = await tx.leadInquiry.findUniqueOrThrow({
      where: { id },
      select: leadInquiryDetailSelect,
    });

    return mapLeadInquiry(row);
  });
};

const cancelMyLeadInquiry = async (userId: string, id: string, data: CancelInput) =>
  cancel({ userId }, userId, id, data);

const cancelManagedLeadInquiry = async (
  actorId: string,
  ctx: SellerContext,
  id: string,
  data: CancelInput
) => cancel(managedScope(ctx), actorId, id, data);

const deleteLeadInquiry = async (ctx: SellerContext, id: string) => {
  await findScoped(managedScope(ctx), id);
  await prisma.leadInquiry.delete({ where: { id } });

  return { message: "Lead inquiry deleted" };
};

export {
  createGeneralLead,
  createOrganizationInquiry,
  createSiteVisit,
  listMyLeadInquiries,
  getMyLeadInquiry,
  listManagedLeadInquiries,
  getManagedLeadInquiry,
  getManagedStats,
  updateStatus,
  addComment,
  assignLeadInquiry,
  rescheduleMyLeadInquiry,
  rescheduleManagedLeadInquiry,
  cancelMyLeadInquiry,
  cancelManagedLeadInquiry,
  deleteLeadInquiry,
};
