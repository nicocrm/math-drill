import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import type { ExerciseSet } from "../types/exercise";
import type { ExerciseStorage } from "../storage";

export interface S3ExerciseStorageOptions {
  bucket: string;
  endpoint?: string;
  region?: string;
  prefix?: string;
}

export class S3ExerciseStorage implements ExerciseStorage {
  private client: S3Client;
  private bucket: string;
  private prefix: string;

  constructor(opts: S3ExerciseStorageOptions) {
    this.bucket = opts.bucket;
    this.prefix = opts.prefix ?? "exercises";
    this.client = new S3Client({
      endpoint: opts.endpoint,
      region: opts.region ?? "fr-par",
      forcePathStyle: true,
    });
  }

  private key(userId: string, id: string): string {
    return `${this.prefix}/${userId}/${id}.json`;
  }

  async list(): Promise<ExerciseSet[]> {
    const exercises: ExerciseSet[] = [];
    let continuationToken: string | undefined;

    do {
      const resp = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.prefix}/`,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of resp.Contents ?? []) {
        if (!obj.Key?.endsWith(".json")) continue;
        const exercise = await this.getByKey(obj.Key);
        if (exercise) exercises.push(exercise);
      }

      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    return exercises.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async listByUser(userId: string): Promise<ExerciseSet[]> {
    const exercises: ExerciseSet[] = [];
    let continuationToken: string | undefined;

    do {
      const resp = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: `${this.prefix}/${userId}/`,
          ContinuationToken: continuationToken,
        })
      );

      for (const obj of resp.Contents ?? []) {
        if (!obj.Key?.endsWith(".json")) continue;
        const exercise = await this.getByKey(obj.Key);
        if (exercise) exercises.push(exercise);
      }

      continuationToken = resp.NextContinuationToken;
    } while (continuationToken);

    return exercises.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async get(id: string): Promise<ExerciseSet | null> {
    // We don't know the userId, so list all and find by id
    const resp = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${this.prefix}/`,
      })
    );

    const match = (resp.Contents ?? []).find((obj) =>
      obj.Key?.endsWith(`/${id}.json`)
    );
    if (!match?.Key) return null;
    return this.getByKey(match.Key);
  }

  async save(exercise: ExerciseSet): Promise<void> {
    const userId = exercise.createdBy ?? "anonymous";
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.key(userId, exercise.id),
        Body: JSON.stringify(exercise, null, 2),
        ContentType: "application/json",
      })
    );
  }

  async delete(id: string): Promise<boolean> {
    // Find the key first
    const resp = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: `${this.prefix}/`,
      })
    );

    const match = (resp.Contents ?? []).find((obj) =>
      obj.Key?.endsWith(`/${id}.json`)
    );
    if (!match?.Key) return false;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: match.Key,
      })
    );
    return true;
  }

  private async getByKey(key: string): Promise<ExerciseSet | null> {
    try {
      const resp = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const body = await resp.Body?.transformToString();
      if (!body) return null;
      return JSON.parse(body) as ExerciseSet;
    } catch {
      return null;
    }
  }
}
