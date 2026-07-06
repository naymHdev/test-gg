import multer from "multer";
import { memoryStorage } from "multer";

type UploadType = "image" | "file" | "mixed";

interface UploadOptions {
  type?: UploadType;
  maxFileSizeMB?: number;
  maxFiles?: number;
}

const storage = memoryStorage();

const MIME_TYPES = {
  image: ["image/jpeg", "image/png", "image/jpg", "image/webp"],
  file: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "application/zip",
  ],
};

export const uploadFactory = ({
  type = "file",
  maxFileSizeMB = 100,
  maxFiles = 1,
}: UploadOptions) =>
  multer({
    storage,
    limits: {
      fileSize: maxFileSizeMB * 1024 * 1024,
      files: maxFiles,
    },
    fileFilter: (req, file, cb) => {
      if (type === "image") {
        return MIME_TYPES.image.includes(file.mimetype)
          ? cb(null, true)
          : cb(new Error("Only image files are allowed"));
      }

      if (type === "file") {
        return MIME_TYPES.image.includes(file.mimetype)
          ? cb(new Error("Image files are not allowed"))
          : cb(null, true);
      }

      // mixed
      const isImage = MIME_TYPES.image.includes(file.mimetype);
      const isFile = MIME_TYPES.file.includes(file.mimetype);

      if (isImage || isFile) {
        cb(null, true);
      } else {
        cb(new Error("Unsupported file type"));
      }
    },
  });
