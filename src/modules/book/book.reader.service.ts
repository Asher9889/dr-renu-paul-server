import { randomUUID } from "node:crypto";
import mongoose, { type QueryFilter } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import { USER_ROLE } from "../user/user.constant.ts";
import type { TUserRole } from "../user/user.types.ts";
import {
  BOOK_PROCESSING_STATUS,
  BOOK_PURCHASE_STATUS,
  BOOK_PURCHASE_MESSAGES,
  BOOK_STATUS,
} from "./book.constant.ts";
import BookModel, { type IBook } from "./book.model.ts";
import BookPageModel from "./book-page.model.ts";
import BookPurchaseModel, { type IBookPurchase } from "./purchase/book-purchase.model.ts";
import type { BookMediaService } from "./book.media.service.ts";
import { bookPaymentService } from "./book.module.ts";
import type {
  TBookAccess,
  TBookAccessResult,
  TBookBuyer,
  TBookPurchase,
  TBookPurchaseOrderResult,
  TBookPurchaseResult,
  TBookReader,
  TReaderPage,
} from "./book.types.ts";

const FULL_ACCESS_ROLES: TUserRole[] = [USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN];

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function buildPageImageUrl(slug: string, pageNumber: number): string {
  const path = `/api/v1/books/${encodeURIComponent(slug)}/pages/${pageNumber}`;
  return envConfig.apiPublicUrl ? `${envConfig.apiPublicUrl}${path}` : path;
}

export class BookReaderService {
  private readonly mediaService: BookMediaService;

  constructor(mediaService: BookMediaService) {
    this.mediaService = mediaService;
  }

  private loadPublishedBook = async (slug: string): Promise<IBook> => {
    const book = await BookModel.findOne({
      slug,
      status: BOOK_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    });

    if (!book) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");
    }

    return book;
  };

  private buyerFilter = (buyer: TBookBuyer): QueryFilter<IBookPurchase> | null => {
    if (buyer.userId && mongoose.Types.ObjectId.isValid(buyer.userId)) {
      return { userId: new mongoose.Types.ObjectId(buyer.userId) };
    }
    return null;
  };

  private findPaidPurchase = async (bookId: mongoose.Types.ObjectId, buyer: TBookBuyer) => {
    const filter = this.buyerFilter(buyer);
    if (!filter) return null;

    return BookPurchaseModel.findOne({
      ...filter,
      bookId,
      status: BOOK_PURCHASE_STATUS.PAID,
    }).sort({ purchasedAt: -1, createdAt: -1 });
  };

  private serializePurchase = (purchase: IBookPurchase): TBookPurchase => ({
    id: String(purchase._id),
    bookId: String(purchase.bookId),
    bookSlug: purchase.bookSlug,
    userId: purchase.userId ? String(purchase.userId) : null,
    amount: purchase.amount,
    currency: purchase.currency,
    status: purchase.status,
    provider: purchase.provider,
    providerReference: purchase.providerReference,
    providerPaymentId: purchase.providerPaymentId,
    purchasedAt: toIso(purchase.purchasedAt),
    createdAt: purchase.createdAt.toISOString(),
  });

  private resolveAccess = async (book: IBook, buyer: TBookBuyer): Promise<TBookAccessResult> => {
    const totalPages = book.totalPages ?? 0;
    const freePreviewPages = Math.max(0, Math.min(book.freePreviewPages ?? 0, totalPages));
    const isStaff = buyer.role ? FULL_ACCESS_ROLES.includes(buyer.role) : false;
    const isFree = book.price <= 0;

    let purchase: IBookPurchase | null = null;
    if (!isFree && !isStaff) {
      purchase = await this.findPaidPurchase(book._id, buyer);
    }

    const purchased = Boolean(purchase);
    const hasFullAccess = isFree || isStaff || purchased;

    return {
      access: {
        hasFullAccess,
        isPreviewOnly: !hasFullAccess,
        purchased,
        price: book.price,
        currency: book.currency,
        freePreviewPages,
        totalPages,
      },
      purchase: purchase ? this.serializePurchase(purchase) : null,
    };
  };

  private assertReadable = (book: IBook): void => {
    const status = book.processing?.status ?? BOOK_PROCESSING_STATUS.IDLE;

    if (status !== BOOK_PROCESSING_STATUS.READY || book.totalPages < 1) {
      throw new ApiError(StatusCodes.CONFLICT, "This edition is still being prepared. Its pages will open shortly.");
    }
  };

  getReader = async (slug: string, buyer: TBookBuyer): Promise<TBookReader> => {
    const book = await this.loadPublishedBook(slug);
    this.assertReadable(book);

    const pageRecords = await BookPageModel.find({ bookId: book._id })
      .sort({ pageNumber: 1 })
      .lean();

    if (pageRecords.length === 0) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "This edition is still being prepared. Its pages will open shortly.",
      );
    }

    const accessResult = await this.resolveAccess(book, buyer);
    const freePreviewPages = Math.min(
      accessResult.access.freePreviewPages,
      pageRecords.length,
    );

    const pages: TReaderPage[] = pageRecords.map((page) => {
      const locked = !accessResult.access.hasFullAccess && page.pageNumber > freePreviewPages;

      return {
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        locked,
        imageUrl: locked ? null : buildPageImageUrl(book.slug, page.pageNumber),
      };
    });

    return {
      book: {
        id: String(book._id),
        slug: book.slug,
        title: book.title,
        subtitle: book.subtitle,
        author: book.author,
        description: book.description,
        cover: book.cover
          ? {
              url: book.cover.url,
              alt: book.cover.alt,
              width: book.cover.width,
              height: book.cover.height,
            }
          : null,
        category: book.category,
        tags: book.tags,
        language: book.language,
        totalPages: book.totalPages,
        freePreviewPages: accessResult.access.freePreviewPages,
        price: book.price,
        currency: book.currency,
        publishedAt: toIso(book.publishedAt),
      },
      access: accessResult.access,
      pages,
    };
  };

  getPage = async (
    slug: string,
    pageNumber: number,
    buyer: TBookBuyer,
  ): Promise<{ body: Uint8Array; contentType: string; cacheControl: string }> => {
    const book = await this.loadPublishedBook(slug);
    this.assertReadable(book);

    const accessResult = await this.resolveAccess(book, buyer);
    const isLocked =
      !accessResult.access.hasFullAccess && pageNumber > accessResult.access.freePreviewPages;

    if (isLocked) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Purchase the complete edition to read this page.",
      );
    }

    const page = await BookPageModel.findOne({ bookId: book._id, pageNumber });
    if (!page) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Page not found.");
    }

    const object = await this.mediaService.getObject(page.storageKey);

    return {
      body: object.body,
      contentType: page.mimeType || object.contentType,
      cacheControl: `private, max-age=${envConfig.book.reader.pageCacheSeconds}`,
    };
  };

  getAccess = async (slug: string, buyer: TBookBuyer): Promise<TBookAccessResult> => {
    const book = await this.loadPublishedBook(slug);
    return this.resolveAccess(book, buyer);
  };

  purchase = async (slug: string, buyer: TBookBuyer): Promise<TBookPurchaseResult> => {
    const book = await this.loadPublishedBook(slug);
    const isFree = book.price <= 0;

    if (!buyer.userId) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Sign in to purchase the complete edition.",
      );
    }

    const existingPaid = await this.findPaidPurchase(book._id, buyer);
    if (existingPaid) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "This edition is already part of your library.",
      );
    }

    if (isFree) {
      const filter = this.buyerFilter(buyer);
      let purchase = filter
        ? await BookPurchaseModel.findOne({
            ...filter,
            bookId: book._id,
            status: BOOK_PURCHASE_STATUS.PENDING,
          }).sort({ createdAt: -1 })
        : null;

      if (!purchase) {
        purchase = new BookPurchaseModel({
          userId: new mongoose.Types.ObjectId(buyer.userId),
          bookId: book._id,
          bookSlug: book.slug,
          amount: book.price,
          currency: book.currency,
          status: BOOK_PURCHASE_STATUS.PAID,
          provider: "free",
          providerReference: `free_${randomUUID()}`,
          providerPaymentId: null,
          purchasedAt: new Date(),
        });
      } else {
        purchase.amount = book.price;
        purchase.currency = book.currency;
        purchase.status = BOOK_PURCHASE_STATUS.PAID;
        purchase.provider = "free";
        purchase.providerReference = `free_${randomUUID()}`;
        purchase.providerPaymentId = null;
        purchase.purchasedAt = new Date();
      }

      await purchase.save();

      const accessResult = await this.resolveAccess(book, buyer);
      return {
        purchase: this.serializePurchase(purchase),
        access: accessResult.access,
      };
    }

    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Use the payment order endpoint to purchase this edition.",
    );
  };

  createPurchaseOrder = async (slug: string, buyer: TBookBuyer): Promise<TBookPurchaseOrderResult> => {
    const book = await this.loadPublishedBook(slug);
    this.assertReadable(book);

    if (!buyer.userId) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Sign in to purchase the complete edition.");
    }

    if (book.price <= 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "This edition is free and does not require payment.");
    }

    const existingPaid = await this.findPaidPurchase(book._id, buyer);
    if (existingPaid) {
      throw new ApiError(StatusCodes.CONFLICT, "This edition is already part of your library.");
    }

    const amountInPaise = Math.round(book.price * 100);
    const receipt = `book_${String(book._id).slice(-12)}_${buyer.userId.slice(-8)}_${Date.now()}`.slice(0, 40);

    const order = await bookPaymentService.createOrder(amountInPaise, book.currency, receipt);

    const filter = this.buyerFilter(buyer);
    let purchase = filter
      ? await BookPurchaseModel.findOne({
          ...filter,
          bookId: book._id,
          status: BOOK_PURCHASE_STATUS.PENDING,
          provider: "razorpay",
        }).sort({ createdAt: -1 })
      : null;

    if (!purchase) {
      purchase = new BookPurchaseModel({
        userId: new mongoose.Types.ObjectId(buyer.userId),
        bookId: book._id,
        bookSlug: book.slug,
        amount: book.price,
        currency: book.currency,
        status: BOOK_PURCHASE_STATUS.PENDING,
        provider: "razorpay",
        providerReference: order.id,
        providerPaymentId: null,
        purchasedAt: null,
      });
    } else {
      purchase.amount = book.price;
      purchase.currency = book.currency;
      purchase.status = BOOK_PURCHASE_STATUS.PENDING;
      purchase.provider = "razorpay";
      purchase.providerReference = order.id;
      purchase.providerPaymentId = null;
      purchase.purchasedAt = null;
    }

    await purchase.save();

    const accessResult = await this.resolveAccess(book, buyer);

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: envConfig.razorpay.keyId,
      purchase: this.serializePurchase(purchase),
      access: accessResult.access,
    };
  };

  verifyPurchase = async (
    slug: string,
    buyer: TBookBuyer,
    payload: { orderId: string; paymentId: string; signature: string },
  ): Promise<TBookPurchaseResult> => {
    const book = await this.loadPublishedBook(slug);

    if (!buyer.userId) {
      throw new ApiError(
        StatusCodes.UNAUTHORIZED,
        "Sign in to purchase the complete edition.",
      );
    }

    const isValid = bookPaymentService.verifyPaymentSignature(
      payload.orderId,
      payload.paymentId,
      payload.signature,
    );

    if (!isValid) {
      throw new ApiError(StatusCodes.BAD_REQUEST, BOOK_PURCHASE_MESSAGES.PAYMENT_FAILED);
    }

    const purchase = await BookPurchaseModel.findOne({
      userId: new mongoose.Types.ObjectId(buyer.userId),
      bookId: book._id,
      provider: "razorpay",
      providerReference: payload.orderId,
    }).sort({ createdAt: -1 });

    if (!purchase) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Purchase order not found.");
    }

    if (purchase.status !== BOOK_PURCHASE_STATUS.PAID) {
      purchase.status = BOOK_PURCHASE_STATUS.PAID;
      purchase.providerPaymentId = payload.paymentId;
      purchase.purchasedAt = new Date();
      await purchase.save();
    } else if (!purchase.providerPaymentId) {
      purchase.providerPaymentId = payload.paymentId;
      await purchase.save();
    }

    const accessResult = await this.resolveAccess(book, buyer);

    return {
      purchase: this.serializePurchase(purchase),
      access: accessResult.access,
    };
  };

  listPurchases = async (userId: string): Promise<TBookPurchase[]> => {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return [];
    }

    const purchases = await BookPurchaseModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      status: BOOK_PURCHASE_STATUS.PAID,
    }).sort({ purchasedAt: -1, createdAt: -1 });

    return purchases.map((purchase) => this.serializePurchase(purchase));
  };
}
