import { Response } from "express";
import { asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import * as brochureService from "./brochure.service";

const getBrochure = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { absPath, filename } = await brochureService.getBrochure(
    String(req.params.id),
    String(req.params.variantId)
  );

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.sendFile(absPath);
});

export { getBrochure };
