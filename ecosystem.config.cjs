module.exports = {
    apps: [{
        name: "renu-paul-backend",
        script: "./dist/server.js",
        interpreter: "/Users/saurabh/.nvm/versions/node/v24.16.0/bin/node",
        env_production: {
            NODE_ENV: "production",
            PORT: "4520",

            //------------------ Database Configuration ------------------#
            MONGODB_URL: "mongodb://160.25.62.109:8109/renu-paul_db?replicaSet=rs0",

            //------ Admin credentials
            ADMIN_EMAIL: "drrenupaul@gmail.com",
            ADMIN_PASSWORD: "Admin@123",

            //------ JWT Configuration
            JWT_ACCESS_TOKEN_SECRET: "your_access_token_secret",
            JWT_ACCESS_TOKEN_MAX_AGE: "15m",
            JWT_REFRESH_TOKEN_SECRET: "your_refresh_token_secret",
            JWT_REFRESH_TOKEN_MAX_AGE: "7d",


            //------------ Minio ------------------------
            MINIO_MEDIA_MODE: "public",
            MINIO_PUBLIC_URL: "https://storage.mssplonline.in",
            MINIO_ENDPOINT: "https://storage.mssplonline.in",
            MINIO_ACCESS_KEY: "minioadmin",
            MINIO_SECRET_KEY: "minioadmin",
            MINIO_BUCKET_NAME: "saurabh",
        },
        env_development: {
            NODE_ENV: "DEVELOPMENT"
        }
    }]
}    