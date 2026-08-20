import { Router } from "express";
import { searchProperties } from "./search.controller";
import { validate } from "../../middlewares";
import { searchQuerySchema } from "./search.validation";

const router = Router();

router.get("/properties", validate(searchQuerySchema), searchProperties);

export default router;
