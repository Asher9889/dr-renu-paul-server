import mongoose, { type QueryFilter } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import { escapeRegExp, slugify } from "../../utils/helpers/string.ts";
import {
  BOOK_LIMITS,
  BOOK_PROCESSING_STATUS,
  BOOK_SLUG_PATTERN,
  BOOK_STATUS,
} from "./book.constant.ts";
import BookModel, {
  type IBook,
  type IBookCover,
  type IBookEbook,
  type IBookProcessing,
} from "./book.model.ts";
import BookPageModel from "./book-page.model.ts";
import BookProcessingJobModel from "./processing/book-processing-job.model.ts";
import type { BookMediaService } from "./book.media.service.ts";
import type { BookProcessingService } from "./processing/book.processing.service.ts";
import type {
  TAdminBookDetail,
  TAdminBookListQuery,
  TBookCover,
  TBookDetail,
  TBookEbook,
  TAdminBookListResponse,
  TAdminBookSummary,
  TBookProcessing,
  TBookSummary,
  TCreateBookPayload,
  TPageMeta,
  TPublicBookListQuery,
  TPublicBookListResponse,
  TUpdateBookPayload,
} from "./book.types.ts";

function isDuplicateKeyError(error: unknown): boolean {
  const value = error as { code?: number };
  return value.code === 11000;
}

function idleProcessing(): IBookProcessing {
  return {
    status: BOOK_PROCESSING_STATUS.IDLE,
    pageCount: 0,
    error: null,
    startedAt: null,
    completedAt: null,
  };
}

export class BookService {
  private readonly processingService: BookProcessingService;
  private readonly mediaService: BookMediaService;

  constructor(
    processingService: BookProcessingService,
    mediaService: BookMediaService,
  ) {
    this.processingService = processingService;
    this.mediaService = mediaService;
  }

  private buildPageMeta = (page: number, limit: number, total: number): TPageMeta => {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  };

  private serializeCover = (cover: IBookCover | null): TBookCover | null => {
    if (!cover) return null;
    return { url: cover.url, alt: cover.alt, width: cover.width, height: cover.height };
  };

  private serializeEbook = (ebook: IBookEbook | null): TBookEbook | null => {
    // Legacy documents stored a public `url` instead of a private storage key.
    // They must be re-uploaded before they can be prepared for the reader.
    if (!ebook?.storageKey) return null;
    return {
      storageKey: ebook.storageKey,
      fileName: ebook.fileName,
      mimeType: ebook.mimeType,
      sizeBytes: ebook.sizeBytes,
    };
  };

  private serializeProcessing = (book: IBook): TBookProcessing => {
    const processing = book.processing;

    if (!processing) {
      return {
        status: BOOK_PROCESSING_STATUS.IDLE,
        pageCount: 0,
        error: null,
        startedAt: null,
        completedAt: null,
      };
    }

    return {
      status: processing.status,
      pageCount: processing.pageCount,
      error: processing.error,
      startedAt: processing.startedAt ? processing.startedAt.toISOString() : null,
      completedAt: processing.completedAt ? processing.completedAt.toISOString() : null,
    };
  };

  private serializePublicSummary = (book: IBook): TBookSummary => {
    return {
      id: String(book._id),
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      author: book.author,
      description: book.description,
      cover: this.serializeCover(book.cover),
      category: book.category,
      tags: book.tags,
      language: book.language,
      totalPages: book.totalPages,
      freePreviewPages: book.freePreviewPages,
      price: book.price,
      currency: book.currency,
      publishedAt: book.publishedAt ? book.publishedAt.toISOString() : null,
    };
  };

  private serializeAdminSummary = (book: IBook): TAdminBookSummary => {
    return {
      ...this.serializePublicSummary(book),
      status: book.status,
      processing: this.serializeProcessing(book),
      createdAt: book.createdAt.toISOString(),
      updatedAt: book.updatedAt.toISOString(),
    };
  };

  private serializeAdminDetail = (book: IBook): TAdminBookDetail => {
    return {
      ...this.serializeAdminSummary(book),
      ebook: this.serializeEbook(book.ebook),
    };
  };

  private findAdminBook = async (id: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");
    }
    const book = await BookModel.findById(id);
    if (!book) throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");
    return book;
  };

  private assertSlugAvailable = async (slug: string, excludeId?: string): Promise<void> => {
    const filter: QueryFilter<IBook> = { slug };
    if (excludeId) filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    const exists = await BookModel.exists(filter);
    if (exists) {
      throw new ApiError(StatusCodes.CONFLICT, "A book with this slug already exists.", [
        { field: "slug", message: "This slug is already in use." },
      ]);
    }
  };

  private generateUniqueSlug = async (title: string): Promise<string> => {
    const base = slugify(title).slice(0, 150).replace(/-+$/g, "");
    if (!base) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "A slug could not be generated from the title.", [
        { field: "title", message: "Please provide a valid title." },
      ]);
    }
    let candidate = base;
    let suffix = 2;
    while (await BookModel.exists({ slug: candidate })) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
      if (suffix > 1000) {
        throw new ApiError(StatusCodes.CONFLICT, "A unique slug could not be generated.", [
          { field: "slug", message: "Please provide an explicit slug." },
        ]);
      }
    }
    return candidate;
  };

  private assertPublishable = (book: IBook): void => {
    const errors: Array<{ field: string; message: string }> = [];
    if (!book.title.trim()) errors.push({ field: "title", message: "Title is required." });
    if (!BOOK_SLUG_PATTERN.test(book.slug)) errors.push({ field: "slug", message: "Slug must be lowercase kebab-case." });
    if (!book.author.trim()) errors.push({ field: "author", message: "Author is required before publishing." });
    if (!book.description.trim()) errors.push({ field: "description", message: "Description is required before publishing." });
    if (!book.cover) errors.push({ field: "cover", message: "Cover image is required before publishing." });
    if (!book.ebook) errors.push({ field: "ebook", message: "Ebook file is required before publishing." });
    if (book.totalPages < 1) errors.push({ field: "totalPages", message: "Total pages is required before publishing." });
    if (book.freePreviewPages > book.totalPages) errors.push({ field: "freePreviewPages", message: "Free preview pages cannot exceed total pages." });

    const processingStatus = book.processing?.status ?? BOOK_PROCESSING_STATUS.IDLE;
    if (processingStatus !== BOOK_PROCESSING_STATUS.READY || book.processing.pageCount < 1) {
      errors.push({
        field: "processing",
        message:
          processingStatus === BOOK_PROCESSING_STATUS.FAILED
            ? "The reader pages failed to prepare. Retry preparation before publishing."
            : "The reader pages are still being prepared.",
      });
    }

    if (errors.length > 0) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "The book is not ready to publish.", errors);
    }
  };

  getPublicBooks = async (query: TPublicBookListQuery): Promise<TPublicBookListResponse> => {
    const baseFilter: QueryFilter<IBook> = {
      status: BOOK_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    };
    const filter: QueryFilter<IBook> = { ...baseFilter };
    if (query.q) {
      const search = new RegExp(escapeRegExp(query.q), "i");
      filter.$or = [{ title: search }, { author: search }, { description: search }];
    }
    if (query.category) filter.category = query.category;
    if (query.tag) filter.tags = query.tag;

    const [books, total] = await Promise.all([
      BookModel.find(filter).sort({ publishedAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      BookModel.countDocuments(filter),
    ]);

    return { data: books.map((b) => this.serializePublicSummary(b)), meta: this.buildPageMeta(query.page, query.limit, total) };
  };

  getPublicBook = async (slug: string): Promise<TBookDetail> => {
    const book = await BookModel.findOne({ slug, status: BOOK_STATUS.PUBLISHED, publishedAt: { $lte: new Date() } });
    if (!book) throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");
    return {
      ...this.serializePublicSummary(book),
      processing: this.serializeProcessing(book),
      updatedAt: book.updatedAt.toISOString(),
    };
  };

  getAdminBooks = async (query: TAdminBookListQuery): Promise<TAdminBookListResponse> => {
    const filter: QueryFilter<IBook> = {};
    if (query.status) filter.status = query.status;
    if (query.q) {
      const search = new RegExp(escapeRegExp(query.q), "i");
      filter.$or = [{ title: search }, { slug: search }, { author: search }];
    }
    const [books, total] = await Promise.all([
      BookModel.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      BookModel.countDocuments(filter),
    ]);
    return { data: books.map((b) => this.serializeAdminSummary(b)), meta: this.buildPageMeta(query.page, query.limit, total) };
  };

  getAdminBook = async (id: string): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);
    return this.serializeAdminDetail(book);
  };

  createBook = async (payload: TCreateBookPayload): Promise<TAdminBookDetail> => {
    const slug = payload.slug ?? (await this.generateUniqueSlug(payload.title));
    if (payload.slug) await this.assertSlugAvailable(payload.slug);

    try {
      const book = await BookModel.create({
        title: payload.title,
        slug,
        subtitle: payload.subtitle ?? "",
        description: payload.description ?? "",
        author: payload.author ?? "",
        cover: payload.cover ? { url: payload.cover.url, alt: payload.cover.alt, width: payload.cover.width, height: payload.cover.height } : null,
        ebook: payload.ebook
          ? {
              storageKey: payload.ebook.storageKey,
              fileName: payload.ebook.fileName,
              mimeType: payload.ebook.mimeType,
              sizeBytes: payload.ebook.sizeBytes,
            }
          : null,
        category: payload.category ?? "",
        tags: payload.tags ?? [],
        language: payload.language ?? "en",
        totalPages: payload.totalPages ?? 0,
        freePreviewPages: payload.freePreviewPages ?? BOOK_LIMITS.FREE_PREVIEW_DEFAULT,
        price: payload.price ?? 0,
        currency: payload.currency ?? "USD",
        status: BOOK_STATUS.DRAFT,
        processing: payload.ebook
          ? { ...idleProcessing(), status: BOOK_PROCESSING_STATUS.PENDING }
          : idleProcessing(),
        publishedAt: null,
        firstPublishedAt: null,
        authorId: envConfig.blog?.author?.id ?? "admin",
      });

      if (book.ebook) {
        await this.processingService.enqueue(String(book._id), { reset: true });
        return this.getAdminBook(String(book._id));
      }

      return this.serializeAdminDetail(book);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(StatusCodes.CONFLICT, "A book with this slug already exists.", [
          { field: "slug", message: "This slug is already in use." },
        ]);
      }
      throw error;
    }
  };

  updateBook = async (id: string, payload: TUpdateBookPayload): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);
    const previousStorageKey = book.ebook?.storageKey ?? null;
    const previousCoverUrl = book.cover?.url ?? null;
    let ebookChanged = false;

    if (payload.slug !== undefined && payload.slug !== book.slug) {
      if (book.firstPublishedAt) {
        throw new ApiError(StatusCodes.CONFLICT, "The slug cannot be changed after the book has been published.", [
          { field: "slug", message: "The slug is locked after first publish." },
        ]);
      }
      await this.assertSlugAvailable(payload.slug, id);
      book.slug = payload.slug;
    }
    if (payload.title !== undefined) book.title = payload.title;
    if (payload.subtitle !== undefined) book.subtitle = payload.subtitle;
    if (payload.description !== undefined) book.description = payload.description;
    if (payload.author !== undefined) book.author = payload.author;
    if (payload.cover !== undefined) {
      book.cover = payload.cover === null ? null : { url: payload.cover.url, alt: payload.cover.alt, width: payload.cover.width, height: payload.cover.height };
    }
    if (payload.ebook !== undefined) {
      const nextStorageKey = payload.ebook?.storageKey ?? null;
      ebookChanged = nextStorageKey !== previousStorageKey;
      book.ebook = payload.ebook === null
        ? null
        : {
            storageKey: payload.ebook.storageKey,
            fileName: payload.ebook.fileName,
            mimeType: payload.ebook.mimeType,
            sizeBytes: payload.ebook.sizeBytes,
          };

      if (ebookChanged) {
        book.totalPages = payload.ebook ? 0 : book.totalPages;
        book.processing = payload.ebook
          ? {
              ...idleProcessing(),
              status: BOOK_PROCESSING_STATUS.PENDING,
            }
          : idleProcessing();
      }
    }
    if (payload.category !== undefined) book.category = payload.category;
    if (payload.tags !== undefined) book.tags = payload.tags;
    if (payload.language !== undefined) book.language = payload.language;
    if (payload.totalPages !== undefined && !ebookChanged) book.totalPages = payload.totalPages;
    if (payload.freePreviewPages !== undefined) book.freePreviewPages = payload.freePreviewPages;
    if (payload.price !== undefined) book.price = payload.price;
    if (payload.currency !== undefined) book.currency = payload.currency;

    if (book.status === BOOK_STATUS.PUBLISHED) this.assertPublishable(book);

    try {
      await book.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(StatusCodes.CONFLICT, "A book with this slug already exists.", [
          { field: "slug", message: "This slug is already in use." },
        ]);
      }
      throw error;
    }

    const obsoleteKeys: Array<string | null> = [];
    if (
      payload.cover !== undefined &&
      previousCoverUrl &&
      previousCoverUrl !== book.cover?.url
    ) {
      obsoleteKeys.push(this.mediaService.storageKeyFromMediaUrl(previousCoverUrl));
    }

    if (ebookChanged) {
      if (previousStorageKey) obsoleteKeys.push(previousStorageKey);

      if (book.ebook) {
        await this.processingService.enqueue(id, { reset: true });
      } else {
        const stalePages = await BookPageModel.find({ bookId: book._id })
          .select("storageKey")
          .lean();
        await Promise.all([
          BookPageModel.deleteMany({ bookId: book._id }),
          BookProcessingJobModel.deleteOne({ bookId: book._id }),
        ]);
        obsoleteKeys.push(...stalePages.map((page) => page.storageKey));
      }
    } else if (
      book.ebook &&
      (book.processing?.status ?? BOOK_PROCESSING_STATUS.IDLE) === BOOK_PROCESSING_STATUS.IDLE
    ) {
      await this.processingService.enqueue(id, { reset: true });
    }

    if (obsoleteKeys.length > 0) {
      void this.mediaService.removeObjects(obsoleteKeys);
    }

    return this.getAdminBook(id);
  };

  reprocessBook = async (id: string): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);

    if (!book.ebook) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Upload a PDF before preparing the reader.", [
        { field: "ebook", message: "An ebook file is required." },
      ]);
    }

    if ((book.processing?.status ?? BOOK_PROCESSING_STATUS.IDLE) === BOOK_PROCESSING_STATUS.PROCESSING) {
      throw new ApiError(StatusCodes.CONFLICT, "This edition is already being prepared.");
    }

    book.processing = {
      ...idleProcessing(),
      status: BOOK_PROCESSING_STATUS.PENDING,
    };
    await book.save();
    await this.processingService.enqueue(id, { reset: true });

    return this.getAdminBook(id);
  };

  publishBook = async (id: string, payload: { publishedAt?: string }): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);
    if (book.status === BOOK_STATUS.ARCHIVED) {
      throw new ApiError(StatusCodes.CONFLICT, "Archived books cannot be published.");
    }
    this.assertPublishable(book);
    const publishedAt = payload.publishedAt ? new Date(payload.publishedAt) : new Date();
    book.status = BOOK_STATUS.PUBLISHED;
    book.publishedAt = publishedAt;
    book.firstPublishedAt = book.firstPublishedAt ?? publishedAt;
    await book.save();
    return this.serializeAdminDetail(book);
  };

  unpublishBook = async (id: string): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);
    if (book.status !== BOOK_STATUS.PUBLISHED) {
      throw new ApiError(StatusCodes.CONFLICT, "Only published books can be unpublished.");
    }
    book.status = BOOK_STATUS.DRAFT;
    book.publishedAt = null;
    await book.save();
    return this.serializeAdminDetail(book);
  };

  archiveBook = async (id: string): Promise<TAdminBookDetail> => {
    const book = await this.findAdminBook(id);
    book.status = BOOK_STATUS.ARCHIVED;
    await book.save();
    return this.serializeAdminDetail(book);
  };

  deleteBook = async (id: string): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");
    }
    const book = await BookModel.findById(id);
    if (!book) throw new ApiError(StatusCodes.NOT_FOUND, "Book not found.");

    const pages = await BookPageModel.find({ bookId: book._id })
      .select("storageKey")
      .lean();

    const mediaKeys: Array<string | null> = [
      book.ebook?.storageKey ?? null,
      this.mediaService.storageKeyFromMediaUrl(book.cover?.url),
      ...pages.map((page) => page.storageKey),
    ];

    await Promise.all([
      BookModel.deleteOne({ _id: book._id }),
      BookPageModel.deleteMany({ bookId: book._id }),
      BookProcessingJobModel.deleteOne({ bookId: book._id }),
    ]);

    void this.mediaService.removeObjects(mediaKeys);
  };
}
