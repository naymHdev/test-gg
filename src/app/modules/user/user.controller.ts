import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { userService } from "./user.service";
import { uploadToS3 } from "../../utils/s3";
import pick from "../../utils/pick";
import { PAGINATION_KEYS } from "../../helpers/paginate";
import AppError from "../../error/AppError";
import { ContactUsService } from "./contactUs/contact.service";

const myAccount = catchAsync(async (req, res) => {
  // @ts-ignore
  const result = await userService.myAccount(req.user?.id!);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User fetched successfully",
    data: result,
  });
});

const updateMyProfile = catchAsync(async (req, res) => {
  // @ts-ignore
  const result = await userService.updateMyProfile(req.user?.id!, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User updated successfully",
    data: result,
  });
});

const updateProfileImg = catchAsync(async (req, res) => {
  const user = req.user;
  const body = req.body;
  const file = req.file;

  let url;
  if (file) {
    const upload = await uploadToS3({
      file,
      fileName: `${Date.now()}-${file.originalname}`,
    });
    url = upload;
  }

  body.url = url;
  body.key = `${Date.now()}-${file?.originalname}`;
  body.userId = user.id!;

  const result = await userService.updateProfileImg(body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile image updated successfully.",
    data: result,
  });
});

const updateMyLocation = catchAsync(async (req, res) => {
  const id = req.user.id!;

  const result = await userService.updateMyLocation(req.body, id as any);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Location updated.",
    data: result,
  });
});

const exploreAllContents = catchAsync(async (req, res) => {
  const userId = req.user.id!;
  const options = pick(req.query, PAGINATION_KEYS);

  const result = await userService.exploreAllContentsFromDB(
    userId as any,
    options,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All contents fetched.",
    data: result.data,
    meta: result.meta,
  });
});

const myRecentBookings = catchAsync(async (req, res) => {
  const userId = req.user.id!;
  const { status } = req.query;
  const result = await userService.myRecentBookings(userId, status as any);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Recent bookings fetched successfully",
    data: result,
  });
});

const cancelBooking = catchAsync(async (req, res) => {
  const { bookingId } = req.params;
  const { reason, note } = req.body;
  const user = req.user;

  if (!reason) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Cancellation reason is required",
    );
  }

  const result = await userService.cancelBooking(
    bookingId as string,
    user?.id!,
    reason,
    note,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Booking cancelled successfully",
    data: result,
  });
});

const createContactUs = catchAsync(async (req, res) => {
  const result = await ContactUsService.createContactUs(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Your message has been sent successfully",
    data: result,
  });
});

const allContactUs = catchAsync(async (req, res) => {
  const result = await ContactUsService.allContactUs();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact us fetched successfully",
    data: result,
  });
});

const deleteContactUs = catchAsync(async (req, res) => {
  const result = await ContactUsService.deleteContactUs(
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact us deleted successfully",
    data: result,
  });
});

const contactUsDetails = catchAsync(async (req, res) => {
  const result = await ContactUsService.contactUsDetails(
    req.params.id as string,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact us fetched successfully",
    data: result,
  });
});

const updateStatus = catchAsync(async (req, res) => {
  const result = await ContactUsService.updateStatus(
    req.params.id as string,
    req.body.status,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Contact us updated successfully",
    data: result,
  });
});

export const userController = {
  myAccount,
  updateMyProfile,
  updateProfileImg,
  updateMyLocation,
  exploreAllContents,
  myRecentBookings,
  cancelBooking,

  createContactUs,
  allContactUs,
  deleteContactUs,
  contactUsDetails,
  updateStatus,
};
