import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: process.env.AWS_REGION || "eu-west-2",
    });
  }
  return client;
}

function bucket(): string {
  const name = process.env.IMPORT_S3_BUCKET;
  if (!name) throw new Error("IMPORT_S3_BUCKET must be set when IMPORT_STORAGE_BACKEND=s3");
  return name;
}

export function s3StorageUri(key: string): string {
  return `s3://${bucket()}/${key}`;
}

export function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  if (!uri.startsWith("s3://")) return null;
  const rest = uri.slice(5);
  const slash = rest.indexOf("/");
  if (slash < 1) return null;
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}

export async function s3Save(key: string, content: string | Buffer): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: typeof content === "string" ? Buffer.from(content, "utf8") : content,
    }),
  );
  return s3StorageUri(key);
}

export async function s3Read(uri: string): Promise<string> {
  const parsed = parseS3Uri(uri);
  if (!parsed) throw new Error("Invalid S3 storage URI");
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
  );
  return (await res.Body?.transformToString("utf8")) ?? "";
}

export async function s3Delete(uri: string): Promise<void> {
  const parsed = parseS3Uri(uri);
  if (!parsed) return;
  try {
    await getClient().send(
      new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.key }),
    );
  } catch {
    // ignore missing objects
  }
}
