import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import type { FileStorage } from "../storage";

export interface S3FileStorageOptions {
  bucket: string;
  endpoint?: string;
  region?: string;
  prefix?: string;
}

export class S3FileStorage implements FileStorage {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(opts: S3FileStorageOptions) {
    this.bucket = opts.bucket;
    this.prefix = opts.prefix ?? "intake";
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? "fr-par",
      forcePathStyle: true,
    });
  }

  async upload(key: string, data: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${this.prefix}/${key}`,
        Body: data,
        ContentType: "application/pdf",
      })
    );
  }

  async download(key: string): Promise<Buffer> {
    const resp = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: `${this.prefix}/${key}`,
      })
    );
    const bytes = await resp.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Empty body for key: ${key}`);
    return Buffer.from(bytes);
  }
}
