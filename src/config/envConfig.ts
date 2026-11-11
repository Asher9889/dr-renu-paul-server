import type { StringValue } from "ms";
import { parseStringDurationToMs } from "../utils/helpers/time/time.ts";

const minioEndpoint = (process.env.MINIO_ENDPOINT || "").replace(/\/+$/, "");
const minioBucketName = process.env.MINIO_BUCKET_NAME || "";
const minioPublicUrl = (process.env.MINIO_PUBLIC_URL || minioEndpoint).replace(/\/+$/, "");
const apiPublicUrl = (process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
const minioMediaMode = process.env.MINIO_MEDIA_MODE === "public" ? "public" : "proxy";
const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:3000").replace(/\/+$/, "");
// Matches the callback already registered in the Google Cloud console. The
// Next.js app proxies this legacy path to the API.
const googleRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${frontendUrl}/api/auth/callback/google`;

const envConfig = {
    port: Number(process.env.PORT),

    apiPublicUrl,

    google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirectUri: googleRedirectUri,
        frontendUrl,
    },

    minio: {
        endpoint: minioEndpoint,
        region: process.env.MINIO_REGION || "us-east-1",
        accessKey: process.env.MINIO_ACCESS_KEY || "",
        secretKey: process.env.MINIO_SECRET_KEY || "",
        bucketName: minioBucketName,
        publicUrl: minioPublicUrl,
        mediaMode: minioMediaMode,
    },

    book: {
        worker: {
            enabled: process.env.BOOK_WORKER_ENABLED !== "false",
        },
        reader: {
            pageCacheSeconds: Number(process.env.BOOK_PAGE_CACHE_SECONDS) || 3600,
        },
    },

    razorpay: {
        // Test or live credentials from the Razorpay dashboard.
        keyId: process.env.RAZORPAY_KEY!,
        keySecret: process.env.RAZORPAY_KEY_SECRET!,
        webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET!,
    },

    blog: {
        author: {
            id: "author_01",
            name: process.env.BLOG_AUTHOR_NAME || "Dr. Renu Paul",
            role: process.env.BLOG_AUTHOR_ROLE || "MD (Hom.) · Senior Homoeopath",
            avatar: {
                url: process.env.BLOG_AUTHOR_AVATAR_URL || `${minioPublicUrl}/${minioBucketName}/author/dr-renu-paul.webp`,
                alt: process.env.BLOG_AUTHOR_AVATAR_ALT || "Portrait of Dr. Renu Paul",
            },
        },
    },

    // MongoDB Configuration
    mongodbConnectionString: process.env.MONGODB_URL!,

    // Super Admin Configuration
    superAdmin: {
        email: process.env.SUPER_ADMIN_EMAIL!,
        password: process.env.SUPER_ADMIN_PASSWORD!,
    },

    // JWT Configuration
    jwtConfig: {
        accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET!,
        accessTokenMaxAgeMs: parseStringDurationToMs(process.env.JWT_ACCESS_TOKEN_MAX_AGE as StringValue, "JWT_ACCESS_TOKEN_MAX_AGE"),

        refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET!,
        refreshTokenMaxAgeMs: parseStringDurationToMs(process.env.JWT_REFRESH_TOKEN_MAX_AGE as StringValue, "JWT_REFRESH_TOKEN_MAX_AGE"),
    },
}

export default envConfig;