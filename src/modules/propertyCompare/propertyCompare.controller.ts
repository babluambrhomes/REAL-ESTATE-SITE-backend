import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils";
import * as propertyCompareService from "./propertyCompare.service";
import type {
  ComparePropertiesInput,
  SuggestPropertiesQueryInput,
} from "./propertyCompare.validation";

export const compareProperties = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await propertyCompareService.compareProperties(
      req.body as ComparePropertiesInput
    );

    res
      .status(200)
      .json(new ApiResponse(200, { data: result }, "Properties fetched"));
  }
);

export const suggestPropertyPairs = asyncHandler(
  async (req: Request, res: Response) => {
    const query = (req as unknown as { validatedQuery: SuggestPropertiesQueryInput })
      .validatedQuery;

    const result = await propertyCompareService.suggestPropertyPairs(query);

    res
      .status(200)
      .json(new ApiResponse(200, { data: result }, "Property suggestions fetched"));
  }
);
