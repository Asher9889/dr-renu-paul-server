export const BLOG_POST_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export const BLOG_LIMITS = {
  PUBLIC_DEFAULT_LIMIT: 9,
  PUBLIC_MAX_LIMIT: 30,
  ADMIN_DEFAULT_LIMIT: 20,
  ADMIN_MAX_LIMIT: 100,
  RELATED_POSTS: 3,
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  READING_WORDS_PER_MINUTE: 200,
} as const;

export const BLOG_MESSAGES = {
  POSTS_FETCHED: "Blog posts fetched successfully.",
  POST_FETCHED: "Blog post fetched successfully.",
  POST_CREATED: "Blog post created successfully.",
  POST_UPDATED: "Blog post updated successfully.",
  POST_PUBLISHED: "Blog post published successfully.",
  POST_UNPUBLISHED: "Blog post unpublished successfully.",
  POST_ARCHIVED: "Blog post archived successfully.",
  POST_DELETED: "Blog post deleted successfully.",
  TAGS_FETCHED: "Blog tags fetched successfully.",
  AUTHOR_FETCHED: "Blog author fetched successfully.",
  MEDIA_UPLOADED: "Blog media uploaded successfully.",
} as const;

export const BLOG_ALLOWED_IMAGE_TYPES = {
  "image/jpeg": { extension: "jpg" },
  "image/png": { extension: "png" },
  "image/webp": { extension: "webp" },
  "image/avif": { extension: "avif" },
} as const;

export const BLOG_MEDIA_KEY_PATTERN =
  /^blog\/\d{4}\/\d{2}\/[0-9a-f-]+\.(?:jpg|png|webp|avif)$/;

export const BLOG_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
