const port = Number(process.env.PORT);
const minioEndpoint = (process.env.MINIO_ENDPOINT || "").replace(/\/+$/, "");
const minioBucketName = process.env.MINIO_BUCKET_NAME || "";
const minioPublicUrl = (process.env.MINIO_PUBLIC_URL || minioEndpoint).replace(/\/+$/, "");
const apiPublicUrl = (process.env.API_PUBLIC_URL || "").replace(/\/+$/, "");
const minioMediaMode = process.env.MINIO_MEDIA_MODE === "public" ? "public" : "proxy";

const envConfig = {
    port,

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

    // redis Configuration
    // redis: {
    //     host: process.env.REDIS_SERVER_HOST!,
    //     port: Number(process.env.REDIS_SERVER_PORT!),
    //     password: process.env.REDIS_SERVER_PASSWORD!,
    // },

    // queue : {
    //     prefix: process.env.QUEUE_PREFIX!,
    // },
    // Super Admin Configuration
    // superAdmin: {
    //     email: process.env.SUPER_ADMIN_EMAIL!,
    //     password: process.env.SUPER_ADMIN_PASSWORD!,
    // },


    // telegram: {
    //     apiId: Number(process.env.TELEGRAM_API_ID)!,
    //     apiHash: process.env.TELEGRAM_API_HASH!,
    //     sessionEncryptionKey: process.env.TELEGRAM_SESSION_ENCRYPTION_KEY!,
    // },

    // // JWT Configuration
    // jwtConfig: {
    //     accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET!,
    //     accessTokenMaxAgeMs: parseStringDurationToMs(process.env.JWT_ACCESS_TOKEN_MAX_AGE as StringValue, "JWT_ACCESS_TOKEN_MAX_AGE"),

    //     refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET!,
    //     refreshTokenMaxAgeMs: parseStringDurationToMs(process.env.JWT_REFRESH_TOKEN_MAX_AGE as StringValue, "JWT_REFRESH_TOKEN_MAX_AGE"),
    // },

    // // ollama Configuration
    // ollama: {
    //     host: process.env.OLLAMA_HOST!,
    // },

    // models: {
    //     qwen2_5_7b: process.env.QWEN_2_5_7B!,
    // },

    // // minio Configuration
    // minio: {
    //     endPoint: process.env.MINIO_ENDPOINT_STORAGE!,
    //     accessKey: process.env.MINIO_ACCESS_KEY!,
    //     secretKey: process.env.MINIO_SECRET_KEY!,
    //     bucketName: process.env.MINIO_BUCKET_NAME!,
    // },

    // // OpenCode Configuration
    // opencode: {
    //     serverUsername: process.env.OPENCODE_SERVER_USERNAME!,
    //     serverPassword: process.env.OPENCODE_SERVER_PASSWORD!,
    //     serverHost: process.env.OPENCODE_SERVER_HOST!,
    //     serverPort: Number(process.env.OPENCODE_SERVER_PORT!),
    //     /** Free model in "providerID/modelID" form, e.g. "opencode/big-pickle". */
    //     freeModel: process.env.OPENCODE_FREE_MODEL || "opencode/big-pickle",
    //     /** Hard cap for a single browser-agent run. */
    //     taskTimeoutMs: Number(process.env.OPENCODE_TASK_TIMEOUT_MS || 600_000),
    // },


}

export default envConfig;