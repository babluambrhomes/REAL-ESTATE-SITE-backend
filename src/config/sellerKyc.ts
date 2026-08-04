import { SellerType, SellerDocumentType } from "../generated/prisma/enums";

export interface SellerDocumentRequirement {
  docType: SellerDocumentType;
  isRequired: boolean;
  displayLabel: string;
  maxFiles: number;
  displayOrder: number;
}

export const SELLER_DOCUMENT_REQUIREMENTS: Record<
  SellerType,
  SellerDocumentRequirement[]
> = {
  [SellerType.INDIVIDUAL]: [
    { docType: SellerDocumentType.PAN_CARD, isRequired: true, displayLabel: "PAN Card", maxFiles: 1, displayOrder: 1 },
    { docType: SellerDocumentType.AADHAAR_CARD, isRequired: true, displayLabel: "Aadhaar Card", maxFiles: 1, displayOrder: 2 },
    { docType: SellerDocumentType.RERA_CERTIFICATE, isRequired: false, displayLabel: "RERA Certificate", maxFiles: 1, displayOrder: 3 },
  ],
  [SellerType.ORGANIZATION]: [
    { docType: SellerDocumentType.COMPANY_REGISTRATION, isRequired: true, displayLabel: "Company Registration", maxFiles: 1, displayOrder: 1 },
    { docType: SellerDocumentType.GST_CERTIFICATE, isRequired: true, displayLabel: "GST Certificate", maxFiles: 1, displayOrder: 2 },
    { docType: SellerDocumentType.PAN_CARD, isRequired: true, displayLabel: "Company PAN Card", maxFiles: 1, displayOrder: 3 },
    { docType: SellerDocumentType.OFFICE_ADDRESS_PROOF, isRequired: true, displayLabel: "Office Address Proof", maxFiles: 1, displayOrder: 4 },
    { docType: SellerDocumentType.RERA_CERTIFICATE, isRequired: false, displayLabel: "RERA Certificate", maxFiles: 1, displayOrder: 5 },
  ],
};

export const getDocRequirements = (
  sellerType: SellerType
): SellerDocumentRequirement[] => SELLER_DOCUMENT_REQUIREMENTS[sellerType] ?? [];

export const getRequiredDocs = (
  sellerType: SellerType
): SellerDocumentRequirement[] =>
  getDocRequirements(sellerType).filter((r) => r.isRequired);

export const isDocAllowedFor = (
  sellerType: SellerType,
  docType: string
): boolean => getDocRequirements(sellerType).some((r) => r.docType === docType);
