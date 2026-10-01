import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getPaginationParams, buildPagination } from "../../helpers";
import { LeadSource } from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import {
  CreateInquiryInput,
  UpdateInquiryStatusInput,
  UpdateInquiryCommentInput,
  AssignInquiryInput,
  ListInquiriesQueryInput,
  inquiryStatuses,
  inquirySources,
} from "./organizationInquiry.validation";

const inquirySelect = {
  id: true,
  organizationId: true,
  sellerId: true,
  userId: true,
  assignedToMemberId: true,
  source: true,
  status: true,
  name: true,
  email: true,
  phone: true,
  budgetRange: true,
  preferredProject: true,
  message: true,
  comment: true,
  termsAccepted: true,
  termsAcceptedAt: true,
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
  organization: {
    select: { id: true, name: true, slug: true, logoUrl: true },
  },
  assignedToMember: {
    select: {
      id: true,
      status: true,
      role: { select: { roleName: true } },
      user: {
        select: {
          id: true,
          person: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
      },
    },
  },
} as const;

type InquiryRow = Prisma.OrganizationInquiryGetPayload<{ select: typeof inquirySelect }>;

/**
 * Resolves the target organization and rejects anything that is not an active
 * company.
 *
 * checkOrgMember already proves the caller is an ACTIVE member and that the
 * org is ACTIVE (resolveOrgContext), so this only has to confirm the org row
 * is still there for the write itself. Both are kept: the middleware answers
 * "may you?", this answers "does it still exist?".
 */
const ensureOrganization = async (organizationId: string) => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, sellerProfile: { select: { id: true } } },
  });

  if (!org) {
    throw new ApiError(404, "Organization not found");
  }

  return org;
};

/**
 * Ownership check.
 *
 * Filtered on organizationId in the query rather than after fetching, so an
 * inquiry belonging to another company is never loaded. 404 not 403 so the
 * response does not confirm that another org's inquiry id is real.
 */
const findOrgInquiry = async (organizationId: string, id: string) => {
  const inquiry = await prisma.organizationInquiry.findFirst({
    where: { id, organizationId },
    select: inquirySelect,
  });

  if (!inquiry) {
    throw new ApiError(404, "Inquiry not found");
  }

  return inquiry;
};

/**
 * Validates the assignee really belongs to THIS organization.
 *
 * A member id on its own is not proof of anything: it may be an active member
 * of a completely different company. Without this check any org admin could
 * assign an inquiry to a stranger, and that stranger would then read the
 * buyer's name, phone and budget. Hence the membership lookup, not a blind FK
 * write.
 */
const ensureAssignableMember = async (
  organizationId: string,
  memberId: string
) => {
  const member = await prisma.member.findFirst({
    where: {
      id: memberId,
      status: "ACTIVE",
      organization: { id: organizationId },
    },
    select: { id: true, role: { select: { roleName: true } } },
  });

  if (!member) {
    throw new ApiError(
      400,
      "That member is not an active member of this organization"
    );
  }

  return member;
};

const createInquiry = async (organizationId: string, userId: string, data: CreateInquiryInput) => {
  const org = await ensureOrganization(organizationId);

  // Login is required, so the profile is the fallback for name/phone — same
  // pattern LeadForm uses. Email is genuinely optional and stays null if the
  // user has none.
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
    throw new ApiError(400, "Name is required for this inquiry");
  }

  const phone = data.phone?.trim() || user.phone?.trim() || null;
  if (!phone) {
    throw new ApiError(400, "Phone number is required for this inquiry");
  }

  const email = data.email?.trim() || user.email?.trim() || null;

  return prisma.organizationInquiry.create({
    data: {
      organizationId: org.id,
      // Attribution: points at the org's public profile so the inquiry can be
      // tied back in seller-scoped reports later. Null-safe if the org has no
      // profile yet.
      sellerId: org.sellerProfile?.id ?? null,
      userId,
      source: LeadSource.CONTACT,
      name,
      email,
      phone,
      budgetRange: data.budgetRange ?? null,
      preferredProject: data.preferredProject ?? null,
      message: data.message ?? null,
      // The schema has already rejected anything but `true`, so this timestamp
      // is always written — there is no path to an accepted row without one.
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    },
    select: inquirySelect,
  });
};

const listInquiries = async (organizationId: string, query: ListInquiriesQueryInput) => {
  const { skip, take, page, limit } = getPaginationParams(query);

  const where: Prisma.OrganizationInquiryWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.assignedToMemberId
      ? { assignedToMemberId: query.assignedToMemberId }
      : {}),
  };

  const [inquiries, total] = await Promise.all([
    prisma.organizationInquiry.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: inquirySelect,
    }),
    prisma.organizationInquiry.count({ where }),
  ]);

  return {
    data: inquiries,
    ...buildPagination(total, page, limit),
  };
};

const getInquiry = async (organizationId: string, id: string) => {
  return findOrgInquiry(organizationId, id);
};

/**
 * Counts by status and by source.
 *
 * Every catalogue value is reported, including the ones with a zero count.
 * Reporting only present values would make a dashboard hide "no inquiries
 * lost yet" entirely, which reads as a broken widget rather than a healthy
 * pipeline.
 */
const getInquiryStats = async (organizationId: string) => {
  const [byStatusGroup, bySourceGroup] = await Promise.all([
    prisma.organizationInquiry.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true },
    }),
    prisma.organizationInquiry.groupBy({
      by: ["source"],
      where: { organizationId },
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

  return {
    total: byStatusGroup.reduce((sum, row) => sum + row._count._all, 0),
    byStatus: inquiryStatuses.map((status) => ({
      status,
      count: statusCount[status] ?? 0,
    })),
    bySource: inquirySources.map((source) => ({
      source,
      count: sourceCount[source] ?? 0,
    })),
  };
};

const updateInquiryStatus = async (
  organizationId: string,
  id: string,
  data: UpdateInquiryStatusInput
) => {
  const inquiry = await findOrgInquiry(organizationId, id);

  return prisma.organizationInquiry.update({
    where: { id: inquiry.id },
    data: { status: data.status },
    select: inquirySelect,
  });
};

const updateInquiryComment = async (
  organizationId: string,
  id: string,
  comment: string
) => {
  const inquiry = await findOrgInquiry(organizationId, id);

  return prisma.organizationInquiry.update({
    where: { id: inquiry.id },
    data: { comment },
    select: inquirySelect,
  });
};

/**
 * Assigns (or un-assigns) an inquiry.
 *
 * `null` puts it back in the org's shared pool, which is where every inquiry
 * lands on arrival.
 */
const assignInquiry = async (
  organizationId: string,
  id: string,
  data: AssignInquiryInput
) => {
  const inquiry = await findOrgInquiry(organizationId, id);

  if (data.memberId === null) {
    return prisma.organizationInquiry.update({
      where: { id: inquiry.id },
      data: { assignedToMemberId: null },
      select: inquirySelect,
    });
  }

  await ensureAssignableMember(organizationId, data.memberId);

  return prisma.organizationInquiry.update({
    where: { id: inquiry.id },
    data: { assignedToMemberId: data.memberId },
    select: inquirySelect,
  });
};

const deleteInquiry = async (organizationId: string, id: string) => {
  const inquiry = await findOrgInquiry(organizationId, id);

  await prisma.organizationInquiry.delete({ where: { id: inquiry.id } });

  return { message: "Inquiry deleted" };
};

export {
  createInquiry,
  listInquiries,
  getInquiry,
  getInquiryStats,
  updateInquiryStatus,
  updateInquiryComment,
  assignInquiry,
  deleteInquiry,
};
