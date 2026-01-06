import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// AWS S3 storage service for production deployment
export class S3StorageService {
  private client: S3Client;
  private bucket: string;

  constructor() {
    const region = process.env.AWS_REGION || "us-east-1";
    this.bucket = process.env.AWS_S3_BUCKET || "";

    if (!this.bucket) {
      throw new Error("AWS_S3_BUCKET environment variable is required");
    }

    this.client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }

  /**
   * Generate a presigned PUT URL for direct browser upload to S3
   * @returns Presigned URL valid for 15 minutes
   */
  async getPresignedUploadUrl(): Promise<string> {
    const key = `uploads/${randomUUID()}`;
    
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: "image/*",
    });

    const uploadURL = await getSignedUrl(this.client, command, {
      expiresIn: 900, // 15 minutes
    });

    return uploadURL;
  }

  /**
   * Get public URL for an uploaded object
   * @param uploadURL - The presigned URL returned from upload
   * @returns Clean public URL without query params
   */
  getPublicUrl(uploadURL: string): string {
    return uploadURL.split("?")[0];
  }

  /**
   * Make an object publicly readable (ACL is set via bucket policy in AWS)
   * Note: For new S3 buckets, use bucket policies instead of object ACLs
   * @param imageUrl - The public URL of the image
   */
  async setPublicRead(imageUrl: string): Promise<void> {
    // Modern S3 buckets use bucket policies for public access
    // Object ACLs are deprecated; this is a no-op
    // Set your bucket policy to allow public GetObject on uploads/* prefix
    console.log("ACL update requested for:", imageUrl);
  }
}
