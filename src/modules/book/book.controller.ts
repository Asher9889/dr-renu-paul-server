import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import { envConfig } from "../../config/index.ts";
import { ApiError, ApiResponse } from "../../utils/index.ts";
import type { IUser } from "../user/user.types.ts";
import {
  BOOK_MESSAGES,
  BOOK_PROCESSING_MESSAGES,
  BOOK_PURCHASE_MESSAGES,
  BOOK_PURCHASE_STATUS,
} from "./book.constant.ts";
import type { BookMediaService } from "./book.media.service.ts";
import type { BookReaderService } from "./book.reader.service.ts";
import type { BookService } from "./book.service.ts";
import type {
  TAdminBookListQuery,
  TAdminBookParams,
  TBookBuyer,
  TCreateBookPayload,
  TPublicBookListQuery,
  TPublicBookParams,
  TReaderPageParams,
  TUpdateBookPayload,
} from "./book.types.ts";

export class BookController {
  private readonly bookService: BookService;
  private readonly mediaService: BookMediaService;
  private readonly readerService: BookReaderService;

  constructor(
    bookService: BookService,
    mediaService: BookMediaService,
    readerService: BookReaderService,
  ) {
    this.bookService = bookService;
    this.mediaService = mediaService;
    this.readerService = readerService;
  }

  private getBuyer = (req: Request): TBookBuyer => {
    const user = req.validatedUser as (IUser & { _id?: unknown }) | undefined;
    const rawId = user ? String(user._id ?? user.id ?? "") : "";

    return {
      userId: rawId && mongoose.Types.ObjectId.isValid(rawId) ? rawId : null,
      role: user?.role ?? null,
    };
  };

  getPublicBooks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as TPublicBookListQuery;
      const result = await this.bookService.getPublicBooks(query);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOKS_FETCHED, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };

  getPublicBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const book = await this.bookService.getPublicBook(slug);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_FETCHED, book);
    } catch (error) {
      next(error);
    }
  };

  getBookReader = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const reader = await this.readerService.getReader(slug, this.getBuyer(req));
      return ApiResponse.success(res, StatusCodes.OK, BOOK_PURCHASE_MESSAGES.READER_FETCHED, reader);
    } catch (error) {
      next(error);
    }
  };

  getBookAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const result = await this.readerService.getAccess(slug, this.getBuyer(req));
      return ApiResponse.success(res, StatusCodes.OK, BOOK_PURCHASE_MESSAGES.ACCESS_FETCHED, result);
    } catch (error) {
      next(error);
    }
  };

  serveReaderPage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug, pageNumber } = req.validatedParams as TReaderPageParams;
      const page = await this.readerService.getPage(slug, pageNumber, this.getBuyer(req));

      res.setHeader("Content-Type", page.contentType);
      res.setHeader("Cache-Control", page.cacheControl);
      res.setHeader("Content-Length", String(page.body.byteLength));
      res.setHeader("X-Content-Type-Options", "nosniff");

      return res.status(StatusCodes.OK).send(Buffer.from(page.body));
    } catch (error) {
      next(error);
    }
  };

  purchaseBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const buyer = this.getBuyer(req);

      const result = await this.readerService.purchase(slug, buyer);
      const message =
        result.purchase.status === BOOK_PURCHASE_STATUS.PAID
          ? BOOK_PURCHASE_MESSAGES.PURCHASE_COMPLETED
          : BOOK_PURCHASE_MESSAGES.PURCHASE_CREATED;

      return ApiResponse.success(res, StatusCodes.CREATED, message, result);
    } catch (error) {
      next(error);
    }
  };

  createPurchaseOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const buyer = this.getBuyer(req);

      const result = await this.readerService.createPurchaseOrder(slug, buyer);

      return ApiResponse.success(res, StatusCodes.CREATED, BOOK_PURCHASE_MESSAGES.ORDER_CREATED, result);
    } catch (error) {
      next(error);
    }
  };

  verifyPurchase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.validatedParams as TPublicBookParams;
      const buyer = this.getBuyer(req);
      const payload = req.validatedBody as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };

      const result = await this.readerService.verifyPurchase(slug, buyer, {
        orderId: payload.razorpay_order_id,
        paymentId: payload.razorpay_payment_id,
        signature: payload.razorpay_signature,
      });

      return ApiResponse.success(res, StatusCodes.OK, BOOK_PURCHASE_MESSAGES.PAYMENT_VERIFIED, result);
    } catch (error) {
      next(error);
    }
  };

  listPurchases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buyer = this.getBuyer(req);
      if (!buyer.userId) {
        throw new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required.");
      }
      const purchases = await this.readerService.listPurchases(buyer.userId);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_PURCHASE_MESSAGES.PURCHASES_FETCHED, purchases);
    } catch (error) {
      next(error);
    }
  };

  serveMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawKey = (req.params as Record<string, unknown>).key;
      const key = Array.isArray(rawKey) ? rawKey.join("/") : String(rawKey ?? "");

      if (!key.startsWith("books/covers/")) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Media not found.");
      }

      const object = await this.mediaService.getObject(key);

      res.setHeader("Content-Type", object.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Length", String(object.body.byteLength));
      res.setHeader("X-Content-Type-Options", "nosniff");

      return res.status(StatusCodes.OK).send(Buffer.from(object.body));
    } catch (error) {
      next(error);
    }
  };

  getAdminBooks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.validatedQuery as TAdminBookListQuery;
      const result = await this.bookService.getAdminBooks(query);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOKS_FETCHED, result.data, result.meta);
    } catch (error) {
      next(error);
    }
  };

  getAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const book = await this.bookService.getAdminBook(id);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_FETCHED, book);
    } catch (error) {
      next(error);
    }
  };

  createAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.validatedBody as TCreateBookPayload;
      const book = await this.bookService.createBook(payload);
      return ApiResponse.success(res, StatusCodes.CREATED, BOOK_MESSAGES.BOOK_CREATED, book);
    } catch (error) {
      next(error);
    }
  };

  updateAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const payload = req.validatedBody as TUpdateBookPayload;
      const book = await this.bookService.updateBook(id, payload);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_UPDATED, book);
    } catch (error) {
      next(error);
    }
  };

  reprocessAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const book = await this.bookService.reprocessBook(id);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_PROCESSING_MESSAGES.QUEUED, book);
    } catch (error) {
      next(error);
    }
  };

  publishAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const payload = req.validatedBody as { publishedAt?: string };
      const book = await this.bookService.publishBook(id, payload);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_PUBLISHED, book);
    } catch (error) {
      next(error);
    }
  };

  unpublishAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const book = await this.bookService.unpublishBook(id);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_UNPUBLISHED, book);
    } catch (error) {
      next(error);
    }
  };

  archiveAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      const book = await this.bookService.archiveBook(id);
      return ApiResponse.success(res, StatusCodes.OK, BOOK_MESSAGES.BOOK_ARCHIVED, book);
    } catch (error) {
      next(error);
    }
  };

  deleteAdminBook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.validatedParams as TAdminBookParams;
      await this.bookService.deleteBook(id);
      return ApiResponse.noContent(res);
    } catch (error) {
      next(error);
    }
  };

  uploadCover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Image is required.", [
          { field: "file", message: "Please choose an image to upload." },
        ]);
      }
      const media = await this.mediaService.uploadCover(req.file);
      return ApiResponse.success(res, StatusCodes.CREATED, BOOK_MESSAGES.MEDIA_UPLOADED, media);
    } catch (error) {
      next(error);
    }
  };

  uploadEbook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "File is required.", [
          { field: "file", message: "Please choose an ebook file to upload." },
        ]);
      }
      const media = await this.mediaService.uploadEbook(req.file);
      return ApiResponse.success(res, StatusCodes.CREATED, BOOK_MESSAGES.MEDIA_UPLOADED, media);
    } catch (error) {
      next(error);
    }
  };
}
