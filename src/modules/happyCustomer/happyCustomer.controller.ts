import { Request, Response } from "express";
import { ApiError, ApiResponse, asyncHandler } from "../../utils";
import * as happyCustomerService from "./happyCustomer.service";
import type {
  CreateHappyCustomerInput,
  HappyCustomerListQueryInput,
  UpdateHappyCustomerInput,
} from "./happyCustomer.validation";
import { happyCustomerListQuerySchema } from "./happyCustomer.validation";

const parseListQuery = (req: Request): HappyCustomerListQueryInput => {
  const parsed = happyCustomerListQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    throw new ApiError(
      400,
      parsed.error.issues[0]?.message ?? "Invalid query"
    );
  }
  return parsed.data;
};

const listPublic = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.listPublicHappyCustomers(
    parseListQuery(req)
  );
  res.status(200).json(new ApiResponse(200, result, "Happy customers fetched"));
});

const listAll = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.listHappyCustomers(
    parseListQuery(req)
  );
  res.status(200).json(new ApiResponse(200, result, "Happy customers fetched"));
});

const getById = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.getHappyCustomerById(
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, "Happy customer fetched"));
});

const create = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.createHappyCustomer(
    req.body as CreateHappyCustomerInput
  );
  res
    .status(201)
    .json(new ApiResponse(201, result, "Happy customer created"));
});

const update = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.updateHappyCustomer(
    String(req.params.id),
    req.body as UpdateHappyCustomerInput
  );
  res.status(200).json(new ApiResponse(200, result, "Happy customer updated"));
});

const remove = asyncHandler(async (req: Request, res: Response) => {
  const result = await happyCustomerService.deleteHappyCustomer(
    String(req.params.id)
  );
  res.status(200).json(new ApiResponse(200, result, "Happy customer deleted"));
});

export { listPublic, listAll, getById, create, update, remove };
