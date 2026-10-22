import mongoose, { Schema, type Document } from "mongoose";

export interface IContactUs extends Document {
  name: string;
  phone: string;
  email: string;
  concern: string;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const contactUsSchema = new Schema<IContactUs>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    concern: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

export const ContactUsModel = mongoose.model<IContactUs>(
  "ContactUs",
  contactUsSchema,
);
