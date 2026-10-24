# Blog API Documentation

**Base URL:** `/api/v1`

**Authentication:**
- Public routes: No authentication required
- Admin routes: Require `authenticate` + `authorize(SUPER_ADMIN)` middleware

---

## Public Routes (`/api/v1/blog`)

### 1. List Published Blog Posts

**Endpoint:** `GET /blog/posts`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tag` | string | No | - | Filter posts by tag slug (lowercase kebab-case) |
| `page` | integer | No | 1 | Page number (1-based) |
| `limit` | integer | No | 9 | Items per page (max 30) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog posts fetched successfully.",
  "data": [
    {
      "id": "string",
      "slug": "string",
      "title": "string",
      "excerpt": "string",
      "cover": {
        "url": "string",
        "alt": "string",
        "caption": "string | null",
        "width": "number",
        "height": "number"
      },
      "tags": [
        { "name": "string", "slug": "string" }
      ],
      "publishedAt": "ISO 8601 datetime string",
      "readingTimeMinutes": "number"
    }
  ],
  "meta": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasNextPage": "boolean",
    "hasPreviousPage": "boolean",
    "tag": "string | null"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid query parameters

---

### 2. Get Single Published Blog Post

**Endpoint:** `GET /blog/posts/:slug`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `slug` | string | Yes | Blog post slug (lowercase kebab-case, max 160 chars) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post fetched successfully.",
  "data": {
    "id": "string",
    "slug": "string",
    "title": "string",
    "excerpt": "string",
    "cover": {
      "url": "string",
      "alt": "string",
      "caption": "string | null",
      "width": "number",
      "height": "number"
    },
    "tags": [
      { "name": "string", "slug": "string" }
    ],
    "publishedAt": "ISO 8601 datetime string",
    "readingTimeMinutes": "number",
    "content": {
      "type": "doc",
      "content": [
        {
          "type": "paragraph",
          "content": [
            { "type": "text", "text": "string", "marks": [] }
          ]
        },
        {
          "type": "heading",
          "attrs": { "id": "string", "level": 2 | 3 },
          "content": [...]
        }
        // ... other TipTap block nodes
      ]
    },
    "toc": [
      { "id": "string", "text": "string", "level": 2 | 3 }
    ],
    "related": [
      // TBlogPostSummary objects (max 3)
    ],
    "updatedAt": "ISO 8601 datetime string"
  }
}
```

**Error Responses:**
- `404 Not Found` - Post not found or not published
- `400 Bad Request` - Invalid slug format

---

### 3. Get All Tags

**Endpoint:** `GET /blog/tags`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog tags fetched successfully.",
  "data": [
    {
      "name": "string",
      "slug": "string",
      "count": "number"
    }
  ],
  "meta": {
    "totalPublishedPosts": "number"
  }
}
```

---

### 4. Get Blog Author

**Endpoint:** `GET /blog/author`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog author fetched successfully.",
  "data": {
    "id": "string",
    "name": "string",
    "role": "string",
    "avatar": {
      "url": "string",
      "alt": "string"
    }
  }
}
```

---

### 5. Serve Blog Media

**Endpoint:** `GET /blog/media/:folder/:year/:month/:filename`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `folder` | string | Yes | Media folder name (e.g., "posts") |
| `year` | string | Yes | 4-digit year (e.g., "2024") |
| `month` | string | Yes | 2-digit month (e.g., "01") |
| `filename` | string | Yes | Filename with extension |

**Response:** `200 OK` - Binary image data with appropriate headers:
- `Content-Type`: image/jpeg, image/png, image/webp, or image/avif
- `Cache-Control`: public, max-age=31536000, immutable
- `Content-Length`: byte size

**Error Responses:**
- `404 Not Found` - Media file not found

---

## Admin Routes (`/api/v1/admin/blog`)

> **Note:** All admin routes require authentication with SUPER_ADMIN role.

### 1. List All Blog Posts (Admin)

**Endpoint:** `GET /admin/blog/posts`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status: `draft`, `published`, `archived` |
| `q` | string | No | - | Search query (title, slug, excerpt - max 120 chars) |
| `page` | integer | No | 1 | Page number (1-based) |
| `limit` | integer | No | 20 | Items per page (max 100) |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog posts fetched successfully.",
  "data": [
    {
      "id": "string",
      "slug": "string",
      "title": "string",
      "excerpt": "string",
      "cover": {
        "url": "string",
        "alt": "string",
        "caption": "string | null",
        "width": "number",
        "height": "number"
      } | null,
      "tags": [
        { "name": "string", "slug": "string" }
      ],
      "status": "draft | published | archived",
      "publishedAt": "ISO 8601 datetime string | null",
      "readingTimeMinutes": "number",
      "createdAt": "ISO 8601 datetime string",
      "updatedAt": "ISO 8601 datetime string"
    }
  ],
  "meta": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number",
    "hasNextPage": "boolean",
    "hasPreviousPage": "boolean",
    "status": "draft | published | archived | null",
    "q": "string | null"
  }
}
```

---

### 2. Create Blog Post

**Endpoint:** `POST /admin/blog/posts`

**Request Body:**
```json
{
  "title": "string (1-200 chars, required)",
  "slug": "string (optional, 1-160 chars, lowercase kebab-case, auto-generated if omitted)",
  "excerpt": "string (optional, max 200 chars)",
  "content": {
    "type": "doc",
    "content": [
      // TipTap JSON document structure
    ]
  },
  "cover": {
    "url": "string (valid HTTP/HTTPS URL, required)",
    "alt": "string (1-300 chars, required)",
    "caption": "string (optional, max 500 chars)",
    "width": "integer (1-20000, required)",
    "height": "integer (1-20000, required)"
  },
  "tags": [
    "string (1-60 chars each, max 20 tags)"
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Blog post created successfully.",
  "data": {
    // TAdminBlogPostDetail (includes content)
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Slug already exists
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 3. Get Single Blog Post (Admin)

**Endpoint:** `GET /admin/blog/posts/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post fetched successfully.",
  "data": {
    // TAdminBlogPostDetail (includes full content)
  }
}
```

**Error Responses:**
- `404 Not Found` - Post not found
- `400 Bad Request` - Invalid ID format
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 4. Update Blog Post

**Endpoint:** `PATCH /admin/blog/posts/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Request Body:** (All fields optional - partial update)
```json
{
  "title": "string (1-200 chars)",
  "slug": "string (1-160 chars, lowercase kebab-case)",
  "excerpt": "string (max 200 chars)",
  "content": { "type": "doc", "content": [...] },
  "cover": { /* TBlogCoverInput */ },
  "tags": ["string"]
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post updated successfully.",
  "data": {
    // TAdminBlogPostDetail
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `404 Not Found` - Post not found
- `409 Conflict` - Slug already exists
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 5. Publish Blog Post

**Endpoint:** `POST /admin/blog/posts/:id/publish`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Request Body:** (Optional)
```json
{
  "publishedAt": "ISO 8601 datetime string with offset (optional, defaults to now)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post published successfully.",
  "data": {
    // TAdminBlogPostDetail
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid publishedAt format, or post cannot be published
- `404 Not Found` - Post not found
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 6. Unpublish Blog Post

**Endpoint:** `POST /admin/blog/posts/:id/unpublish`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post unpublished successfully.",
  "data": {
    // TAdminBlogPostDetail
  }
}
```

**Error Responses:**
- `404 Not Found` - Post not found
- `400 Bad Request` - Post cannot be unpublished (e.g., already draft)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 7. Archive Blog Post

**Endpoint:** `POST /admin/blog/posts/:id/archive`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Blog post archived successfully.",
  "data": {
    // TAdminBlogPostDetail
  }
}
```

**Error Responses:**
- `404 Not Found` - Post not found
- `400 Bad Request` - Post cannot be archived
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 8. Delete Blog Post

**Endpoint:** `DELETE /admin/blog/posts/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId of the post |

**Response:** `204 No Content`

**Error Responses:**
- `404 Not Found` - Post not found
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

### 9. Upload Media

**Endpoint:** `POST /admin/blog/media`

**Content-Type:** `multipart/form-data`

**Form Fields:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Image file (JPEG, PNG, WebP, AVIF - max 8MB) |

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "Blog media uploaded successfully.",
  "data": {
    "url": "string (full public URL to the uploaded image)",
    "key": "string (S3/storage key, e.g., blog/2024/01/uuid.jpg)",
    "contentType": "string (MIME type)",
    "size": "number (bytes)",
    "width": "number",
    "height": "number"
  }
}
```

**Error Responses:**
- `400 Bad Request` - No file provided, invalid file type, or file too large
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not SUPER_ADMIN

---

## Data Structures

### TBlogPostSummary (Public List Item)
```typescript
interface TBlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: TBlogCover;
  tags: TBlogTag[];
  publishedAt: string; // ISO 8601
  readingTimeMinutes: number;
}
```

### TBlogPostDetail (Public Single Post)
```typescript
interface TBlogPostDetail extends TBlogPostSummary {
  content: TTiptapDoc;
  toc: TBlogTocItem[];
  related: TBlogPostSummary[];
  updatedAt: string; // ISO 8601
}
```

### TAdminBlogPostSummary (Admin List Item)
```typescript
interface TAdminBlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: TBlogCover | null;
  tags: TBlogTag[];
  status: TBlogPostStatus; // "draft" | "published" | "archived"
  publishedAt: string | null; // ISO 8601
  readingTimeMinutes: number;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### TAdminBlogPostDetail (Admin Single Post)
```typescript
interface TAdminBlogPostDetail extends TAdminBlogPostSummary {
  content: TTiptapDoc;
}
```

### TBlogCover
```typescript
interface TBlogCover {
  url: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
}
```

### TBlogTag
```typescript
interface TBlogTag {
  name: string;
  slug: string;
}

interface TBlogTagWithCount extends TBlogTag {
  count: number;
}
```

### TBlogTocItem
```typescript
interface TBlogTocItem {
  id: string;
  text: string;
  level: 2 | 3;
}
```

### TBlogAuthor
```typescript
interface TBlogAuthor {
  id: string;
  name: string;
  role: string;
  avatar: {
    url: string;
    alt: string;
  };
}
```

### Pagination Meta (TPageMeta)
```typescript
interface TPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

### TipTap Document Structure (TTiptapDoc)
The content uses TipTap JSON format. Supported nodes:

- **Paragraph:** `{ type: "paragraph", content: TTiptapInlineNode[] }`
- **Heading (H2/H3):** `{ type: "heading", attrs: { id: string, level: 2|3 }, content: TTiptapInlineNode[] }`
- **Bullet List:** `{ type: "bulletList", content: TTiptapListItemNode[] }`
- **Ordered List:** `{ type: "orderedList", content: TTiptapListItemNode[] }`
- **Blockquote:** `{ type: "blockquote", attrs?: { attribution?: string }, content: TTiptapBlockNode[] }`
- **List Item:** `{ type: "listItem", content: TTiptapBlockNode[] }`

**Inline Nodes:**
- Text: `{ type: "text", text: string, marks?: TTiptapMark[] }`
- Hard Break: `{ type: "hardBreak" }`

**Marks:**
- Bold: `{ type: "bold" }`
- Italic: `{ type: "italic" }`
- Link: `{ type: "link", attrs: { href: string, target?: "_blank"|"_self", rel?: string } }`

---

## Constants

### Post Status Values
| Value | Description |
|-------|-------------|
| `draft` | Work in progress, not visible publicly |
| `published` | Live and visible on public blog |
| `archived` | Hidden from public, preserved for reference |

### Limits
| Constant | Value |
|----------|-------|
| `PUBLIC_DEFAULT_LIMIT` | 9 |
| `PUBLIC_MAX_LIMIT` | 30 |
| `ADMIN_DEFAULT_LIMIT` | 20 |
| `ADMIN_MAX_LIMIT` | 100 |
| `RELATED_POSTS` | 3 |
| `MAX_UPLOAD_BYTES` | 8MB |
| `READING_WORDS_PER_MINUTE` | 200 |

### Allowed Image Types
- `image/jpeg` (.jpg)
- `image/png` (.png)
- `image/webp` (.webp)
- `image/avif` (.avif)

### Slug Pattern
`^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase kebab-case)

---

## Error Response Format

All errors follow this structure:
```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "field": "string",
      "message": "string"
    }
  ]
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `204` - No Content
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid auth)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate slug)
- `422` - Unprocessable Entity
- `500` - Internal Server Error