import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { riotService } from "./riot.service";

const startLink = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { riotId, platform } = req.body;
  const result = await riotService.startLink(userId, riotId, platform);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Change your League profile icon to the one shown, then verify",
    data: result,
  });
});

const getPending = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await riotService.getPendingChallenge(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: result ? "Pending verification found" : "No pending verification",
    data: result,
  });
});

const verifyLink = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const result = await riotService.verifyLink(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Riot account verified and linked",
    data: result,
  });
});

export const riotController = { startLink, getPending, verifyLink };
