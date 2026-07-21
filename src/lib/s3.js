import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

export async function uploadToS3(filePath, key, contentType = "audio/mpeg") {
  const fileStream = fs.createReadStream(filePath);
  const uploadParams = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: fileStream,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(uploadParams);
  await s3.send(command);
  return key;
}

export async function generatePresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return await getSignedUrl(s3, command, { expiresIn });
}
