import { z } from "zod";
import type {
  adminBlogPostListQuerySchema,
  adminBlogPostParamsSchema,
  blogCoverInputSchema,
  createBlogPostSchema,
  publicBlogPostListQuerySchema,
  publicBlogPostParamsSchema,
  publishBlogPostSchema,
  updateBlogPostSchema,
} from "./blog.schema.ts";
import type { BLOG_POST_STATUS } from "./blog.constant.ts";

export type TBlogPostStatus =
  (typeof BLOG_POST_STATUS)[keyof typeof BLOG_POST_STATUS];

export type TTiptapMark =
  | { type: "bold" }
  | { type: "italic" }
  | {
      type: "link";
      attrs: {
        href: string;
        target?: "_blank" | "_self" | null | undefined;
        rel?: string | null | undefined;
      };
    };

export interface TTiptapTextNode {
  type: "text";
  text: string;
  marks?: TTiptapMark[] | undefined;
}

export interface TTiptapHardBreakNode {
  type: "hardBreak";
}

export type TTiptapInlineNode = TTiptapTextNode | TTiptapHardBreakNode;

export interface TTiptapHeadingNode {
  type: "heading";
  attrs: {
    id: string;
    level: 2 | 3;
  };
  content?: TTiptapInlineNode[] | undefined;
}

export interface TTiptapParagraphNode {
  type: "paragraph";
  content?: TTiptapInlineNode[] | undefined;
}

export interface TTiptapBlockquoteNode {
  type: "blockquote";
  attrs?:
    | {
        attribution?: string | null | undefined;
      }
    | undefined;
  content: TTiptapBlockNode[];
}

export interface TTiptapListItemNode {
  type: "listItem";
  content: Array<
    TTiptapParagraphNode | TTiptapBulletListNode | TTiptapOrderedListNode
  >;
}

export interface TTiptapBulletListNode {
  type: "bulletList";
  content: TTiptapListItemNode[];
}

export interface TTiptapOrderedListNode {
  type: "orderedList";
  content: TTiptapListItemNode[];
}

export type TTiptapBlockNode =
  | TTiptapParagraphNode
  | TTiptapHeadingNode
  | TTiptapBulletListNode
  | TTiptapOrderedListNode
  | TTiptapBlockquoteNode;

export interface TTiptapDoc {
  type: "doc";
  content: TTiptapBlockNode[];
}

export interface TBlogCover {
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
}

export interface TBlogTag {
  name: string;
  slug: string;
}

export interface TBlogTagWithCount extends TBlogTag {
  count: number;
}

export interface TBlogAuthor {
  id: string;
  name: string;
  role: string;
  avatar: {
    url: string;
    alt: string;
  };
}

export interface TBlogTocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface TBlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: TBlogCover;
  tags: TBlogTag[];
  publishedAt: string;
  readingTimeMinutes: number;
}

export interface TBlogPostDetail extends TBlogPostSummary {
  content: TTiptapDoc;
  toc: TBlogTocItem[];
  related: TBlogPostSummary[];
  updatedAt: string;
}

export interface TAdminBlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: TBlogCover | null;
  tags: TBlogTag[];
  status: TBlogPostStatus;
  publishedAt: string | null;
  readingTimeMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface TAdminBlogPostDetail extends TAdminBlogPostSummary {
  content: TTiptapDoc;
}

export interface TPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type TPublicBlogPostListResponse = {
  data: TBlogPostSummary[];
  meta: TPageMeta & { tag: string | null };
};

export type TAdminBlogPostListResponse = {
  data: TAdminBlogPostSummary[];
  meta: TPageMeta & {
    status: TBlogPostStatus | null;
    q: string | null;
  };
};

export type TBlogTagListResponse = {
  data: TBlogTagWithCount[];
  meta: {
    totalPublishedPosts: number;
  };
};

export type TBlogAuthorResponse = {
  data: TBlogAuthor;
};

export type TBlogCoverInput = z.infer<typeof blogCoverInputSchema>;
export type TCreateBlogPostPayload = z.infer<typeof createBlogPostSchema>;
export type TUpdateBlogPostPayload = z.infer<typeof updateBlogPostSchema>;
export type TPublishBlogPostPayload = z.infer<typeof publishBlogPostSchema>;
export type TPublicBlogPostListQuery = z.infer<
  typeof publicBlogPostListQuerySchema
>;
export type TAdminBlogPostListQuery = z.infer<
  typeof adminBlogPostListQuerySchema
>;
export type TPublicBlogPostParams = z.infer<typeof publicBlogPostParamsSchema>;
export type TAdminBlogPostParams = z.infer<typeof adminBlogPostParamsSchema>;

export type {
  IBlogCover,
  IBlogPost,
  IBlogTag,
  IBlogTocItem,
} from "./blog.model.ts";

export { BLOG_ALLOWED_IMAGE_TYPES, BLOG_POST_STATUS } from "./blog.constant.ts";
