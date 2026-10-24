import multer from "multer";
import { StatusCodes } from "http-status-codes";
import { ApiError } from "../utils/index.ts";

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
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

export default upload;
