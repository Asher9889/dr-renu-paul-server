# Authentication & User API Documentation

**Base URL:** `/api/v1`

**Authentication:** Cookie-based (accessToken + refreshToken)

---

## Auth Routes (`/api/v1/auth`)

### 1. Login

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "string (valid email, required)",
  "password": "string (required)",
  "rememberMe": "boolean (optional, default: false)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "id": "string",
      "email": "string",
      "role": "super_admin | admin | user"
    }
  }
}
```

**Cookies Set:**
- `accessToken` - HTTP-only, Secure (production), SameSite=Lax, Max-Age: 15min (or 30 days if rememberMe)
- `refreshToken` - HTTP-only, Secure (production), SameSite=Lax, Max-Age: 7 days (or 30 days if rememberMe)

**Error Responses:**
- `400 Bad Request` - Validation errors
- `401 Unauthorized` - Invalid credentials, inactive/blocked account

---

### 2. Refresh Access Token

**Endpoint:** `POST /auth/refresh`

**Request Body:** (Optional - can also use cookie)
```json
{
  "refreshToken": "string"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Token refreshed successfully.",
  "data": {}
}
```

**Cookies Updated:**
- `accessToken` - New access token
- `refreshToken` - New refresh token (rotated)

**Error Responses:**
- `401 Unauthorized` - Missing/invalid/expired refresh token

---

### 3. Logout

**Endpoint:** `POST /auth/logout`

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Logout successful.",
  "data": {}
}
```

**Cookies Cleared:**
- `accessToken` - Expired
- `refreshToken` - Expired

---

### 4. Get Current User

**Endpoint:** `GET /auth/me`

**Headers:** Requires valid `accessToken` cookie

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Current user fetched successfully.",
  "data": {
    "id": "string",
    "email": "string",
    "role": "super_admin | admin | user",
    "accountStatus": "active | inactive | blocked | pending_verification",
    "lastLoginAt": "ISO 8601 datetime string | null",
    "createdAt": "ISO 8601 datetime string",
    "updatedAt": "ISO 8601 datetime string"
  }
}
```

**Error Responses:**
- `401 Unauthorized` - Missing/invalid/expired access token

---

## User Routes (`/api/v1/users`)

> **Note:** All user routes require authentication with SUPER_ADMIN role.

### 1. List Users

**Endpoint:** `GET /users`

**Query Parameters:**
| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number (1-based) |
| `limit` | integer | No | 20 | Items per page (max 100) |
| `role` | string | No | - | Filter by role: `super_admin`, `admin`, `user` |
| `accountStatus` | string | No | - | Filter by status: `active`, `inactive`, `blocked`, `pending_verification` |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Users fetched successfully.",
  "data": [
    {
      "id": "string",
      "email": "string",
      "role": "super_admin | admin | user",
      "accountStatus": "active | inactive | blocked | pending_verification",
      "lastLoginAt": "ISO 8601 datetime string | null",
      "createdAt": "ISO 8601 datetime string",
      "updatedAt": "ISO 8601 datetime string"
    }
  ],
  "meta": {
    "page": "number",
    "limit": "number",
    "total": "number",
    "totalPages": "number"
  }
}
```

---

### 2. Create User

**Endpoint:** `POST /users`

**Request Body:**
```json
{
  "email": "string (valid email, required)",
  "password": "string (8-128 chars, required)",
  "role": "string (optional, default: user, enum: super_admin | admin | user)",
  "accountStatus": "string (optional, default: active, enum: active | inactive | blocked | pending_verification)"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "message": "User created successfully.",
  "data": {
    "id": "string",
    "email": "string",
    "role": "super_admin | admin | user",
    "accountStatus": "active | inactive | blocked | pending_verification",
    "lastLoginAt": "ISO 8601 datetime string | null",
    "createdAt": "ISO 8601 datetime string",
    "updatedAt": "ISO 8601 datetime string"
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors
- `409 Conflict` - Email already exists

---

### 3. Get Single User

**Endpoint:** `GET /users/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId |

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User fetched successfully.",
  "data": {
    // User object (without password)
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid ID format
- `404 Not Found` - User not found

---

### 4. Update User

**Endpoint:** `PATCH /users/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId |

**Request Body:** (All fields optional)
```json
{
  "email": "string (valid email)",
  "password": "string (8-128 chars)",
  "role": "string (enum: super_admin | admin | user)",
  "accountStatus": "string (enum: active | inactive | blocked | pending_verification)"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "User updated successfully.",
  "data": {
    // Updated user object
  }
}
```

**Error Responses:**
- `400 Bad Request` - Validation errors, invalid ID
- `404 Not Found` - User not found
- `409 Conflict` - Email already exists

---

### 5. Delete User

**Endpoint:** `DELETE /users/:id`

**Path Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | MongoDB ObjectId |

**Response:** `204 No Content`

**Error Responses:**
- `400 Bad Request` - Invalid ID format
- `404 Not Found` - User not found

---

## Data Structures

### TUserRole
| Value | Description |
|-------|-------------|
| `super_admin` | Full system access |
| `admin` | Administrative access |
| `user` | Standard user access |

### TAccountStatus
| Value | Description |
|-------|-------------|
| `active` | Normal active account |
| `inactive` | Temporarily disabled |
| `blocked` | Permanently blocked |
| `pending_verification` | Email verification pending |

### User Object (Safe - no password)
```typescript
interface IUser {
  id: string;
  email: string;
  role: TUserRole;
  accountStatus: TAccountStatus;
  lastLoginAt: string | null; // ISO 8601
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

### Pagination Meta
```typescript
interface Meta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

---

## Token Configuration

### Environment Variables
```env
# JWT Configuration
JWT_ACCESS_TOKEN_SECRET=your-super-secret-access-key
JWT_ACCESS_TOKEN_MAX_AGE=15m

JWT_REFRESH_TOKEN_SECRET=your-super-secret-refresh-key
JWT_REFRESH_TOKEN_MAX_AGE=7d

# Super Admin (for seeding)
SUPER_ADMIN_EMAIL=admin@example.com
SUPER_ADMIN_PASSWORD=secure-password
```

### Token Payloads

**Access Token:**
```typescript
interface TAccessTokenPayload {
  id: string;
  email: string;
  role: TUserRole;
}
```

**Refresh Token:**
```typescript
interface TRefreshTokenPayloadDecoded {
  id: string;
  email: string;
  type: "refresh";
}
```

---

## Cookie Configuration

| Cookie | HttpOnly | Secure | SameSite | Max-Age (Default) | Max-Age (Remember Me) |
|--------|----------|--------|----------|-------------------|----------------------|
| accessToken | Yes | Production | Lax | 15 min | 15 min |
| refreshToken | Yes | Production | Lax | 7 days | 30 days |

---

## Seeding Super Admin

Run the seeder to create the initial super admin:

```bash
npm run seed:admin
```

Requires environment variables:
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD`

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
- `409` - Conflict (duplicate email)
- `422` - Unprocessable Entity
- `500` - Internal Server Error