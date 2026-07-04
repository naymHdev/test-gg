import { Router } from "express";
import { userController } from "./user.controller";
import auth from "../../middleware/auth";
import { Role } from "../../../../generated/prisma/enums";
import { uploadFactory } from "../../helpers/uploadFactory";

const router = Router();

router.get(
  "/my-account",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  userController.myAccount,
);

router.patch(
  "/update-my-profile",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  userController.updateMyProfile,
);

router.patch(
  "/update-avatar",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  uploadFactory({ type: "image", maxFiles: 1 }).single("profileImg"),
  userController.updateProfileImg,
);

router.patch(
  "/update-location",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  userController.updateMyLocation,
);

router.get(
  "/explore-contents",
  auth(Role.Admin, Role.SUPER_ADMIN, Role.Vendor, Role.User),
  userController.exploreAllContents,
);

router.get(
  "/my-recent-bookings",
  auth(Role.Vendor, Role.User),
  userController.myRecentBookings,
);

router.patch(
  "/cancel-booking/:bookingId",
  auth(Role.Vendor, Role.User),
  userController.cancelBooking,
);

router.get("/all-contact-us", userController.allContactUs);
router.post("/create-contact-us", userController.createContactUs);
router.patch("/update-contact-us/:id", userController.updateStatus);
router.delete("/delete-contact-us/:id", userController.deleteContactUs);
router.get("/contact-us-details/:id", userController.contactUsDetails);

export const userRoutes = router;
