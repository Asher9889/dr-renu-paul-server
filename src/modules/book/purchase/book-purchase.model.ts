import mongoose, { Schema, type Document } from "mongoose";
import { BOOK_PURCHASE_STATUS } from "../book.constant.ts";
import type { TBookPurchaseStatus } from "../book.types.ts";

export interface IBookPurchase extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  bookSlug: string;
  amount: number;
  currency: string;
  status: TBookPurchaseStatus;
  provider: string;
  providerReference: string | null;
  providerPaymentId: string | null;
  purchasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const bookPurchaseSchema = new Schema<IBookPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Opaque browser key used for guest checkout while payments run in mock mode.
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    bookSlug: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true, maxlength: 3 },
    status: {
      type: String,
      enum: Object.values(BOOK_PURCHASE_STATUS),
      default: BOOK_PURCHASE_STATUS.PENDING,
      required: true,
    },
    provider: { type: String, default: "manual", trim: true },
    providerReference: { type: String, default: null },
    providerPaymentId: { type: String, default: null },
    purchasedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "book_purchases", versionKey: false },
);

bookPurchaseSchema.index({ userId: 1, bookId: 1, status: 1 });
bookPurchaseSchema.index({ bookId: 1, status: 1 });

const BookPurchaseModel = mongoose.model<IBookPurchase>("BookPurchase", bookPurchaseSchema);

export default BookPurchaseModel;
