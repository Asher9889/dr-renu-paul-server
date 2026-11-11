import multer from "multer";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/index.ts";

const allowedImageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedImageMimeTypes.has(file.mimetype)) {
      callback(
        new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Unsupported image type.", [
          {
            field: "file",
            message: "Only JPEG, PNG, WebP, and AVIF images are allowed.",
          },
        ]),
      );
      return;
    }
    callback(null, true);
  },
});

const allowedEbookMimeTypes = new Set(["application/pdf"]);

const bookFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedEbookMimeTypes.has(file.mimetype)) {
      callback(
        new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Unsupported file type.", [
          {
            field: "file",
            message: "Only PDF files are allowed.",
          },
        ]),
      );
      return;
    }
    callback(null, true);
  },
});

export default imageUpload;
export { bookFileUpload, imageUpload };
