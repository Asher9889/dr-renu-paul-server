import mongoose, { Schema, type Document } from "mongoose";
import { BLOG_POST_STATUS } from "./blog.constant.ts";
import type {
  TBlogPostStatus,
  TTiptapDoc,
} from "./blog.types.ts";

export interface IBlogCover {
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
}

export interface IBlogTag {
  name: string;
  slug: string;
}

export interface IBlogTocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface IBlogPost extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  content: TTiptapDoc;
  cover: IBlogCover | null;
  tags: IBlogTag[];
  status: TBlogPostStatus;
  featured: boolean;
  publishedAt: Date | null;
  firstPublishedAt: Date | null;
  authorId: string;
  readingTimeMinutes: number;
  toc: IBlogTocItem[];
  createdAt: Date;
  updatedAt: Date;
}

const blogCoverSchema = new Schema<IBlogCover>(
  {
    url: { type: String, required: true, trim: true },
    alt: { type: String, required: true, trim: true },
    caption: { type: String, default: null, trim: true },
    width: { type: Number, required: true, min: 1 },
    height: { type: Number, required: true, min: 1 },
  },
  {
    _id: false,
  },
);

const blogTagSchema = new Schema<IBlogTag>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true },
  },
  {
    _id: false,
  },
);

const blogTocItemSchema = new Schema<IBlogTocItem>(
  {
    id: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    level: { type: Number, required: true, enum: [2, 3] },
  },
  {
    _id: false,
  },
);

const blogPostSchema = new Schema<IBlogPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    excerpt: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    content: {
      type: Schema.Types.Mixed,
      required: true,
    },
    cover: {
      type: blogCoverSchema,
      default: null,
    },
    tags: {
      type: [blogTagSchema],
      default: [],
    },
    status: {
      type: String,
      enum: Object.values(BLOG_POST_STATUS),
      default: BLOG_POST_STATUS.DRAFT,
      required: true,
    },
    featured: {
      type: Boolean,
      default: false,
      required: true,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    firstPublishedAt: {
      type: Date,
      default: null,
    },
    authorId: {
      type: String,
      required: true,
      trim: true,
    },
    readingTimeMinutes: {
      type: Number,
      default: 1,
      min: 1,
    },
    toc: {
      type: [blogTocItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    collection: "blog_posts",
  },
);

blogPostSchema.index({ slug: 1 }, { unique: true });
blogPostSchema.index({ status: 1, publishedAt: -1, _id: -1 });
blogPostSchema.index({ featured: 1, status: 1, publishedAt: -1, _id: -1 });
blogPostSchema.index({ "tags.slug": 1, status: 1, publishedAt: -1 });
blogPostSchema.index({ status: 1, updatedAt: -1 });

export const BlogPostModel = mongoose.model<IBlogPost>(
  "BlogPost",
  blogPostSchema,
);
