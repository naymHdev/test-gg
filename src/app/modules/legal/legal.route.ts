import { Router } from "express";
import { legalController } from "./legal.controller";
import optionalAuth from "../../middleware/optionalAuth";

const router = Router();

router.get("/privacy-policy", optionalAuth, legalController.getPrivacyPolicy);
router.get("/terms", optionalAuth, legalController.getTerms);

export const legalRouter = router;
