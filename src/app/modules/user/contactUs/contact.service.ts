import httpStatus from "http-status";
import { prisma } from "../../../../shared/prisma";
import AppError from "../../../error/AppError";
import {
  ContactUs,
  ContactUsStatus,
} from "../../../../../generated/prisma/client";

const createContactUs = async (data: ContactUs) => {
  return await prisma.contactUs.create({
    data,
  });
};

const allContactUs = async () => {
  return await prisma.contactUs.findMany();
};

const deleteContactUs = async (id: string) => {
  const existing = await prisma.contactUs.findFirst({
    where: {
      id,
    },
  });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact us not found.");
  }

  return await prisma.contactUs.delete({
    where: { id },
  });
};

const contactUsDetails = async (id: string) => {
  const result = await prisma.contactUs.findUnique({
    where: { id },
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact us not found.");
  }

  return result;
};

const updateStatus = async (id: string, status: string) => {
  const existing = await prisma.contactUs.findFirst({ where: { id } });

  if (!existing) {
    throw new AppError(httpStatus.NOT_FOUND, "Contact us not found.");
  }

  const allowedStatuses = Object.values(ContactUsStatus);

  if (!allowedStatuses.includes(status as ContactUsStatus)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `Invalid status. Allowed values: ${allowedStatuses.join(", ")}.`,
    );
  }

  return await prisma.contactUs.update({
    where: { id },
    data: { status: status as ContactUsStatus },
  });
};

export const ContactUsService = {
  createContactUs,
  allContactUs,
  deleteContactUs,
  contactUsDetails,
  updateStatus,
};
