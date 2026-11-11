import { z } from "zod";
import type {
  adminBookListQuerySchema,
  adminBookParamsSchema,
  createBookSchema,
  publicBookListQuerySchema,
  publicBookParamsSchema,
  publishBookSchema,
  readerPageParamsSchema,
  updateBookSchema,
} from "./book.schema.ts";
import { BOOK_PROCESSING_JOB_STATUS, BOOK_PROCESSING_STATUS, BOOK_PURCHASE_STATUS, BOOK_STATUS } from "./book.constant.ts";
import type { TUserRole } from "../user/user.types.ts";

export type TBookStatus = (typeof BOOK_STATUS)[keyof typeof BOOK_STATUS];
export type TBookProcessingStatus = (typeof BOOK_PROCESSING_STATUS)[keyof typeof BOOK_PROCESSING_STATUS];
export type TBookPurchaseStatus = (typeof BOOK_PURCHASE_STATUS)[keyof typeof BOOK_PURCHASE_STATUS];
export type TProcessingJobStatus = (typeof BOOK_PROCESSING_JOB_STATUS)[keyof typeof BOOK_PROCESSING_JOB_STATUS];

export interface TBookCover {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface TBookEbook {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface TBookProcessing {
  status: TBookProcessingStatus;
  pageCount: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TBookSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  cover: TBookCover | null;
  category: string;
  tags: string[];
  language: string;
  totalPages: number;
  freePreviewPages: number;
  price: number;
  currency: string;
  publishedAt: string | null;
}

export interface TBookDetail extends TBookSummary {
  processing: TBookProcessing;
  updatedAt: string;
}

export interface TAdminBookSummary extends TBookSummary {
  status: TBookStatus;
  processing: TBookProcessing;
  createdAt: string;
  updatedAt: string;
}

export interface TAdminBookDetail extends TAdminBookSummary {
  ebook: TBookEbook | null;
}

export interface TPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface TReaderPage {
  pageNumber: number;
  width: number;
  height: number;
  locked: boolean;
  imageUrl: string | null;
}

export interface TBookAccess {
  hasFullAccess: boolean;
  isPreviewOnly: boolean;
  purchased: boolean;
  price: number;
  currency: string;
  freePreviewPages: number;
  totalPages: number;
}

export interface TBookBuyer {
  userId: string | null;
  role: TUserRole | null;
}

export interface TBookReader {
  book: TBookSummary;
  access: TBookAccess;
  pages: TReaderPage[];
}

export interface TBookPurchase {
  id: string;
  bookId: string;
  bookSlug: string;
  userId: string | null;
  amount: number;
  currency: string;
  status: TBookPurchaseStatus;
  provider: string;
  providerReference: string | null;
  providerPaymentId: string | null;
  purchasedAt: string | null;
  createdAt: string;
}

export interface TBookAccessResult {
  access: TBookAccess;
  purchase: TBookPurchase | null;
}

export interface TBookPurchaseResult {
  purchase: TBookPurchase;
  access: TBookAccess;
}

export interface TBookPurchaseOrderResult {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  purchase: TBookPurchase;
  access: TBookAccess;
}

export type TPublicBookListResponse = {
  data: TBookSummary[];
  meta: TPageMeta;
};

export type TAdminBookListResponse = {
  data: TAdminBookSummary[];
  meta: TPageMeta;
};

export type TBookCoverInput = z.infer<typeof createBookSchema>["cover"];
export type TBookEbookInput = z.infer<typeof createBookSchema>["ebook"];
export type TCreateBookPayload = z.infer<typeof createBookSchema>;
export type TUpdateBookPayload = z.infer<typeof updateBookSchema>;
export type TPublishBookPayload = z.infer<typeof publishBookSchema>;
export type TPublicBookListQuery = z.infer<typeof publicBookListQuerySchema>;
export type TAdminBookListQuery = z.infer<typeof adminBookListQuerySchema>;
export type TPublicBookParams = z.infer<typeof publicBookParamsSchema>;
export type TAdminBookParams = z.infer<typeof adminBookParamsSchema>;
export type TReaderPageParams = z.infer<typeof readerPageParamsSchema>;

export type {
  IBook,
  IBookCover,
  IBookEbook,
  IBookProcessing,
} from "./book.model.ts";

export { BOOK_PROCESSING_STATUS, BOOK_PURCHASE_STATUS, BOOK_STATUS } from "./book.constant.ts";
