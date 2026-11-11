import { randomUUID } from "node:crypto";
import { DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { StatusCodes } from "http-status-codes";
import sharp from "sharp";
import { envConfig, logger, s3Client } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import { BOOK_ALLOWED_COVER_TYPES, BOOK_ALLOWED_EBOOK_TYPES, BOOK_LIMITS } from "./book.constant.ts";

interface TUploadedCover {
  url: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

interface TUploadedEbook {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

interface TStoredObject {
  body: Uint8Array;
  contentType: string;
  cacheControl: string;
}

export interface TUploadedPageImage {
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
}

function isAllowedCoverType(mimeType: string): mimeType is keyof typeof BOOK_ALLOWED_COVER_TYPES {
  return Object.prototype.hasOwnProperty.call(BOOK_ALLOWED_COVER_TYPES, mimeType);
}

function isAllowedEbookType(mimeType: string): mimeType is keyof typeof BOOK_ALLOWED_EBOOK_TYPES {
  return Object.prototype.hasOwnProperty.call(BOOK_ALLOWED_EBOOK_TYPES, mimeType);
}

function buildMediaUrl(key: string): string {
  const encodedBucket = encodeURIComponent(envConfig.minio.bucketName);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (envConfig.minio.mediaMode === "proxy") {
    return `${envConfig.apiPublicUrl}/api/v1/books/media/${encodedKey}`;
  }
  return `${envConfig.minio.publicUrl}/${encodedBucket}/${encodedKey}`;
}

function isObjectNotFound(error: unknown): boolean {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return value.name === "NoSuchKey" || value.name === "NotFound" || value.$metadata?.httpStatusCode === 404;
}

export class BookMediaService {
  uploadCover = async (file: Express.Multer.File): Promise<TUploadedCover> => {
    if (file.size > BOOK_LIMITS.MAX_COVER_BYTES) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Image is too large.", [
        { field: "file", message: "Cover images must be 8 MB or smaller." },
      ]);
    }

    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (!detectedType || !isAllowedCoverType(detectedType.mime)) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Unsupported image type.", [
        { field: "file", message: "Only JPEG, PNG, WebP, and AVIF images are allowed." },
      ]);
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
        { field: "file", message: "The image dimensions could not be determined." },
      ]);
    }

    const extension = BOOK_ALLOWED_COVER_TYPES[detectedType.mime].extension;
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const key = `books/covers/${year}/${month}/${randomUUID()}.${extension}`;

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
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "The image could not be stored.");
    }

    return {
      url: buildMediaUrl(key),
      width,
      height,
      mimeType: detectedType.mime,
      sizeBytes: file.size,
    };
  };

  uploadEbook = async (file: Express.Multer.File): Promise<TUploadedEbook> => {
    if (file.size > BOOK_LIMITS.MAX_EBOOK_BYTES) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "File is too large.", [
        { field: "file", message: "Ebook files must be 50 MB or smaller." },
      ]);
    }

    const detectedType = await fileTypeFromBuffer(file.buffer);
    if (!detectedType || !isAllowedEbookType(detectedType.mime)) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Unsupported file type.", [
        { field: "file", message: "Only PDF files are allowed." },
      ]);
    }

    const extension = BOOK_ALLOWED_EBOOK_TYPES[detectedType.mime].extension;
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const storageKey = `books/private/${year}/${month}/${randomUUID()}.${extension}`;

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: envConfig.minio.bucketName,
          Key: storageKey,
          Body: file.buffer,
          ContentType: detectedType.mime,
          CacheControl: "private, max-age=0",
          ContentDisposition: `attachment; filename="${file.originalname}"`,
        }),
      );
    } catch {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "The ebook could not be stored.");
    }

    return {
      storageKey,
      fileName: file.originalname,
      mimeType: detectedType.mime,
      sizeBytes: file.size,
    };
  };

  uploadPageImage = async (
    bookId: string,
    pageNumber: number,
    body: Buffer,
    width: number,
    height: number,
  ): Promise<TUploadedPageImage> => {
    const storageKey = `books/pages/${bookId}/page-${String(pageNumber).padStart(4, "0")}.webp`;
    const optimized = await sharp(body).webp({ quality: 82 }).toBuffer();

    try {
      await s3Client.send(
        new PutObjectCommand({
          Bucket: envConfig.minio.bucketName,
          Key: storageKey,
          Body: optimized,
          ContentType: "image/webp",
          CacheControl: "private, max-age=31536000, immutable",
          ContentDisposition: "inline",
        }),
      );
    } catch {
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "The rendered page could not be stored.");
    }

    return {
      storageKey,
      width,
      height,
      mimeType: "image/webp",
      sizeBytes: optimized.byteLength,
    };
  };

  getObject = async (storageKey: string): Promise<TStoredObject> => {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({
          Bucket: envConfig.minio.bucketName,
          Key: storageKey,
        }),
      );

      if (!response.Body) {
        throw new ApiError(StatusCodes.NOT_FOUND, "File not found.");
      }

      return {
        body: await response.Body.transformToByteArray(),
        contentType: response.ContentType || "application/octet-stream",
        cacheControl: response.CacheControl || "private, max-age=0",
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (isObjectNotFound(error)) throw new ApiError(StatusCodes.NOT_FOUND, "File not found.");
      throw new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "The file could not be loaded.");
    }
  };

  getEbookBuffer = async (storageKey: string): Promise<Buffer> => {
    const object = await this.getObject(storageKey);
    return Buffer.from(object.body);
  };

  /**
   * Best-effort removal of stored objects. Never throws so database cleanup can
   * complete even when object storage is temporarily unavailable.
   */
  removeObjects = async (keys: Array<string | null | undefined>): Promise<void> => {
    const uniqueKeys = [...new Set(keys.filter((key): key is string => Boolean(key)))];

    for (let index = 0; index < uniqueKeys.length; index += 1000) {
      const batch = uniqueKeys.slice(index, index + 1000);

      try {
        await s3Client.send(
          new DeleteObjectsCommand({
            Bucket: envConfig.minio.bucketName,
            Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
          }),
        );
      } catch (error) {
        logger.warn({ err: error, keys: batch }, "Book media cleanup failed.");
      }
    }
  };

  /** Extracts a storage key from either a public MinIO URL or a media proxy URL. */
  storageKeyFromMediaUrl = (url: string | null | undefined): string | null => {
    if (!url) return null;
    const marker = "/books/";
    const markerIndex = url.indexOf(marker);
    if (markerIndex === -1) return null;

    try {
      return decodeURIComponent(url.slice(markerIndex + 1));
    } catch {
      return null;
    }
  };
}
