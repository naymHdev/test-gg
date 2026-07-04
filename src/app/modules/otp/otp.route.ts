import { Router } from "express";
import { otpController } from "./otp.contrtoller";

const router = Router();

router.post("/verify-otp",  otpController.verifyOtp);
router.post("/resend-otp", otpController.resendOtp);

export const otpRoutes = router;
