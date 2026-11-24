import { Response } from "express";
import { asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import * as brochureService from "./brochure.service";

const getBrochure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await brochureService.getBrochure(
    String(req.params.id),
    String(req.params.variantId)
  );

  if ("url" in result) {
    res.redirect(result.url);
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
  res.sendFile(result.absPath);
});

export { getBrochure };
