import mongoose, { Schema, type Document } from "mongoose";

export interface IBookPage extends Document {
  _id: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  pageNumber: number;
  storageKey: string;
  width: number;
  height: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

const bookPageSchema = new Schema<IBookPage>(
  {
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true, index: true },
    pageNumber: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
    mimeType: { type: String, required: true, trim: true },
    sizeBytes: { type: Number, required: true, min: 1 },
  },
  { timestamps: true, collection: "book_pages", versionKey: false },
);

bookPageSchema.index({ bookId: 1, pageNumber: 1 }, { unique: true });

const BookPageModel = mongoose.model<IBookPage>("BookPage", bookPageSchema);

export default BookPageModel;
