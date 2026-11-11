export const BOOK_STATUS = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  ARCHIVED: "ARCHIVED",
} as const;

export const BOOK_LIMITS = {
  PUBLIC_DEFAULT_LIMIT: 12,
  PUBLIC_MAX_LIMIT: 50,
  ADMIN_DEFAULT_LIMIT: 20,
  ADMIN_MAX_LIMIT: 100,
  MAX_COVER_BYTES: 8 * 1024 * 1024,
  MAX_EBOOK_BYTES: 50 * 1024 * 1024,
  FREE_PREVIEW_DEFAULT: 5,
} as const;

export const BOOK_MESSAGES = {
  BOOKS_FETCHED: "Books fetched successfully.",
  BOOK_FETCHED: "Book fetched successfully.",
  BOOK_CREATED: "Book created successfully.",
  BOOK_UPDATED: "Book updated successfully.",
  BOOK_PUBLISHED: "Book published successfully.",
  BOOK_UNPUBLISHED: "Book unpublished successfully.",
  BOOK_ARCHIVED: "Book archived successfully.",
  BOOK_DELETED: "Book deleted successfully.",
  MEDIA_UPLOADED: "Book media uploaded successfully.",
} as const;

export const BOOK_ALLOWED_COVER_TYPES = {
  "image/jpeg": { extension: "jpg" },
  "image/png": { extension: "png" },
  "image/webp": { extension: "webp" },
  "image/avif": { extension: "avif" },
} as const;

export const BOOK_ALLOWED_EBOOK_TYPES = {
  // The flipper reader renders page images server-side, so editions must be PDF.
  "application/pdf": { extension: "pdf" },
} as const;

export const BOOK_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const BOOK_PROCESSING_STATUS = {
  IDLE: "IDLE",
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  READY: "READY",
  FAILED: "FAILED",
} as const;

export const BOOK_PROCESSING_JOB_STATUS = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;


export const BOOK_PURCHASE_STATUS = {
  PENDING: "PENDING",
  PAID: "PAID",
  REFUNDED: "REFUNDED",
  CANCELLED: "CANCELLED",
} as const;

export const BOOK_PAGE_LIMITS = {
  MAX_RENDERED_PAGES: 2000,
  RENDER_TARGET_WIDTH: 1400,
  RENDER_MAX_HEIGHT: 2000,
  RENDER_QUALITY: 82,
  WORKER_POLL_INTERVAL_MS: 5000,
  WORKER_MAX_ATTEMPTS: 3,
  WORKER_RETRY_DELAY_MS: 30000,
} as const;

export const BOOK_PURCHASE_MESSAGES = {
  PURCHASE_CREATED: "Purchase created successfully.",
  PURCHASE_COMPLETED: "Purchase completed successfully.",
  PURCHASE_FOUND: "Purchase fetched successfully.",
  PURCHASES_FETCHED: "Purchases fetched successfully.",
  ACCESS_FETCHED: "Book access fetched successfully.",
  READER_FETCHED: "Book reader fetched successfully.",
  ORDER_CREATED: "Payment order created successfully.",
  PAYMENT_VERIFIED: "Payment verified successfully.",
  PAYMENT_FAILED: "Payment verification failed.",
  PAYMENTS_NOT_CONFIGURED: "Online payments are not configured.",
} as const;


export const BOOK_PROCESSING_MESSAGES = {
  QUEUED: "Book preparation queued successfully.",
  READY_REQUIRED: "The reader pages are still being prepared.",
} as const;
