import { Router } from "express";
import { PermissionScope } from "../../generated/prisma/enums";
import { protect, requirePermission, validate } from "../../middlewares";
import {
  create,
  getById,
  listAll,
  listPublic,
  remove,
  update,
} from "./happyCustomer.controller";
import {
  createHappyCustomerSchema,
  happyCustomerIdParamsSchema,
  updateHappyCustomerSchema,
} from "./happyCustomer.validation";

const router = Router();
const platformOnly = requirePermission(
  PermissionScope.PLATFORM,
  "happyCustomer:manage"
);

router.get("/", listPublic);

router.get("/admin", protect, platformOnly, listAll);
router.post("/", protect, platformOnly, validate(createHappyCustomerSchema), create);
router.get(
  "/:id",
  protect,
  platformOnly,
  validate(happyCustomerIdParamsSchema, "params"),
  getById
);
router.patch(
  "/:id",
  protect,
  platformOnly,
  validate(happyCustomerIdParamsSchema, "params"),
  validate(updateHappyCustomerSchema),
  update
);
router.delete(
  "/:id",
  protect,
  platformOnly,
  validate(happyCustomerIdParamsSchema, "params"),
  remove
);

export default router;
