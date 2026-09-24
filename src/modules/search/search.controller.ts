import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import { AuthRequest } from "../../types";
import { SearchQueryInput, suggestionsQuerySchema } from "./search.validation";
import * as searchService from "./search.service";
import * as suggestionsService from "./suggestions.service";

const searchProperties = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query: SearchQueryInput = req.query as SearchQueryInput;
  const result = await searchService.searchProperties(query);
  res.status(200).json(new ApiResponse(200, result));
});

const searchSuggestions = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = suggestionsQuerySchema.parse(req.query);
  const result = await suggestionsService.getSearchSuggestions(query);
  res.status(200).json(new ApiResponse(200, result));
});

export { searchProperties, searchSuggestions };
