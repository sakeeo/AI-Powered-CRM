import {
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

const globalForS3 = globalThis as unknown as { s3?: S3Client };

export const s3 =
  globalForS3.s3 ??
  new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true, // wajib untuk MinIO / S3-compatible
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  });

if (env.NODE_ENV !== "production") globalForS3.s3 = s3;

/** Key selalu diawali `<organizationId>/` agar file antar tenant terpisah. */
export function tenantKey(organizationId: string, path: string): string {
  if (!organizationId) throw new Error("organizationId wajib diisi");
  const clean = path.replace(/^\/+/, "");
  if (clean.split("/").includes("..")) throw new Error("Path tidak valid");
  return `${organizationId}/${clean}`;
}

export async function putTenantObject(
  organizationId: string,
  path: string,
  body: Uint8Array | string,
  contentType?: string,
) {
  const key = tenantKey(organizationId, path);
  await s3.send(
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return key;
}

export async function getTenantObject(organizationId: string, path: string): Promise<Uint8Array> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: tenantKey(organizationId, path) }),
  );
  return res.Body!.transformToByteArray();
}

export async function checkStorage() {
  await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
}
