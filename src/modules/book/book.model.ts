import mongoose, { Schema, type Document } from "mongoose";
import { BOOK_LIMITS, BOOK_PROCESSING_STATUS, BOOK_STATUS } from "./book.constant.ts";
import type { TBookProcessingStatus, TBookStatus } from "./book.types.ts";

export interface IBookCover {
  url: string;
  alt: string;
  width: number;
  height: number;
}

export interface IBookEbook {
  storageKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IBookProcessing {
  status: TBookProcessingStatus;
  pageCount: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface IBook extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  author: string;
  cover: IBookCover | null;
  ebook: IBookEbook | null;
  category: string;
  tags: string[];
  language: string;
  totalPages: number;
  freePreviewPages: number;
  price: number;
  currency: string;
  status: TBookStatus;
  processing: IBookProcessing;
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookCoverSchema = new Schema<IBookCover>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const bookEbookSchema = new Schema<IBookEbook>(
  {
    storageKey: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const bookProcessingSchema = new Schema<IBookProcessing>(
  {
    status: {
      type: String,
      enum: Object.values(BOOK_PROCESSING_STATUS),
      default: BOOK_PROCESSING_STATUS.IDLE,
      required: true,
    },
    pageCount: { type: Number, default: 0, min: 0 },
    error: { type: String, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { _id: false },
);

const bookSchema = new Schema<IBook>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    subtitle: { type: String, default: "", trim: true, maxlength: 200 },
    description: { type: String, default: "", trim: true, maxlength: 5000 },
    author: { type: String, default: "", trim: true, maxlength: 120 },
    cover: { type: bookCoverSchema, default: null },
    ebook: { type: bookEbookSchema, default: null },
    category: { type: String, default: "", trim: true, maxlength: 80 },
    tags: { type: [String], default: [] },
    language: { type: String, default: "en", trim: true, maxlength: 20 },
    totalPages: { type: Number, default: 0, min: 0 },
    freePreviewPages: { type: Number, default: BOOK_LIMITS.FREE_PREVIEW_DEFAULT, min: 0 },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "USD", trim: true, uppercase: true, maxlength: 3 },
    status: { type: String, enum: Object.values(BOOK_STATUS), default: BOOK_STATUS.DRAFT, required: true },
    processing: { type: bookProcessingSchema, default: () => ({}) },
    publishedAt: { type: Date, default: null },
    firstPublishedAt: { type: Date, default: null },
    authorId: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: "books", versionKey: false },
);

bookSchema.index({ slug: 1 }, { unique: true });
bookSchema.index({ status: 1, publishedAt: -1, _id: -1 });
bookSchema.index({ category: 1, status: 1, publishedAt: -1 });
bookSchema.index({ tags: 1, status: 1, publishedAt: -1 });
bookSchema.index({ "processing.status": 1 });

const BookModel = mongoose.model<IBook>("Book", bookSchema);

export default BookModel;
