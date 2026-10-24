import { z } from "zod";
import {
  BLOG_LIMITS,
  BLOG_POST_STATUS,
  BLOG_SLUG_PATTERN,
} from "./blog.constant.ts";
import type {
  TBlogPostStatus,
  TTiptapBlockNode,
  TTiptapBlockquoteNode,
  TTiptapBulletListNode,
  TTiptapDoc,
  TTiptapHardBreakNode,
  TTiptapHeadingNode,
  TTiptapInlineNode,
  TTiptapListItemNode,
  TTiptapOrderedListNode,
  TTiptapParagraphNode,
  TTiptapTextNode,
} from "./blog.types.ts";

const headingIdSchema = z
  .string()
  .trim()
  .min(1, "Heading id is required.")
  .max(120, "Heading id is too long.")
  .regex(
    BLOG_SLUG_PATTERN,
    "Heading ids must be lowercase kebab-case.",
  );

const httpUrlSchema = z
  .url("Please provide a valid URL.")
  .refine(
    (value) => /^https?:\/\//i.test(value),
    "URLs must use http or https.",
  );

const boldMarkSchema = z
  .object({
    type: z.literal("bold"),
  })
  .strict();

const italicMarkSchema = z
  .object({
    type: z.literal("italic"),
  })
  .strict();

const linkMarkSchema = z
  .object({
    type: z.literal("link"),
    attrs: z
      .object({
        href: httpUrlSchema,
        target: z
          .union([z.literal("_blank"), z.literal("_self")])
          .nullish(),
        rel: z.string().trim().max(255).nullish(),
      })
      .strict(),
  })
  .strict();

const markSchema = z.union([
  boldMarkSchema,
  italicMarkSchema,
  linkMarkSchema,
]);

const textNodeSchema: z.ZodType<TTiptapTextNode> = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1),
    marks: z.array(markSchema).optional(),
  })
  .strict();

const hardBreakNodeSchema: z.ZodType<TTiptapHardBreakNode> = z
  .object({
    type: z.literal("hardBreak"),
  })
  .strict();

const inlineNodeSchema: z.ZodType<TTiptapInlineNode> = z.union([
  textNodeSchema,
  hardBreakNodeSchema,
]);

const paragraphNodeSchema: z.ZodType<TTiptapParagraphNode> = z
  .object({
    type: z.literal("paragraph"),
    content: z.array(inlineNodeSchema).optional(),
  })
  .strict();

const headingNodeSchema: z.ZodType<TTiptapHeadingNode> = z
  .object({
    type: z.literal("heading"),
    attrs: z
      .object({
        id: headingIdSchema,
        level: z.union([z.literal(2), z.literal(3)]),
      })
      .strict(),
    content: z.array(inlineNodeSchema).optional(),
  })
  .strict();

const listItemNodeSchema: z.ZodType<TTiptapListItemNode> = z.lazy(() =>
  z
    .object({
      type: z.literal("listItem"),
      content: z.array(
        z.union([
          paragraphNodeSchema,
          bulletListNodeSchema,
          orderedListNodeSchema,
        ]),
      ),
    })
    .strict(),
);

const bulletListNodeSchema: z.ZodType<TTiptapBulletListNode> = z.lazy(() =>
  z
    .object({
      type: z.literal("bulletList"),
      content: z.array(listItemNodeSchema),
    })
    .strict(),
);

const orderedListNodeSchema: z.ZodType<TTiptapOrderedListNode> = z.lazy(() =>
  z
    .object({
      type: z.literal("orderedList"),
      content: z.array(listItemNodeSchema),
    })
    .strict(),
);

const blockquoteNodeSchema: z.ZodType<TTiptapBlockquoteNode> = z.lazy(() =>
  z
    .object({
      type: z.literal("blockquote"),
      attrs: z
        .object({
          attribution: z.string().trim().max(300).nullish(),
        })
        .strict()
        .optional(),
      content: z.array(
        z.union([
          paragraphNodeSchema,
          bulletListNodeSchema,
          orderedListNodeSchema,
        ]),
      ),
    })
    .strict(),
);

const blockNodeSchema: z.ZodType<TTiptapBlockNode> = z.union([
  paragraphNodeSchema,
  headingNodeSchema,
  bulletListNodeSchema,
  orderedListNodeSchema,
  blockquoteNodeSchema,
]);

export const tiptapDocSchema: z.ZodType<TTiptapDoc> = z
  .object({
    type: z.literal("doc"),
    content: z.array(blockNodeSchema),
  })
  .strict();

export const blogCoverInputSchema = z
  .object({
    url: httpUrlSchema,
    alt: z.string().trim().min(1, "Cover alt text is required.").max(300),
    caption: z.string().trim().max(500).nullish(),
    width: z.number().int().positive().max(20000),
    height: z.number().int().positive().max(20000),
  })
  .strict();

const tagsSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(20, "A post can have at most 20 tags.");

export const createBlogPostSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(BLOG_SLUG_PATTERN, "Slug must be lowercase kebab-case.")
      .optional(),
    excerpt: z.string().trim().max(200, "Excerpt must be 200 characters or fewer.").optional(),
    content: tiptapDocSchema.optional(),
    cover: blogCoverInputSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .strict();

export const updateBlogPostSchema = createBlogPostSchema.partial();

const statusValues = Object.values(BLOG_POST_STATUS) as [
  TBlogPostStatus,
  ...TBlogPostStatus[],
];

export const publicBlogPostListQuerySchema = z.object({
  tag: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string()
      .trim()
      .max(80)
      .regex(BLOG_SLUG_PATTERN, "Tag must be a valid slug.")
      .optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(
      BLOG_LIMITS.PUBLIC_MAX_LIMIT,
      `Public limit cannot exceed ${BLOG_LIMITS.PUBLIC_MAX_LIMIT}.`,
    )
    .default(BLOG_LIMITS.PUBLIC_DEFAULT_LIMIT),
});

export const adminBlogPostListQuerySchema = z.object({
  status: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(statusValues).optional(),
  ),
  q: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().max(120).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(
      BLOG_LIMITS.ADMIN_MAX_LIMIT,
      `Admin limit cannot exceed ${BLOG_LIMITS.ADMIN_MAX_LIMIT}.`,
    )
    .default(BLOG_LIMITS.ADMIN_DEFAULT_LIMIT),
});

export const publicBlogPostParamsSchema = z.object({
  slug: z.string().trim().min(1).max(160),
});

export const adminBlogPostParamsSchema = z.object({
  id: z.string().trim().min(1).max(100),
});

export const publishBlogPostSchema = z.preprocess(
  (value) => value ?? {},
  z
    .object({
      publishedAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict(),
);
