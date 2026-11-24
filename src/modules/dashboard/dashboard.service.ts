import prisma from "../../config/prisma";
import { getDocRequirements } from "../../config/sellerKyc";
import { ListingStatus, LeadStatus, VerificationStatus } from "../../generated/prisma/enums";
import { Prisma } from "../../generated/prisma/client";
import { ownedPropertyWhere } from "../../helpers";
import { ApiError } from "../../utils";
import { AuthUser, SellerContext } from "../../types";

const dashboardSellerSelect = {
  id: true,
  slug: true,
  sellerType: true,
  organizationId: true,
  categoryId: true,
  headline: true,
  about: true,
  experienceYears: true,
  specializations: true,
  languages: true,
  logoUrl: true,
  addressLine: true,
  city: true,
  state: true,
  country: true,
  pincode: true,
  reraNumber: true,
  responseTimeMinutes: true,
  isAvailable: true,
  availabilityDetails: true,
  locations: true,
  bankApprovalList: true,
  achievements: true,
  socialLinks: true,
  contactPhone: true,
  contactEmail: true,
  leadPreferences: true,
  organization: {
    select: {
      id: true,
      name: true,
      description: true,
      registrationNumber: true,
      website: true,
      gstNumber: true,
      panNumber: true,
      yearEstablished: true,
      employeeCount: true,
    },
  },
} as const;

type DashboardSeller = NonNullable<
  Awaited<ReturnType<typeof loadSellerProfile>>
>;

type ChecklistItem = {
  key: string;
  label: string;
  weight: number;
  complete: boolean;
};

async function loadSellerProfile(sellerId: string) {
  return prisma.sellerProfile.findUnique({
    where: { id: sellerId },
    select: dashboardSellerSelect,
  });
}

const hasText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const hasItems = (value: unknown): boolean => Array.isArray(value) && value.length > 0;

const isFilled = (value: unknown): boolean => {
  if (typeof value === "string") return hasText(value);
  if (Array.isArray(value)) return value.length > 0;
  return value !== null && value !== undefined;
};

const managedLeadScope = (ctx: SellerContext): Prisma.LeadInquiryWhereInput =>
  ctx.organizationId
    ? { organizationId: ctx.organizationId }
    : { sellerId: ctx.sellerId, organizationId: null };

const getDisplayName = (user: AuthUser): string => {
  const personName = [user.person?.firstName, user.person?.lastName]
    .filter((part): part is string => hasText(part))
    .join(" ");

  if (personName) return personName;
  if (hasText(user.email)) return user.email;
  if (hasText(user.phone)) return user.phone;
  return "Seller";
};

const buildProfileCompletion = (
  ctx: SellerContext,
  seller: DashboardSeller,
  user: AuthUser
) => {
  const checklist: ChecklistItem[] = [
    { key: "categoryId", label: "Category", weight: 8, complete: hasText(seller.categoryId) },
    { key: "headline", label: "Headline", weight: 7, complete: hasText(seller.headline) },
    { key: "about", label: "About", weight: 8, complete: hasText(seller.about) },
    { key: "contactEmail", label: "Contact email", weight: 7, complete: hasText(seller.contactEmail) },
    { key: "contactPhone", label: "Contact phone", weight: 7, complete: hasText(seller.contactPhone) },
    { key: "addressLine", label: "Address", weight: 6, complete: hasText(seller.addressLine) },
    { key: "city", label: "City", weight: 6, complete: hasText(seller.city) },
    { key: "state", label: "State", weight: 4, complete: hasText(seller.state) },
    { key: "country", label: "Country", weight: 4, complete: hasText(seller.country) },
    { key: "pincode", label: "Pincode", weight: 6, complete: hasText(seller.pincode) },
    { key: "locations", label: "Service locations", weight: 7, complete: hasItems(seller.locations) },
  ];

  if (ctx.sellerType === "ORGANIZATION") {
    checklist.push(
      { key: "description", label: "Organization description", weight: 5, complete: hasText(seller.organization?.description) },
      { key: "registrationNumber", label: "Registration number", weight: 5, complete: hasText(seller.organization?.registrationNumber) },
      { key: "website", label: "Website", weight: 5, complete: hasText(seller.organization?.website) }
    );
  } else {
    checklist.push(
      { key: "displayName", label: "Display name", weight: 5, complete: hasText(user.person?.firstName) || hasText(user.email) },
      { key: "avatarUrl", label: "Profile photo", weight: 5, complete: hasText(user.person?.avatarUrl) },
      { key: "reraNumber", label: "RERA number", weight: 5, complete: hasText(seller.reraNumber) }
    );
  }

  checklist.push(
    { key: "experienceYears", label: "Experience", weight: 3, complete: isFilled(seller.experienceYears) },
    { key: "specializations", label: "Specializations", weight: 3, complete: hasItems(seller.specializations) },
    { key: "languages", label: "Languages", weight: 2, complete: hasItems(seller.languages) },
    { key: "isAvailable", label: "Availability", weight: 2, complete: isFilled(seller.isAvailable) },
    { key: "responseTimeMinutes", label: "Response time", weight: 2, complete: isFilled(seller.responseTimeMinutes) },
    { key: "socialLinks", label: "Social links", weight: 1, complete: hasItems(seller.socialLinks) },
    { key: "bankApprovalList", label: "Bank approvals", weight: 1, complete: hasItems(seller.bankApprovalList) },
    { key: "achievements", label: "Achievements", weight: 1, complete: hasItems(seller.achievements) }
  );

  const completed = checklist.filter((item) => item.complete).map((item) => item.key);
  const missing = checklist.filter((item) => !item.complete).map((item) => item.key);
  const percentage = checklist.reduce(
    (total, item) => total + (item.complete ? item.weight : 0),
    0
  );

  return {
    percentage,
    status: percentage === 100 ? "COMPLETE" : "INCOMPLETE",
    completed,
    missing,
  };
};

const buildKycStatus = (
  ctx: SellerContext,
  verificationStatus: VerificationStatus,
  documents: Array<{
    docType: string;
    status: VerificationStatus;
    rejectionReason: string | null;
  }>
) => {
  const requirements = getDocRequirements(ctx.sellerType);
  const required = requirements.filter((item) => item.isRequired);
  const docMap = new Map(documents.map((doc) => [doc.docType, doc]));
  const complete =
    required.length > 0 &&
    required.every((item) => docMap.get(item.docType)?.status === VerificationStatus.VERIFIED);
  const submitted = documents.length > 0;
  const requiredSubmitted = required.filter((item) => docMap.has(item.docType)).length;
  const rejected =
    verificationStatus === VerificationStatus.REJECTED ||
    documents.some((doc) => doc.status === VerificationStatus.REJECTED);

  const status =
    verificationStatus === VerificationStatus.VERIFIED
      ? "VERIFIED"
      : rejected
        ? "REJECTED"
        : submitted
          ? "PENDING"
          : "NOT_SUBMITTED";

  return {
    status,
    complete,
    submitted,
    requiredSubmitted,
    requirements: requirements.map((item) => {
      const doc = docMap.get(item.docType);
      return {
        docType: item.docType,
        label: item.displayLabel,
        isRequired: item.isRequired,
        submitted: Boolean(doc),
        status: doc?.status ?? null,
        rejectionReason: doc?.rejectionReason ?? null,
      };
    }),
  };
};

const getSummary = async (ctx: SellerContext, user: AuthUser) => {
  const seller = await loadSellerProfile(ctx.sellerId);
  if (!seller) {
    throw new ApiError(404, "Seller profile not found");
  }

  const propertyWhere = ownedPropertyWhere(ctx);
  const leadScope = managedLeadScope(ctx);
  const documentsWhere = ctx.organizationId
    ? { organizationId: ctx.organizationId }
    : { sellerId: ctx.sellerId };
  const verificationStatus = ctx.organizationVerificationStatus ?? ctx.verificationStatus;

  const [propertiesTotal, activeProperties, followersTotal, leadsTotal, newLeads, documents] =
    await Promise.all([
      prisma.property.count({ where: propertyWhere }),
      prisma.property.count({
        where: { ...propertyWhere, listingStatus: ListingStatus.PUBLISHED },
      }),
      prisma.sellerFollow.count({ where: { sellerId: ctx.sellerId } }),
      prisma.leadInquiry.count({ where: leadScope }),
      prisma.leadInquiry.count({
        where: { ...leadScope, status: LeadStatus.NEW },
      }),
      prisma.sellerVerificationDocument.findMany({
        where: documentsWhere,
        select: { docType: true, status: true, rejectionReason: true },
      }),
    ]);

  return {
    workspace: {
      id: ctx.organizationId ?? ctx.sellerId,
      sellerId: ctx.sellerId,
      organizationId: ctx.organizationId,
      type: ctx.sellerType,
      name:
        ctx.sellerType === "ORGANIZATION"
          ? seller.organization?.name ?? getDisplayName(user)
          : getDisplayName(user),
      slug: seller.slug,
      roleName: ctx.roleName,
    },
    account: {
      status: user.status,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      verificationStatus,
    },
    profile: buildProfileCompletion(ctx, seller, user),
    kyc: buildKycStatus(ctx, verificationStatus, documents),
    properties: {
      total: propertiesTotal,
      active: activeProperties,
    },
    followers: {
      total: followersTotal,
    },
    leads: {
      total: leadsTotal,
      newCount: newLeads,
    },
  };
};

export { getSummary };
