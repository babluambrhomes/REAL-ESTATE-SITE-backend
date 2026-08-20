import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { SearchQueryInput } from "./search.validation";
import * as searchService from "./search.service";

const searchProperties = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query: SearchQueryInput = req.query as SearchQueryInput;
  const result = await searchService.searchProperties(query);
  res.status(200).json(new ApiResponse(200, result));
});

export { searchProperties };
