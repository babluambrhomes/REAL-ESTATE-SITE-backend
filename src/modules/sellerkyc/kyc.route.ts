import { Router } from "express";
import {
  uploadDocument,
  getDocuments,
  deleteDocument,
  getDocumentFile,
} from "./kyc.controller";
import { protect, checkSeller, uploadDocument as uploadDocumentMiddleware } from "../../middlewares";

const router = Router();

router.use(protect);
router.use(checkSeller);

router.get("/documents", getDocuments);
router.post(
  "/documents",
  uploadDocumentMiddleware.single("document"),
  uploadDocument
);
router.get("/documents/:docId/file", getDocumentFile);
router.delete("/documents/:docId", deleteDocument);

export default router;
