import path from "path";
import fs from "fs/promises";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getDocRequirements, isDocAllowedFor } from "../../config/sellerKyc";
import { DocumentUploadInput } from "./kyc.validation";
import { resolvePrivatePath } from "../../config/storage";
import { uploadFile, deleteCloudinaryFile, isCloudinaryUrl } from "../../helpers/cloudinary.helper";
import { SellerType, VerificationStatus } from "../../generated/prisma/enums";
import { SellerContext } from "../../types";

/**
 * Which column a KYC document hangs off.
 *
 *   INDIVIDUAL   → seller_id
 *   ORGANIZATION → organization_id
 *
 * EXACTLY ONE of the two, never both. A database CHECK constraint enforces
 * this, so the previous code that set `sellerId` alongside
 * `organizationId` for orgs would now fail at insert time. Org documents
 * are company-level on purpose: staff turnover must not invalidate the
 * company's KYC, and no single employee should own the company's proof of
 * identity.
 */
type DocOwner = { sellerId: string } | { organizationId: string };

const getDocOwner = (ctx: SellerContext): DocOwner =>
  ctx.organizationId ? { organizationId: ctx.organizationId } : { sellerId: ctx.sellerId };

/** Filter matching every document owned by this selling entity. */
const docsWhereFor = (ctx: SellerContext) => getDocOwner(ctx);

const uploadDocument = async (
  ctx: SellerContext,
  userId: string,
  file: Express.Multer.File | undefined,
  data: DocumentUploadInput
) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  if (!isDocAllowedFor(ctx.sellerType, data.docType)) {
    throw new ApiError(
      400,
      `Document type ${data.docType} is not allowed for ${ctx.sellerType} sellers`
    );
  }

  const owner = getDocOwner(ctx);

  // --- CLOUDINARY (new) ---
  const uploaded = await uploadFile(file.path, {
    folder: `${process.env.CLOUDINARY_FOLDER || "real-estate"}/kyc/${userId}`,
    resourceType: "auto",
  });
  const fileUrl = uploaded.url;

  const existing = await prisma.sellerVerificationDocument.findFirst({
    where: { ...owner, docType: data.docType },
  });

  if (existing?.status === VerificationStatus.VERIFIED) {
    // --- CLOUDINARY (new) ---
    if (isCloudinaryUrl(fileUrl)) {
      await deleteCloudinaryFile(fileUrl, "auto");
    }
    // --- LOCAL (old) -- keep for reference ---
    // await fs.unlink(file.path).catch(() => {});
    throw new ApiError(409, "Document already verified. Cannot re-upload.");
  }

  const docData = {
    docType: data.docType,
    title: data.title,
    fileUrl,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    status: VerificationStatus.PENDING,
  };

  // Re-uploading resets the review: reason + reviewer + timestamp must all
  // clear, otherwise a rejected document that is re-submitted would still
  // show the old rejection reason next to its new PENDING status.
  const resetReview = {
    ...docData,
    status: VerificationStatus.PENDING,
    rejectionReason: null,
    verifiedAt: null,
    verifiedBy: null,
  };

  const document =
    ctx.organizationId != null
      ? await prisma.sellerVerificationDocument.upsert({
          where: {
            organizationId_docType: {
              organizationId: ctx.organizationId,
              docType: data.docType,
            },
          },
          create: { ...docData, organizationId: ctx.organizationId },
          update: resetReview,
        })
      : await prisma.sellerVerificationDocument.upsert({
          where: { sellerId_docType: { sellerId: ctx.sellerId, docType: data.docType } },
          create: { ...docData, sellerId: ctx.sellerId },
          update: resetReview,
        });

  if (existing) {
    // --- CLOUDINARY (new) ---
    if (isCloudinaryUrl(existing.fileUrl)) {
      await deleteCloudinaryFile(existing.fileUrl, "auto");
    }
    // --- LOCAL (old) -- keep for reference ---
    // await fs.unlink(resolvePrivatePath(existing.fileUrl)).catch(() => {});
  }

  return document;
};

/**
 * KYC documents, always read and written against ONE resolved selling context.
 *
 * The context is passed in from the request rather than re-resolved from the
 * user id. That distinction matters: resolveSellerContextForUser cannot see
 * which organization the caller named, so for a user who is both an
 * individual seller and a company agent, uploading company GST papers would
 * have silently filed them under their personal profile — a document on the
 * wrong legal entity, which is exactly what KYC review exists to prevent.
 */
const getDocuments = async (ctx: SellerContext) => {
  const docsWhere = docsWhereFor(ctx);

  const [documents, requirements] = await Promise.all([
    prisma.sellerVerificationDocument.findMany({
      where: docsWhere,
      orderBy: { createdAt: "desc" },
    }),
    Promise.resolve(getDocRequirements(ctx.sellerType)),
  ]);

  const docMap = new Map(documents.map((doc) => [doc.docType, doc]));

  const submissionStatus = requirements.map((req) => {
    const doc = docMap.get(req.docType);
    return {
      docType: req.docType,
      displayLabel: req.displayLabel,
      isRequired: req.isRequired,
      maxFiles: req.maxFiles,
      displayOrder: req.displayOrder,
      submitted: Boolean(doc),
      status: doc?.status ?? null,
      rejectionReason: doc?.rejectionReason ?? null,
    };
  });

  return { sellerType: ctx.sellerType, documents, submissionStatus };
};

const deleteDocument = async (ctx: SellerContext, docId: string) => {
  const document = await prisma.sellerVerificationDocument.findFirst({
    where: { id: docId, ...docsWhereFor(ctx) },
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  if (document.status === VerificationStatus.VERIFIED) {
    throw new ApiError(400, "Verified documents cannot be deleted");
  }

  await prisma.sellerVerificationDocument.delete({ where: { id: document.id } });

  // --- CLOUDINARY (new) ---
  if (isCloudinaryUrl(document.fileUrl)) {
    await deleteCloudinaryFile(document.fileUrl, "auto");
  }
  // --- LOCAL (old) -- keep for reference ---
  // await fs.unlink(resolvePrivatePath(document.fileUrl)).catch(() => {});

  return { message: "Document deleted" };
};

const getDocumentFile = async (ctx: SellerContext, docId: string) => {
  const document = await prisma.sellerVerificationDocument.findFirst({
    where: { id: docId, ...docsWhereFor(ctx) },
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  // --- CLOUDINARY (new) ---
  if (isCloudinaryUrl(document.fileUrl)) {
    return { cloudinaryUrl: document.fileUrl };
  }

  // --- LOCAL (old) -- keep for reference ---
  const absPath = resolvePrivatePath(document.fileUrl);
  try {
    await fs.access(absPath);
  } catch {
    throw new ApiError(404, "File not found");
  }

  return { absPath };
};

export { uploadDocument, getDocuments, deleteDocument, getDocumentFile };
