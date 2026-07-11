import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { walletService } from "./wallet.service";

const myWallet = catchAsync(async (req, res) => {
  const result = await walletService.myWallet(req.user.id as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My wallet retrieved successfully",
    data: result,
  });
});

const myTransactions = catchAsync(async (req, res) => {
  const { transactions, meta } = await walletService.myTransactions(
    req.user.id as string,
    req.query,
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My wallet retrieved successfully",
    meta,
    data: transactions,
  });
});

export const walletController = {
  myWallet,
  myTransactions,
};
