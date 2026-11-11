import mongoose, { Schema, type Document } from "mongoose";
import { BOOK_PROCESSING_JOB_STATUS } from "../book.constant.ts";

export type TProcessingJobStatus = (typeof BOOK_PROCESSING_JOB_STATUS)[keyof typeof BOOK_PROCESSING_JOB_STATUS];

export interface IBookProcessingJob extends Document {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  status: TProcessingJobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lockedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookProcessingJobSchema = new Schema<IBookProcessingJob>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, unique: true },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
      required: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    runAt: { type: Date, default: () => new Date(), required: true },
    lockedAt: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "book_processing_jobs", versionKey: false },
);

bookProcessingJobSchema.index({ status: 1, runAt: 1, createdAt: 1 });
bookProcessingJobSchema.index({ status: 1, lockedAt: 1 });

const BookProcessingJobModel = mongoose.model<IBookProcessingJob>(
  "BookProcessingJob",
  bookProcessingJobSchema,
);

export default BookProcessingJobModel;
