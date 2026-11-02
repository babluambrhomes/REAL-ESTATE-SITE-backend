import { Router } from "express";
import { handleMuxWebhook } from "./mux/mux.webhook.controller";


const router = Router();

router.post("/mux", handleMuxWebhook);

export default router;
