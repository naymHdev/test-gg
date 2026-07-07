import httpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { adminService } from "./admin.service";
import pick from "../../utils/pick";
import { PAGINATION_KEYS } from "../../helpers/paginate";

const getAllUsers = catchAsync(async (req, res) => {
  const query = pick(req.query, ["searchTerm", "username", "email", "region"]);
  const options = pick(req.query, PAGINATION_KEYS);
  const result = await adminService.getAllUsersFromDB(options, query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    data: result.data,
    meta: result.meta,
  });
});
export const adminController = {
  getAllUsers,
};
