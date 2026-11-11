import { z } from "zod";
import { BOOK_LIMITS, BOOK_SLUG_PATTERN, BOOK_STATUS } from "./book.constant.ts";
import type { TBookStatus } from "./book.types.ts";

const mediaUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .refine(
    (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
    "Please provide a valid media URL.",
  );

const ebookInputSchema = z
  .object({
    storageKey: z.string().trim().startsWith("books/private/").max(500),
    fileName: z.string().trim().min(1).max(255),
    mimeType: z.literal("application/pdf"),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

const coverInputSchema = z
  .object({
    url: mediaUrlSchema,
    alt: z.string().trim().min(1).max(300),
    width: z.number().int().positive().max(20000),
    height: z.number().int().positive().max(20000),
  })
  .strict();

export const createBookSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(BOOK_SLUG_PATTERN, "Slug must be lowercase kebab-case.")
      .optional(),
    subtitle: z.string().trim().max(200).optional(),
    description: z.string().trim().max(5000).optional(),
    author: z.string().trim().min(1).max(120).optional(),
    cover: coverInputSchema.nullish(),
    ebook: ebookInputSchema.nullish(),
    category: z.string().trim().max(80).optional(),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    language: z.string().trim().min(2).max(20).optional(),
    totalPages: z.number().int().min(0).max(100000).optional(),
    freePreviewPages: z
      .number()
      .int()
      .min(0)
      .max(100000)
      .default(BOOK_LIMITS.FREE_PREVIEW_DEFAULT),
    price: z.number().min(0).max(100000).default(0),
    currency: z.string().trim().length(3).default("USD"),
  })
  .strict();

/**
 * `createBookSchema.partial()` would keep the create-time defaults and silently
 * reset omitted commercial fields on every PATCH. Redefine those three fields
 * without defaults so partial updates stay partial.
 */
export const updateBookSchema = createBookSchema
  .extend({
    freePreviewPages: z.number().int().min(0).max(100000).optional(),
    price: z.number().min(0).max(100000).optional(),
    currency: z.string().trim().length(3).optional(),
  })
  .partial();

const statusValues = Object.values(BOOK_STATUS) as [TBookStatus, ...TBookStatus[]];

export const publicBookListQuerySchema = z.object({
  q: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(120).optional()),
  category: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(80).optional()),
  tag: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(60).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOOK_LIMITS.PUBLIC_MAX_LIMIT)
    .default(BOOK_LIMITS.PUBLIC_DEFAULT_LIMIT),
});

export const adminBookListQuerySchema = z.object({
  status: z.preprocess((v) => (v === "" ? undefined : v), z.enum(statusValues).optional()),
  q: z.preprocess((v) => (v === "" ? undefined : v), z.string().trim().max(120).optional()),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(BOOK_LIMITS.ADMIN_MAX_LIMIT)
    .default(BOOK_LIMITS.ADMIN_DEFAULT_LIMIT),
});

export const publicBookParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160),
});

export const verifyPurchaseSchema = z
  .object({
    razorpay_order_id: z.string().trim().min(1),
    razorpay_payment_id: z.string().trim().min(1),
    razorpay_signature: z.string().trim().min(1),
  })
  .strict();

export const readerPageParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160),
  pageNumber: z.coerce.number().int().min(1).max(100000),
});

export const adminBookParamsSchema = z.object({
  id: z.string().trim().min(1).max(100),
});

export const publishBookSchema = z.preprocess(
  (value) => value ?? {},
  z.object({ publishedAt: z.iso.datetime({ offset: true }).optional() }).strict(),
);
