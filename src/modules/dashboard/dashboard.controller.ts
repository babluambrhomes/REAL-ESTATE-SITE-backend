import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { requireSellerContext } from "../../helpers";
import * as dashboardService from "./dashboard.service";

const getSummary = asyncHandler(async (req: AuthRequest, res: Response) => {
  const summary = await dashboardService.getSummary(requireSellerContext(req), req.user!);
  res.status(200).json(new ApiResponse(200, summary, "Dashboard summary fetched"));
});

export { getSummary };
