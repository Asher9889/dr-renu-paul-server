import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { StatusCodes } from "http-status-codes";
import sharp from "sharp";
import { envConfig, s3Client } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import {
  BLOG_ALLOWED_IMAGE_TYPES,
  BLOG_LIMITS,
  BLOG_MEDIA_KEY_PATTERN,
} from "./blog.constant.ts";

interface TUploadedMedia {
  url: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

interface TMediaObject {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
}

function isAllowedMimeType(
  mimeType: string,
): mimeType is keyof typeof BLOG_ALLOWED_IMAGE_TYPES {
  return Object.prototype.hasOwnProperty.call(
    BLOG_ALLOWED_IMAGE_TYPES,
    mimeType,
  );
}

function buildMediaUrl(key: string, requestBaseUrl: string): string {
  const encodedBucket = encodeURIComponent(envConfig.minio.bucketName);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");

  if (envConfig.minio.mediaMode === "proxy") {
    return `${envConfig.apiPublicUrl || requestBaseUrl}/api/v1/blog/media/${encodedKey}`;
  }

  return `${envConfig.minio.publicUrl}/${encodedBucket}/${encodedKey}`;
}

function isObjectNotFound(error: unknown): boolean {
  const value = error as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };

  return (
    value.name === "NoSuchKey" ||
    value.name === "NotFound" ||
    value.$metadata?.httpStatusCode === 404
  );
}

export class BlogMediaService {uploadImage = async (file: Express.Multer.File): Promise<TUploadedMedia> => {
    if (file.size > BLOG_LIMITS.MAX_UPLOAD_BYTES) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Image is too large.", [
        { field: "file", message: "Images must be 8 MB or smaller." },
      ]);
    }

    const detectedType = await fileTypeFromBuffer(file.buffer);

    if (!detectedType || !isAllowedMimeType(detectedType.mime)) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY,"Unsupported image type.",
        [
          {
            field: "file",
            message: "Only JPEG, PNG, WebP, and AVIF images are allowed.",
          },
        ],
      );
    }

    let width: number | undefined;
    let height: number | undefined;

    try {
      const metadata = await sharp(file.buffer).metadata();
      width = metadata.width;
      height = metadata.height;
    } catch {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Invalid image file.", [
        { field: "file", message: "The uploaded file is not a valid image." },
      ]);
    }

    if (!width || !height) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Invalid image file.", [
        {
          field: "file",
          message: "The image dimensions could not be determined.",
        },
      ]);
    }

    const extension = BLOG_ALLOWED_IMAGE_TYPES[detectedType.mime].extension;
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const key = `blog/${year}/${month}/${randomUUID()}.${extension}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: envConfig.minio.bucketName,
          Key: key,
          Body: file.buffer,
          ContentType: detectedType.mime,
          CacheControl: "public, max-age=31536000, immutable",
          ContentDisposition: "inline",
        }),
      );
    } catch {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "The image could not be stored.",
      );
    }

    return {
      url: buildMediaUrl(key, envConfig.minio.publicUrl),
      width,
      height,
      mimeType: detectedType.mime,
      sizeBytes: file.size,
    };
  };

  getMediaObject = async (
    folder: string,
    year: string,
    month: string,
    filename: string,
  ): Promise<TMediaObject> => {
    const key = `${folder}/${year}/${month}/${filename}`;

    if (folder !== "blog" || !BLOG_MEDIA_KEY_PATTERN.test(key)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Media not found.");
    }

    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: envConfig.minio.bucketName,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Media not found.");
      }

      const body = await response.Body.transformToByteArray();

      return {
        body,
        contentType: response.ContentType || "application/octet-stream",
        cacheControl:
          response.CacheControl || "public, max-age=31536000, immutable",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (isObjectNotFound(error)) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Media not found.");
      }

      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "The media could not be loaded.",
      );
    }
  };
}
