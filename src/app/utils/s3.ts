import { DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import httpStatus from "http-status";
import AppError from "../error/AppError";
import config from "../config";
import path from "path";
import fs from "fs";
import multer, { memoryStorage } from "multer";
import { s3Client } from "../constants/aws";

interface UploadParams {
  file: Express.Multer.File;
  fileName: string;
}

// -------------------------- Multer File Upload --------------------------
const storage = memoryStorage();
export const uploadMulter = multer({ storage });

// -------------------------- Multer File Upload (disk, for large files/video) --------------------------
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "tmp/uploads";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${Math.floor(Math.random() * 1e6)}${path.extname(file.originalname)}`,
    );
  },
});
export const uploadMulterDisk = multer({ storage: diskStorage });

// -------------------------- Single File Upload (multipart) --------------------------
export const uploadToS3 = async ({
  file,
  fileName,
}: UploadParams): Promise<string | null> => {
  const extension = path.extname(file.originalname) || "";
  const finalFileName = `${fileName}${extension}`;

  try {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: config.aws.bucket,
        Key: finalFileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
      queueSize: 4,
      partSize: 5 * 1024 * 1024, // 5MB per part
      leavePartsOnError: false,
    });

    await upload.done();

    const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${finalFileName}`;
    return url;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, "File Upload failed!");
  }
};

// delete file from s3 bucket
export const deleteFromS3 = async (key: string) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.aws.bucket,
      Key: key,
    });
    await s3Client.send(command);
  } catch (error) {
    console.log("🚀 ~ deleteFromS3 ~ error:", error);
    throw new Error("s3 file delete failed");
  }
};

// -------------------------- Multiple File Upload (multipart, parallel) --------------------------
export const uploadManyToS3 = async (
  files: {
    file: Express.Multer.File;
    path: string;
    key?: string;
  }[],
): Promise<{ url: string; key: string }[]> => {
  try {
    const uploadPromises = files.map(
      async ({ file, path: folderPath, key }) => {
        const fileExtension = path.extname(file.originalname);
        const newFileName = key
          ? key
          : `${Math.floor(100000 + Math.random() * 900000)}-${Date.now()}${fileExtension}`;
        const fileKey = `${folderPath}/${newFileName}`;

        const body = file.path ? fs.createReadStream(file.path) : file.buffer;

        const upload = new Upload({
          client: s3Client,
          params: {
            Bucket: config.aws.bucket as string,
            Key: fileKey,
            Body: body,
            ContentType: file.mimetype,
          },
          queueSize: 4,
          partSize: 5 * 1024 * 1024,
          leavePartsOnError: false,
        });

        await upload.done();

        // temp file cleanup (disk storage hole)
        if (file.path) {
          fs.unlink(file.path, () => {});
        }

        const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${fileKey}`;

        return { url, key: newFileName };
      },
    );

    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls;
  } catch (error) {
    console.error("❌ File upload failed:", error);
    throw new Error("File upload failed");
  }
};

export const deleteManyFromS3 = async (keys: string[]) => {
  try {
    const deleteParams = {
      Bucket: config.aws.bucket,
      Delete: {
        Objects: keys.map((key) => ({ Key: key })),
        Quiet: false,
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);
    const response = await s3Client.send(command);

    return response;
  } catch (error) {
    console.error("Error deleting S3 files:", error);
    throw new AppError(httpStatus.BAD_REQUEST, "S3 file delete failed");
  }
};
