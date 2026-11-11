// Membuat bucket S3 (MinIO) bila belum ada. Dipanggil oleh `npm run infra:up`.
import "dotenv/config";
import { CreateBucketCommand, HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";

const bucket = process.env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

for (let i = 0; i < 20; i++) {
  try {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`Bucket "${bucket}" sudah ada.`);
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`Bucket "${bucket}" dibuat.`);
    }
    process.exit(0);
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
console.error("Gagal terhubung ke object storage.");
process.exit(1);
