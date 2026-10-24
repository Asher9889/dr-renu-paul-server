import { S3Client } from "@aws-sdk/client-s3";
import envConfig from "./envConfig.ts";

const s3Client = new S3Client({
  region: envConfig.minio.region,
  endpoint: envConfig.minio.endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: envConfig.minio.accessKey,
    secretAccessKey: envConfig.minio.secretKey,
  },
});

export default s3Client;
