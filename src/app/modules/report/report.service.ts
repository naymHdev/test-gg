import httpStatus from "http-status";
import AppError from "../../error/AppError";
import { prisma } from "../../../shared/prisma";
import QueryBuilder from "../../builder/QueryBuilder";
import {
  ReportTargetType,
  ReportStatus,
  NotificationType,
} from "../../../../generated/prisma/client";
import { CreateReportInput } from "./report.validation";

// ─── Report submission ──────────────────────────────────────────────────────

const createReportIntoDB = async (
  reporterId: string,
  payload: CreateReportInput,
) => {
  return prisma.$transaction(async (tx) => {
    let reportedUserId: string;
    let postId: string | null = null;
    let mediaPostId: string | null = null;
    let snapshot: any;

    if (payload.targetType === ReportTargetType.Profile) {
      const reportedUser = await tx.user.findUnique({
        where: { id: payload.targetId },
      });
      if (!reportedUser) {
        throw new AppError(httpStatus.NOT_FOUND, "Reported user not found");
      }
      reportedUserId = reportedUser.id;
      snapshot = {
        username: reportedUser.username,
        status: reportedUser.status,
      };
    } else if (payload.targetType === ReportTargetType.Post) {
      const post = await tx.post.findUnique({
        where: { id: payload.targetId },
      });
      if (!post || post.deletedAt) {
        throw new AppError(httpStatus.NOT_FOUND, "Reported post not found");
      }
      reportedUserId = post.userId;
      postId = post.id;
      snapshot = { content: post.content, region: post.region };
    } else {
      const mediaPost = await tx.mediaPost.findUnique({
        where: { id: payload.targetId },
      });
      if (!mediaPost || mediaPost.deletedAt) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "Reported media post not found",
        );
      }
      reportedUserId = mediaPost.userId;
      mediaPostId = mediaPost.id;
      snapshot = { title: mediaPost.title, imageUrl: mediaPost.imageUrl };
    }

    if (reportedUserId === reporterId) {
      throw new AppError(httpStatus.BAD_REQUEST, "You cannot report yourself");
    }

    const existingPendingReport = await tx.report.findFirst({
      where: {
        reporterId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        status: ReportStatus.Pending,
      },
    });

    if (existingPendingReport) {
      throw new AppError(
        httpStatus.CONFLICT,
        "You have already reported this and it is pending review",
      );
    }

    return tx.report.create({
      data: {
        reporterId,
        reportedUserId,
        targetType: payload.targetType,
        targetId: payload.targetId,
        postId,
        mediaPostId,
        reason: payload.reason,
        details: payload.details,
        snapshot,
      },
    });
  });
};

// ─── Listing ─────────────────────────────────────────────────────────────────

const getReportsFromDB = async (query: Record<string, unknown>) => {
  const queryBuilder = new QueryBuilder(query).filter().sort().paginate();

  const options = queryBuilder.build();

  const reports = await prisma.report.findMany({
    ...options,
    include: {
      reporter: { select: { id: true, username: true } },
      reportedUser: { select: { id: true, username: true, status: true } },
      resolvedBy: { select: { id: true, username: true } },
    },
  });

  const meta = await queryBuilder.countTotal(prisma.report);
  return { reports, meta };
};

const getReportByIdFromDB = async (reportId: string) => {
  return prisma.report.findUniqueOrThrow({
    where: { id: reportId },
    include: {
      reporter: { select: { id: true, username: true } },
      reportedUser: { select: { id: true, username: true, status: true } },
      resolvedBy: { select: { id: true, username: true } },
      post: true,
      mediaPost: true,
    },
  });
};

// ─── Resolution ──────────────────────────────────────────────────────────────

const finalizeReportInDB = async (
  reportId: string,
  resolverId: string,
  status: typeof ReportStatus.Resolved | typeof ReportStatus.Dismissed,
) => {
  return prisma.$transaction(async (tx) => {
    const report = await tx.report.findUniqueOrThrow({
      where: { id: reportId },
    });

    if (report.status !== ReportStatus.Pending) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        `This report has already been ${report.status.toLowerCase()}`,
      );
    }

    const updatedReport = await tx.report.update({
      where: { id: reportId },
      data: { status, resolvedById: resolverId, resolvedAt: new Date() },
    });

    await tx.notification.create({
      data: {
        userId: report.reporterId,
        type: NotificationType.report_resolved,
        title:
          status === ReportStatus.Resolved
            ? "Your report has been resolved"
            : "Your report has been reviewed",
        body:
          status === ReportStatus.Resolved
            ? "Action has been taken based on your report. Thanks for helping keep the community safe."
            : "After review, no action was taken on your report.",
        data: { reportId: report.id, targetType: report.targetType, status },
      },
    });

    return updatedReport;
  });
};

const resolveReportInDB = (reportId: string, resolverId: string) =>
  finalizeReportInDB(reportId, resolverId, ReportStatus.Resolved);

const dismissReportInDB = (reportId: string, resolverId: string) =>
  finalizeReportInDB(reportId, resolverId, ReportStatus.Dismissed);

export const reportService = {
  createReportIntoDB,
  getReportsFromDB,
  getReportByIdFromDB,
  resolveReportInDB,
  dismissReportInDB,
};
