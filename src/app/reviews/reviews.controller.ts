import httpStatus from "http-status";
import catchAsync from "../utils/catchAsync";
import sendResponse from "../utils/sendResponse";
import { reviewsService } from "./reviews.service";

const createPlayerReview = catchAsync(async (req, res) => {
  const result = await reviewsService.createPlayerReviewFromDB(
    req.params.id as string,
    req.user.id,
    req.body,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Player reviews retrieves successfully.",
    data: result,
  });
});

const findPlayerReviews = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await reviewsService.findPlayerReviews(id as string);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Player reviews retrieves successfully.",
    data: result,
  });
});

export const reviewsController = {
  findPlayerReviews,
  createPlayerReview,
};
