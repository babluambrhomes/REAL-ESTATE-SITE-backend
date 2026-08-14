import { z } from "zod";

export const documentUploadSchema = z.object({
  docType: z.enum([
    "PAN_CARD",
    "AADHAAR_CARD",
    "GST_CERTIFICATE",
    "COMPANY_REGISTRATION",
    "RERA_CERTIFICATE",
    "OFFICE_ADDRESS_PROOF",
    "OTHER",
  ]),
  title: z.string().max(200).trim().optional(),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
