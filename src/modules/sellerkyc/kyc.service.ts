import path from "path";
import fs from "fs/promises";
import prisma from "../../config/prisma";
import { ApiError } from "../../utils";
import { getDocRequirements, isDocAllowedFor } from "../../config/sellerKyc";
import { DocumentUploadInput } from "./kyc.validation";
import { PROJECT_ROOT, resolvePrivatePath } from "../../config/storage";
import { uploadFile, deleteCloudinaryFile, isCloudinaryUrl } from "../../helpers/cloudinary.helper";
import { SellerType, VerificationStatus } from "../../generated/prisma/enums";

interface OwnerContext {
  sellerId?: string;
  organizationId?: string;
}

const getSeller = async (userId: string) => {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId },
    select: { id: true, sellerType: true, organizationId: true, isActive: true },
  });

  if (!seller) {
    throw new ApiError(403, "You are not registered as a seller");
  }

  if (!seller.isActive) {
    throw new ApiError(403, "Your seller account is deactivated");
  }

  return seller;
};

const getOwnerContext = (seller: {
  id: string;
  sellerType: SellerType;
  organizationId: string | null;
}): OwnerContext => {
  // sellerId hamesha = seller profile id (INDIVIDUAL ya ORG owner).
  // ORGANIZATION ke liye sath me organizationId bhi set hota hai (dono).
  const ctx: OwnerContext = { sellerId: seller.id };
  if (seller.sellerType === SellerType.ORGANIZATION) {
    if (!seller.organizationId) {
      throw new ApiError(400, "Organization not linked to seller account");
    }
    ctx.organizationId = seller.organizationId;
  }
  return ctx;
};

// Document list/delete/get ke liye smart filter — purane rows bhi milte hain.
const getDocsFilterWhere = (owner: OwnerContext, sellerType: SellerType) =>
  sellerType === SellerType.ORGANIZATION && owner.organizationId
    ? { organizationId: owner.organizationId }
    : { sellerId: owner.sellerId! };

const uploadDocument = async (
  userId: string,
  file: Express.Multer.File | undefined,
  data: DocumentUploadInput 
) => {
  if (!file) {
    throw new ApiError(400, "No file uploaded");
  }

  const seller = await getSeller(userId);

  if (!isDocAllowedFor(seller.sellerType, data.docType)) {
    throw new ApiError(
      400,
      `Document type ${data.docType} is not allowed for ${seller.sellerType} sellers`
    );
  }

  const owner = getOwnerContext(seller);

  // --- CLOUDINARY (new) ---
  const uploaded = await uploadFile(file.path, {
    folder: `${process.env.CLOUDINARY_FOLDER || "real-estate"}/kyc/${userId}`,
    resourceType: "auto",
  });
  const fileUrl = uploaded.url;

  // --- LOCAL (old) -- keep for reference ---
  // const fileUrl = path.relative(PROJECT_ROOT, file.path);

  // Existing doc dhundho — ORG ke liye sirf organizationId+docType se
  // (kyunki purane rows me sellerId null ho sakta hai).
  // INDIVIDUAL ke liye sellerId+docType.
  const existingWhere = owner.organizationId
    ? { organizationId: owner.organizationId, docType: data.docType }
    : { sellerId: owner.sellerId!, docType: data.docType };

  const existing = await prisma.sellerVerificationDocument.findFirst({
    where: existingWhere,
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

  const createData = {
    docType: data.docType,
    title: data.title,
    fileUrl,
    originalName: file.originalname,
    mimeType: file.mimetype,
    fileSize: file.size,
    status: VerificationStatus.PENDING,
  };

  let document;
  // sellerId hamesha set hai — branch organizationId ki presence se (sirf ORG ke liye).
  if (owner.organizationId) {
    document = await prisma.sellerVerificationDocument.upsert({
      where: {
        organizationId_docType: {
          organizationId: owner.organizationId,
          docType: data.docType,
        },
      },
      create: { ...createData, sellerId: owner.sellerId!, organizationId: owner.organizationId },
      update: {
        ...createData,
        sellerId: owner.sellerId!,
        rejectionReason: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    });
  } else {
    document = await prisma.sellerVerificationDocument.upsert({
      where: { sellerId_docType: { sellerId: owner.sellerId!, docType: data.docType } },
      create: { ...createData, sellerId: owner.sellerId! },
      update: {
        ...createData,
        rejectionReason: null,
        verifiedAt: null,
        verifiedBy: null,
      },
    });
  }

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

const getDocuments = async (userId: string) => {
  const seller = await getSeller(userId);
  const owner = getOwnerContext(seller);

  const docsWhere = getDocsFilterWhere(owner, seller.sellerType);

  const [documents, requirements] = await Promise.all([
    prisma.sellerVerificationDocument.findMany({
      where: docsWhere,
      orderBy: { createdAt: "desc" },
    }),
    Promise.resolve(getDocRequirements(seller.sellerType)),
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

  return { sellerType: seller.sellerType, documents, submissionStatus };
};

const deleteDocument = async (userId: string, docId: string) => {
  const seller = await getSeller(userId);
  const owner = getOwnerContext(seller);

  const docsWhere = getDocsFilterWhere(owner, seller.sellerType);

  const document = await prisma.sellerVerificationDocument.findFirst({
    where: { id: docId, ...docsWhere },
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

const getDocumentFile = async (userId: string, docId: string) => {
  const seller = await getSeller(userId);
  const owner = getOwnerContext(seller);

  const docsWhere = getDocsFilterWhere(owner, seller.sellerType);

  const document = await prisma.sellerVerificationDocument.findFirst({
    where: { id: docId, ...docsWhere },
  });

  if (!document) {
    throw new ApiError(404, "Document not found");
  }

  const absPath = resolvePrivatePath(document.fileUrl);

  // --- CLOUDINARY (new) ---
  if (isCloudinaryUrl(document.fileUrl)) {
    return { cloudinaryUrl: document.fileUrl };
  }
  // --- LOCAL (old) -- keep for reference ---
  // const absPath = resolvePrivatePath(document.fileUrl);
  // try {
  //   await fs.access(absPath);
  // } catch {
  //   throw new ApiError(404, "File not found");
  // }

  try {
    await fs.access(absPath);
  } catch {
    throw new ApiError(404, "File not found");
  }

  return { absPath };
};

export { uploadDocument, getDocuments, deleteDocument, getDocumentFile };
