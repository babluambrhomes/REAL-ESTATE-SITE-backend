import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { SellerType } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  BookSiteVisitInput,
  UpdateSiteVisitStatusInput,
  RescheduleSiteVisitInput,
  ListSiteVisitsQueryInput,
  siteVisitStatuses,
  type SiteVisitStatusValue,
} from "./siteVisit.validation";

// Buyer koi bhi time book kar sakta hai, koi slot availability check nahi hai.
// Seller apne panel me visit confirm/reschedule/cancel karta hai.
// endTime nahi diya to default 60 min ka duration.
const DEFAULT_VISIT_MINUTES = 60;
const MS_PER_MINUTE = 60_000;

const siteVisitDetailSelect = {
  id: true,
  sellerId: true,
  organizationId: true,
  userId: true,
  propertyId: true,
  visitDate: true,
  startTime: true,
  endTime: true,
  name: true,
  email: true,
  phone: true,
  message: true,
  userAddress: true,
  comment: true,
  status: true,
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
} as const;

type SiteVisitRow = Prisma.SiteVisitGetPayload<{ select: typeof siteVisitDetailSelect }>;

// --- helpers ---

const ensureLinkExists = async (
  model: "sellerProfile" | "organization" | "property",
  id: string
) => {
  const exists =
    model === "sellerProfile"
      ? await prisma.sellerProfile.findFirst({
          where: { id, deletedAt: null },
          select: { id: true },
        })
      : await (prisma[model] as any).findUnique({ where: { id }, select: { id: true } });

  if (!exists) {
    const label =
      model === "sellerProfile" ? "Seller" : model === "organization" ? "Organization" : "Property";
    throw new ApiError(404, `${label} not found`);
  }
};

// Seller name/logo clean karke deta hai (organization vs individual)
const mapSiteVisit = (row: SiteVisitRow) => {
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
        image: s.sellerType === SellerType.ORGANIZATION ? s.logoUrl : (s.user?.person?.avatarUrl ?? s.logoUrl),
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

  return {
    ...row,
    seller,
    user,
  };
};

// Status change hote hi confirmedAt / cancelledAt dobara set hote hain,
// taaki dono timestamps hamesha current status ko reflect karein
const statusTimestamps = (status: SiteVisitStatusValue) => {
  const now = new Date();
  switch (status) {
    case "CONFIRMED":
      return { confirmedAt: now, cancelledAt: null };
    case "COMPLETED":
      return { confirmedAt: now, cancelledAt: null };
    case "CANCELLED":
      return { confirmedAt: null, cancelledAt: now };
    default:
      // PENDING / RESCHEDULED / NO_SHOW — na confirm hua, na cancel
      return { confirmedAt: null, cancelledAt: null };
  }
};

// --- service methods ---

// Person ke alag-alag address fields ko ek line me jod deta hai
const buildAddress = (person: {
  addressLine?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
} | null): string | null => {
  if (!person) {
    return null;
  }

  const parts = [person.addressLine, person.city, person.state, person.pincode, person.country]
    .map((p) => (p ?? "").trim())
    .filter(Boolean);

  return parts.length ? parts.join(", ") : null;
};

// Buyer visit book karta hai
const bookSiteVisit = async (userId: string, data: BookSiteVisitInput) => {
  if (data.sellerId) {
    await ensureLinkExists("sellerProfile", data.sellerId);
  }
  if (data.organizationId) {
    await ensureLinkExists("organization", data.organizationId);
  }
  if (data.propertyId) {
    await ensureLinkExists("property", data.propertyId);
  }

  // Buyer ne jo nahi diya wahi user profile se auto-fill ho jata hai
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

  // Name/email/phone/address: request value → user profile → null
  const name =
    data.name ||
    [user.person?.firstName, user.person?.lastName].filter(Boolean).join(" ").trim();
  const email = data.email || user.email  || null;
  const phone = data.phone || user.phone;
  const userAddress = data.userAddress?.trim() || buildAddress(user.person);

  if (!name) {
    throw new ApiError(400, "Name is required to book a site visit");
  }
  // Phone kabhi null nahi hota — model me required column hai
  if (!phone) {
    throw new ApiError(400, "Phone number is required to book a site visit");
  }

  // endTime nahi diya to default 60 min
  const startTime = data.startTime;
  const endTime = data.endTime ?? new Date(startTime.getTime() + DEFAULT_VISIT_MINUTES * MS_PER_MINUTE);

  return mapSiteVisit(
    await prisma.siteVisit.create({
      data: {
        sellerId: data.sellerId ?? null,
        organizationId: data.organizationId ?? null,
        userId,
        propertyId: data.propertyId ?? null,
        visitDate: data.visitDate,
        startTime,
        endTime,
        name,
        email: email ?? null,
        phone,
        message: data.message ?? null,
        // Request me nahi diya to user profile se, wahan bhi nahi to null
        userAddress: userAddress ?? null,
      },
      select: siteVisitDetailSelect,
    })
  );
};


// Buyer's apni visits
const listMySiteVisits = async (userId: string, query: ListSiteVisitsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.SiteVisitWhereInput = {
    userId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.from || query.to
      ? {
          visitDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.upcoming ? { startTime: { gte: new Date() } } : {}),
  };

  const [visits, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      skip,
      take,
      orderBy: { startTime: "desc" },
      select: siteVisitDetailSelect,
    }),
    prisma.siteVisit.count({ where }),
  ]);

  return {
    data: visits.map(mapSiteVisit),
    ...buildPagination(total, page, limit),
  };
};

// Single visit: buyer sirf apni, seller sirf apni
const getSiteVisit = async (scope: { userId?: string; sellerId?: string }, id: string) => {
  const visit = await prisma.siteVisit.findFirst({
    where: {
      id,
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.sellerId ? { sellerId: scope.sellerId } : {}),
    },
    select: siteVisitDetailSelect,
  });

  if (!visit) {
    throw new ApiError(404, "Site visit not found");
  }

  return mapSiteVisit(visit);
};

// Seller ke apne visits
const listSellerSiteVisits = async (sellerId: string, query: ListSiteVisitsQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.SiteVisitWhereInput = {
    sellerId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.propertyId ? { propertyId: query.propertyId } : {}),
    ...(query.organizationId ? { organizationId: query.organizationId } : {}),
    ...(query.from || query.to
      ? {
          visitDate: {
            ...(query.from ? { gte: query.from } : {}),
            ...(query.to ? { lte: query.to } : {}),
          },
        }
      : {}),
    ...(query.upcoming ? { startTime: { gte: new Date() } } : {}),
  };

  const [visits, total] = await Promise.all([
    prisma.siteVisit.findMany({
      where,
      skip,
      take,
      orderBy: { startTime: "desc" },
      select: siteVisitDetailSelect,
    }),
    prisma.siteVisit.count({ where }),
  ]);

  return {
    data: visits.map(mapSiteVisit),
    ...buildPagination(total, page, limit),
  };
};

// Jo statuses abhi future me hain (ya decide hua kar chal rahe hain)
const OPEN_STATUSES: SiteVisitStatusValue[] = ["PENDING", "CONFIRMED", "RESCHEDULED"];

// Seller ke status-wise visit counts
const getSellerSiteVisitStats = async (sellerId: string) => {
  const grouped = await prisma.siteVisit.groupBy({
    by: ["status"],
    where: { sellerId },
    _count: { _all: true },
  });

  const countByStatus = grouped.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});

  const byStatus = siteVisitStatuses.map((status) => ({
    status,
    count: countByStatus[status] ?? 0,
  }));

  const total = byStatus.reduce((sum, s) => sum + s.count, 0);
  const upcoming = await prisma.siteVisit.count({
    where: {
      sellerId,
      startTime: { gte: new Date() },
      status: { in: OPEN_STATUSES },
    },
  });

  return { total, upcoming, byStatus };
};

// Seller status update karta hai (koi bhi status seedha set ho sakta hai)
const updateStatus = async (
  sellerId: string,
  id: string,
  data: UpdateSiteVisitStatusInput
) => {
  const existing = await prisma.siteVisit.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Site visit not found");
  }

  return mapSiteVisit(
    await prisma.siteVisit.update({
      where: { id },
      data: {
        status: data.status,
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
        ...statusTimestamps(data.status),
      },
      select: siteVisitDetailSelect,
    })
  );
};

// Seller ya buyer date/time change karta hai
const rescheduleSiteVisit = async (
  scope: { userId?: string; sellerId?: string },
  id: string,
  data: RescheduleSiteVisitInput
) => {
  const existing = await prisma.siteVisit.findFirst({
    where: {
      id,
      ...(scope.userId ? { userId: scope.userId } : {}),
      ...(scope.sellerId ? { sellerId: scope.sellerId } : {}),
    },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Site visit not found");
  }

  const startTime = data.startTime;
  const endTime = data.endTime ?? new Date(startTime.getTime() + DEFAULT_VISIT_MINUTES * MS_PER_MINUTE);

  return mapSiteVisit(
    await prisma.siteVisit.update({
      where: { id },
      data: {
        visitDate: data.visitDate,
        startTime,
        endTime,
        status: "RESCHEDULED",
        ...statusTimestamps("RESCHEDULED"),
        ...(data.comment !== undefined ? { comment: data.comment } : {}),
      },
      select: siteVisitDetailSelect,
    })
  );
};

// Seller internal note update karta hai
const updateComment = async (sellerId: string, id: string, comment: string) => {
  const existing = await prisma.siteVisit.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Site visit not found");
  }

  return mapSiteVisit(
    await prisma.siteVisit.update({
      where: { id },
      data: { comment },
      select: siteVisitDetailSelect,
    })
  );
};

// Buyer apni visit cancel karta hai
const cancelMySiteVisit = async (userId: string, id: string, reason?: string) => {
  const existing = await prisma.siteVisit.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Site visit not found");
  }

  return mapSiteVisit(
    await prisma.siteVisit.update({
      where: { id },
      data: {
        status: "CANCELLED",
        ...statusTimestamps("CANCELLED"),
        ...(reason ? { message: reason } : {}),
      },
      select: siteVisitDetailSelect,
    })
  );
};

const deleteSiteVisit = async (sellerId: string, id: string) => {
  const existing = await prisma.siteVisit.findFirst({
    where: { id, sellerId },
    select: { id: true },
  });

  if (!existing) {
    throw new ApiError(404, "Site visit not found");
  }

  await prisma.siteVisit.delete({ where: { id } });

  return { message: "Site visit deleted" };
};

export {
  bookSiteVisit,
  listMySiteVisits,
  getSiteVisit,
  listSellerSiteVisits,
  getSellerSiteVisitStats,
  updateStatus,
  rescheduleSiteVisit,
  updateComment,
  cancelMySiteVisit,
  deleteSiteVisit,
};
