import { Response } from "express";
import { asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import * as brochureService from "./brochure.service";

const getBrochure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await brochureService.getBrochure(
    String(req.params.id),
    String(req.params.variantId)
  );

  // --- CLOUDINARY (new) ---
  if ("cloudinaryUrl" in result) {
    res.redirect(result.cloudinaryUrl!);
    return;
  }
  // --- LOCAL (old) -- keep for reference ---
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.sendFile(result.absPath);
});

export { getBrochure };
