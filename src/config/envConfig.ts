import type { StringValue } from "ms";
import { parseStringDurationToMs } from "../utils/helpers/time/time.ts";

const minioEndpoint = (process.env.MINIO_ENDPOINT || "").replace(/\/+$/, "");
const minioBucketName = process.env.MINIO_BUCKET_NAME || "";
const minioPublicUrl = (process.env.MINIO_PUBLIC_URL || minioEndpoint).replace(/\/+$/, "");
const apiPublicUrl = (process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
const minioMediaMode = process.env.MINIO_MEDIA_MODE === "public" ? "public" : "proxy";

const envConfig = {
    port: Number(process.env.PORT),

    apiPublicUrl,

    minio: {
        endpoint: minioEndpoint,
        region: process.env.MINIO_REGION || "us-east-1",
        accessKey: process.env.MINIO_ACCESS_KEY || "",
        secretKey: process.env.MINIO_SECRET_KEY || "",
        bucketName: minioBucketName,
        publicUrl: minioPublicUrl,
        mediaMode: minioMediaMode,
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