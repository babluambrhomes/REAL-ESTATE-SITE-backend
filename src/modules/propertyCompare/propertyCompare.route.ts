import { Router } from "express";
import { parseQuery, validate } from "../../middlewares";
import {
  compareProperties,
  suggestPropertyPairs,
} from "./propertyCompare.controller";
import {
  comparePropertiesSchema,
  suggestPropertiesQuerySchema,
} from "./propertyCompare.validation";

const router = Router();

router.get(
  "/compare/suggest",
  parseQuery(suggestPropertiesQuerySchema),
  suggestPropertyPairs
);
router.post("/compare", validate(comparePropertiesSchema), compareProperties);

export default router;
