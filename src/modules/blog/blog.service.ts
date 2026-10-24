import mongoose, { type QueryFilter } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { envConfig } from "../../config/index.ts";
import { ApiError } from "../../utils/index.ts";
import { escapeRegExp, slugify } from "../../utils/helpers/string.ts";
import { BLOG_LIMITS, BLOG_POST_STATUS, BLOG_SLUG_PATTERN } from "./blog.constant.ts";
import {
  BlogPostModel,
  type IBlogCover,
  type IBlogPost,
  type IBlogTag,
  type IBlogTocItem,
} from "./blog.model.ts";
import { tiptapDocSchema } from "./blog.schema.ts";
import type {
  TAdminBlogPostDetail,
  TAdminBlogPostListQuery,
  TAdminBlogPostListResponse,
  TAdminBlogPostSummary,
  TBlogAuthorResponse,
  TBlogCoverInput,
  TBlogCover,
  TBlogPostDetail,
  TBlogPostSummary,
  TBlogTag,
  TBlogTagListResponse,
  TCreateBlogPostPayload,
  TPageMeta,
  TPublishBlogPostPayload,
  TPublicBlogPostListQuery,
  TPublicBlogPostListResponse,
  TTiptapDoc,
  TUpdateBlogPostPayload,
} from "./blog.types.ts";

interface TAnyTiptapNode {
  type: string;
  text?: string | undefined;
  attrs?:
    | {
        id?: unknown;
        level?: unknown;
        attribution?: unknown;
      }
    | undefined;
  content?: TAnyTiptapNode[] | undefined;
}

type TPublishablePost = Pick<
  IBlogPost,
  "title" | "slug" | "excerpt" | "content" | "cover" | "tags"
>;

const EMPTY_TIPTAP_DOC: TTiptapDoc = {
  type: "doc",
  content: [],
};

function walkTiptap(
  node: TAnyTiptapNode,
  visit: (node: TAnyTiptapNode) => void,
): void {
  visit(node);

  for (const child of node.content ?? []) {
    walkTiptap(child, visit);
  }
}

function toAnyTiptapNode(content: TTiptapDoc): TAnyTiptapNode {
  return content as unknown as TAnyTiptapNode;
}

function collectText(node: TAnyTiptapNode): string {
  let text = "";

  walkTiptap(node, (current) => {
    if (current.type === "text" && typeof current.text === "string") {
      text += ` ${current.text}`;
    }
  });

  return text.replace(/\s+/g, " ").trim();
}

function findDuplicateHeadingIds(content: TTiptapDoc): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  walkTiptap(toAnyTiptapNode(content), (node) => {
    if (node.type !== "heading" || typeof node.attrs?.id !== "string") {
      return;
    }

    if (seen.has(node.attrs.id)) {
      duplicates.add(node.attrs.id);
      return;
    }

    seen.add(node.attrs.id);
  });

  return [...duplicates];
}

function deriveToc(content: TTiptapDoc): IBlogTocItem[] {
  const toc: IBlogTocItem[] = [];

  walkTiptap(toAnyTiptapNode(content), (node) => {
    if (node.type !== "heading") {
      return;
    }

    const level = node.attrs?.level;
    const id = node.attrs?.id;

    if ((level !== 2 && level !== 3) || typeof id !== "string") {
      return;
    }

    toc.push({
      id,
      text: collectText(node),
      level,
    });
  });

  return toc;
}

function computeReadingTime(content: TTiptapDoc): number {
  const text = collectText(toAnyTiptapNode(content));
  const words = text ? text.split(/\s+/).length : 0;

  return Math.max(1, Math.ceil(words / BLOG_LIMITS.READING_WORDS_PER_MINUTE));
}

function normalizeCover(input: TBlogCoverInput): IBlogCover {
  return {
    url: input.url,
    alt: input.alt,
    caption: input.caption ?? null,
    width: input.width,
    height: input.height,
  };
}

function normalizeTags(names: string[]): IBlogTag[] {
  const seen = new Set<string>();
  const tags: IBlogTag[] = [];

  for (const value of names) {
    const name = value.trim().replace(/\s+/g, " ");
    const slug = slugify(name);

    if (!slug) {
      throw new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, "Invalid tag.", [
        {
          field: "tags",
          message: `The tag "${name}" could not be converted to a slug.`,
        },
      ]);
    }

    if (seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    tags.push({ name, slug });
  }

  return tags;
}

function isDuplicateKeyError(error: unknown): boolean {
  const value = error as { code?: number };

  return value.code === 11000;
}

export class BlogService {
  private buildPageMeta = (
    page: number,
    limit: number,
    total: number,
  ): TPageMeta => {
    const totalPages = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  };

  private serializeCover = (cover: IBlogCover | null): TBlogCover | null => {
    if (!cover) {
      return null;
    }

    return {
      url: cover.url,
      alt: cover.alt,
      caption: cover.caption ?? null,
      width: cover.width,
      height: cover.height,
    };
  };

  private serializeTags = (tags: IBlogTag[]): TBlogTag[] => {
    return tags.map((tag) => ({
      name: tag.name,
      slug: tag.slug,
    }));
  };

  private serializePublicSummary = (post: IBlogPost): TBlogPostSummary => {
    const cover = this.serializeCover(post.cover);

    if (!cover || !post.publishedAt) {
      throw new ApiError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Published post data is incomplete.",
      );
    }

    return {
      id: String(post._id),
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      cover,
      tags: this.serializeTags(post.tags),
      publishedAt: post.publishedAt.toISOString(),
      readingTimeMinutes: post.readingTimeMinutes,
    };
  };

  private serializeAdminSummary = (
    post: IBlogPost,
  ): TAdminBlogPostSummary => {
    return {
      id: String(post._id),
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      cover: this.serializeCover(post.cover),
      tags: this.serializeTags(post.tags),
      status: post.status,
      publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
      readingTimeMinutes: post.readingTimeMinutes,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    };
  };

  private serializeAdminDetail = (
    post: IBlogPost,
  ): TAdminBlogPostDetail => {
    return {
      ...this.serializeAdminSummary(post),
      content: post.content,
    };
  };

  private validateContent = (content: TTiptapDoc): TTiptapDoc => {
    const result = tiptapDocSchema.safeParse(content);

    if (!result.success) {
      const firstIssue = result.error.issues[0];

      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "Post content is invalid.",
        [
          {
            field: "content",
            message: firstIssue?.message ?? "The post content is invalid.",
          },
        ],
      );
    }

    const duplicates = findDuplicateHeadingIds(result.data);

    if (duplicates.length > 0) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "Heading ids must be unique.",
        duplicates.map((id) => ({
          field: "content",
          message: `The heading id "${id}" is used more than once.`,
        })),
      );
    }

    return result.data;
  };

  private assertPublishable = (post: TPublishablePost): void => {
    const errors: Array<{ field: string; message: string }> = [];

    if (!post.title.trim()) {
      errors.push({ field: "title", message: "Title is required." });
    }

    if (!BLOG_SLUG_PATTERN.test(post.slug)) {
      errors.push({
        field: "slug",
        message: "Slug must be lowercase kebab-case.",
      });
    }

    const excerptLength = post.excerpt.trim().length;

    if (excerptLength < 40 || excerptLength > 200) {
      errors.push({
        field: "excerpt",
        message: "Excerpt must be between 40 and 200 characters.",
      });
    }

    if (!collectText(toAnyTiptapNode(post.content))) {
      errors.push({
        field: "content",
        message: "Content is required before publishing.",
      });
    }

    const contentResult = tiptapDocSchema.safeParse(post.content);

    if (!contentResult.success) {
      errors.push({
        field: "content",
        message:
          contentResult.error.issues[0]?.message ?? "Content is invalid.",
      });
    } else {
      const duplicates = findDuplicateHeadingIds(contentResult.data);

      for (const id of duplicates) {
        errors.push({
          field: "content",
          message: `The heading id "${id}" is used more than once.`,
        });
      }
    }

    if (!post.cover) {
      errors.push({
        field: "cover",
        message: "Cover image is required before publishing.",
      });
    } else {
      if (!post.cover.alt.trim()) {
        errors.push({
          field: "cover",
          message: "Cover alt text is required before publishing.",
        });
      }

      if (!/^https?:\/\//i.test(post.cover.url)) {
        errors.push({
          field: "cover",
          message: "Cover URL must be an absolute http or https URL.",
        });
      }

      if (post.cover.width < 1 || post.cover.height < 1) {
        errors.push({
          field: "cover",
          message: "Cover width and height must be positive numbers.",
        });
      }
    }

    if (post.tags.length === 0) {
      errors.push({
        field: "tags",
        message: "At least one tag is required before publishing.",
      });
    }

    if (errors.length > 0) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "The post is not ready to publish.",
        errors,
      );
    }
  };

  private findAdminPost = async (id: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Blog post not found.");
    }

    const post = await BlogPostModel.findById(id);

    if (!post) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Blog post not found.");
    }

    return post;
  };

  private assertSlugAvailable = async (
    slug: string,
    excludeId?: string,
  ): Promise<void> => {
    const filter: QueryFilter<IBlogPost> = { slug };

    if (excludeId) {
      filter._id = { $ne: new mongoose.Types.ObjectId(excludeId) };
    }

    const exists = await BlogPostModel.exists(filter);

    if (exists) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "A post with this slug already exists.",
        [{ field: "slug", message: "This slug is already in use." }],
      );
    }
  };

  private generateUniqueSlug = async (title: string): Promise<string> => {
    const base = slugify(title).slice(0, 150).replace(/-+$/g, "");

    if (!base) {
      throw new ApiError(
        StatusCodes.UNPROCESSABLE_ENTITY,
        "A slug could not be generated from the title.",
        [{ field: "title", message: "Please provide a valid title." }],
      );
    }

    let candidate = base;
    let suffix = 2;

    while (await BlogPostModel.exists({ slug: candidate })) {
      candidate = `${base}-${suffix}`;
      suffix += 1;

      if (suffix > 1000) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          "A unique slug could not be generated.",
          [{ field: "slug", message: "Please provide an explicit slug." }],
        );
      }
    }

    return candidate;
  };

  getPublicPosts = async (
    query: TPublicBlogPostListQuery,
  ): Promise<TPublicBlogPostListResponse> => {
    const baseFilter: QueryFilter<IBlogPost> = {
      status: BLOG_POST_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    };
    const filter: QueryFilter<IBlogPost> = query.tag
      ? { ...baseFilter, "tags.slug": query.tag }
      : baseFilter;

    const [posts, total] = await Promise.all([
      BlogPostModel.find(filter)
        .sort({ publishedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      BlogPostModel.countDocuments(filter),
    ]);

    return {
      data: posts.map((post) => this.serializePublicSummary(post)),
      meta: {
        ...this.buildPageMeta(query.page, query.limit, total),
        tag: query.tag ?? null,
      },
    };
  };

  getPublicPost = async (slug: string): Promise<TBlogPostDetail> => {
    const post = await BlogPostModel.findOne({
      slug,
      status: BLOG_POST_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    });

    if (!post) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Blog post not found.");
    }

    const relatedPosts =
      post.tags.length > 0
        ? await BlogPostModel.find({
            _id: { $ne: post._id },
            status: BLOG_POST_STATUS.PUBLISHED,
            publishedAt: { $lte: new Date() },
            "tags.slug": { $in: post.tags.map((tag) => tag.slug) },
          })
            .sort({ publishedAt: -1, _id: -1 })
            .limit(BLOG_LIMITS.RELATED_POSTS)
        : [];

    return {
      ...this.serializePublicSummary(post),
      content: post.content,
      toc: post.toc.map((item) => ({
        id: item.id,
        text: item.text,
        level: item.level,
      })),
      related: relatedPosts.map((related) =>
        this.serializePublicSummary(related),
      ),
      updatedAt: post.updatedAt.toISOString(),
    };
  };

  getPublicTags = async (): Promise<TBlogTagListResponse> => {
    const match: QueryFilter<IBlogPost> = {
      status: BLOG_POST_STATUS.PUBLISHED,
      publishedAt: { $lte: new Date() },
    };

    const [tags, totalPublishedPosts] = await Promise.all([
      BlogPostModel.aggregate<{
        name: string;
        slug: string;
        count: number;
      }>([
        { $match: match },
        { $unwind: "$tags" },
        {
          $group: {
            _id: "$tags.slug",
            name: { $first: "$tags.name" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            name: 1,
            slug: "$_id",
            count: 1,
          },
        },
        { $sort: { name: 1 } },
      ]),
      BlogPostModel.countDocuments(match),
    ]);

    return {
      data: tags,
      meta: {
        totalPublishedPosts,
      },
    };
  };

  getPublicAuthor = async (): Promise<TBlogAuthorResponse> => {
    return {
      data: envConfig.blog.author,
    };
  };

  getAdminPosts = async (
    query: TAdminBlogPostListQuery,
  ): Promise<TAdminBlogPostListResponse> => {
    const filter: QueryFilter<IBlogPost> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.q) {
      const search = new RegExp(escapeRegExp(query.q), "i");
      filter.$or = [
        { title: search },
        { slug: search },
        { excerpt: search },
      ];
    }

    const [posts, total] = await Promise.all([
      BlogPostModel.find(filter)
        .sort({ updatedAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      BlogPostModel.countDocuments(filter),
    ]);

    return {
      data: posts.map((post) => this.serializeAdminSummary(post)),
      meta: {
        ...this.buildPageMeta(query.page, query.limit, total),
        status: query.status ?? null,
        q: query.q ?? null,
      },
    };
  };

  getAdminPost = async (id: string): Promise<TAdminBlogPostDetail> => {
    const post = await this.findAdminPost(id);

    return this.serializeAdminDetail(post);
  };

  createPost = async (
    payload: TCreateBlogPostPayload,
  ): Promise<TAdminBlogPostDetail> => {
    const content = this.validateContent(payload.content ?? EMPTY_TIPTAP_DOC);
    const tags = normalizeTags(payload.tags ?? []);
    const cover = payload.cover ? normalizeCover(payload.cover) : null;
    const slug =
      payload.slug ?? (await this.generateUniqueSlug(payload.title));

    if (payload.slug) {
      await this.assertSlugAvailable(payload.slug);
    }

    try {
      const post = await BlogPostModel.create({
        title: payload.title,
        slug,
        excerpt: payload.excerpt ?? "",
        content,
        cover,
        tags,
        status: BLOG_POST_STATUS.DRAFT,
        publishedAt: null,
        firstPublishedAt: null,
        authorId: envConfig.blog.author.id,
        readingTimeMinutes: computeReadingTime(content),
        toc: deriveToc(content),
      });

      return this.serializeAdminDetail(post);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          "A post with this slug already exists.",
          [{ field: "slug", message: "This slug is already in use." }],
        );
      }

      throw error;
    }
  };

  updatePost = async (
    id: string,
    payload: TUpdateBlogPostPayload,
  ): Promise<TAdminBlogPostDetail> => {
    const post = await this.findAdminPost(id);

    if (payload.slug !== undefined && payload.slug !== post.slug) {
      if (post.firstPublishedAt) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          "The slug cannot be changed after the post has been published.",
          [{ field: "slug", message: "The slug is locked after first publish." }],
        );
      }

      await this.assertSlugAvailable(payload.slug, id);
      post.slug = payload.slug;
    }

    if (payload.title !== undefined) {
      post.title = payload.title;
    }

    if (payload.excerpt !== undefined) {
      post.excerpt = payload.excerpt;
    }

    if (payload.content !== undefined) {
      const content = this.validateContent(payload.content);
      post.content = content;
      post.readingTimeMinutes = computeReadingTime(content);
      post.toc = deriveToc(content);
    }

    if (payload.cover !== undefined) {
      post.cover = normalizeCover(payload.cover);
    }

    if (payload.tags !== undefined) {
      post.tags = normalizeTags(payload.tags);
    }

    if (post.status === BLOG_POST_STATUS.PUBLISHED) {
      this.assertPublishable(post);
    }

    try {
      await post.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(
          StatusCodes.CONFLICT,
          "A post with this slug already exists.",
          [{ field: "slug", message: "This slug is already in use." }],
        );
      }

      throw error;
    }

    return this.serializeAdminDetail(post);
  };

  publishPost = async (
    id: string,
    payload: TPublishBlogPostPayload,
  ): Promise<TAdminBlogPostDetail> => {
    const post = await this.findAdminPost(id);

    if (post.status === BLOG_POST_STATUS.ARCHIVED) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Archived posts cannot be published.",
      );
    }

    this.assertPublishable(post);

    const publishedAt = payload.publishedAt
      ? new Date(payload.publishedAt)
      : new Date();

    post.status = BLOG_POST_STATUS.PUBLISHED;
    post.publishedAt = publishedAt;
    post.firstPublishedAt = post.firstPublishedAt ?? publishedAt;

    await post.save();

    return this.serializeAdminDetail(post);
  };

  unpublishPost = async (id: string): Promise<TAdminBlogPostDetail> => {
    const post = await this.findAdminPost(id);

    if (post.status !== BLOG_POST_STATUS.PUBLISHED) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Only published posts can be unpublished.",
      );
    }

    post.status = BLOG_POST_STATUS.DRAFT;
    post.publishedAt = null;

    await post.save();

    return this.serializeAdminDetail(post);
  };

  archivePost = async (id: string): Promise<TAdminBlogPostDetail> => {
    const post = await this.findAdminPost(id);

    post.status = BLOG_POST_STATUS.ARCHIVED;

    await post.save();

    return this.serializeAdminDetail(post);
  };

  deletePost = async (id: string): Promise<void> => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Blog post not found.");
    }

    const post = await BlogPostModel.findByIdAndDelete(id);

    if (!post) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Blog post not found.");
    }
  };
}
