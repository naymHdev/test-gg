import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import httpStatus from 'http-status';
import AppError from '../error/AppError';
import config from '../config';
import path from 'path';
import multer, { memoryStorage } from 'multer';
import { s3Client } from '../constants/aws';

//upload a single file

interface UploadParams {
  file: Express.Multer.File;
  fileName: string;
}

// -------------------------- Multer File Upload --------------------------
const storage = memoryStorage();
export const uploadMulter = multer({ storage });

// -------------------------- Create s3 bucket -- Start ------------------------
export const uploadToS3 = async ({
  file,
  fileName,
}: UploadParams): Promise<string | null> => {
  const extension = path.extname(file.originalname) || '';
  const finalFileName = `${fileName}${extension}`;

  const command = new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: finalFileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  try {
    const key = await s3Client.send(command);
    if (!key) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        'File Upload failed, fix command',
      );
    }

    const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${finalFileName}`;

    return url;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, 'File Upload failed!');
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
    console.log('🚀 ~ deleteFromS3 ~ error:', error);
    throw new Error('s3 file delete failed');
  }
};

// upload multiple files

export const uploadManyToS3 = async (
  files: {
    file: any;
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

        const command = new PutObjectCommand({
          Bucket: config.aws.bucket as string,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          // ACL: 'public-read',
        });

        await s3Client.send(command);

        const url = `https://${config.aws.bucket}.s3.${config.aws.region}.amazonaws.com/${fileKey}`;

        return { url, key: newFileName };
      },
    );

    const uploadedUrls = await Promise.all(uploadPromises);
    return uploadedUrls;
  } catch (error) {
    console.error('❌ File upload failed:', error);
    throw new Error('File upload failed');
  }
};

export const deleteManyFromS3 = async (keys: string[]) => {
  try {
    const deleteParams = {
      Bucket: config.aws.bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
        Quiet: false,
      },
    };

    const command = new DeleteObjectsCommand(deleteParams);

    const response = await s3Client.send(command);

    return response;
  } catch (error) {
    console.error('Error deleting S3 files:', error);
    throw new AppError(httpStatus.BAD_REQUEST, 'S3 file delete failed');
  }
};
