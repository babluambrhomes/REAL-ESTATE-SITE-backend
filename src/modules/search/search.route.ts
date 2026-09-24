import { Router } from "express";
import { searchProperties, searchSuggestions } from "./search.controller";
import { validate, apiRateLimit } from "../../middlewares";
import { searchQuerySchema, suggestionsQuerySchema } from "./search.validation";

const router = Router();

router.get("/properties", validate(searchQuerySchema, "query"), searchProperties);
router.get(
  "/suggestions",
  apiRateLimit,
  validate(suggestionsQuerySchema, "query"),
  searchSuggestions
);

export default router;
