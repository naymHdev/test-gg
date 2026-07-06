import { Router } from "express";
import { UserController } from "./user.controller";

const router = Router();

router.get("/:username/profile", UserController.getUserProfile);

export const userRoutes = router;
