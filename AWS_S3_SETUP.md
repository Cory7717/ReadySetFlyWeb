# AWS S3 Configuration for Image Uploads

## Required Environment Variables

Add these to your Render service:

```bash
AWS_S3_BUCKET=your-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
```

## AWS S3 Setup Steps

### 1. Create S3 Bucket
1. Log into AWS Console → S3
2. Click "Create bucket"
3. Bucket name: `readysetfly-uploads` (or your choice)
4. Region: `us-east-1` (or your preferred region)
5. **Uncheck** "Block all public access" (we need public read for listing images)
6. Click "Create bucket"

### 2. Configure Bucket Policy
1. Select your bucket → Permissions tab
2. Scroll to "Bucket policy" → Edit
3. Paste this policy (replace `readysetfly-uploads` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::readysetfly-uploads/uploads/*"
    }
  ]
}
```

4. Click "Save changes"

### 3. Configure CORS
1. Same bucket → Permissions tab
2. Scroll to "Cross-origin resource sharing (CORS)" → Edit
3. Paste this:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": [
      "https://readysetfly.us",
      "https://www.readysetfly.us",
      "http://localhost:5173"
    ],
    "ExposeHeaders": ["ETag"]
  }
]
```

4. Click "Save changes"

### 4. Create IAM User for API Access
1. AWS Console → IAM → Users → "Create user"
2. User name: `readysetfly-api`
3. **No** console access needed
4. Next → Attach policies directly
5. Search and select: `AmazonS3FullAccess` (or create custom policy below)
6. Create user

**Custom Policy (more secure):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::readysetfly-uploads/uploads/*"
    }
  ]
}
```

### 5. Create Access Keys
1. Select the new user → Security credentials tab
2. Scroll to "Access keys" → "Create access key"
3. Use case: Application running outside AWS
4. **Copy both:**
   - Access key ID
   - Secret access key (shown only once!)

### 6. Add to Render
1. Render Dashboard → Your service → Environment
2. Add each variable:
   - `AWS_S3_BUCKET` = `readysetfly-uploads`
   - `AWS_REGION` = `us-east-1`
   - `AWS_ACCESS_KEY_ID` = (paste your key)
   - `AWS_SECRET_ACCESS_KEY` = (paste your secret)
3. Click "Save Changes"
4. Render will auto-redeploy

## Verification

After deployment:
1. Try uploading an image in CFI or marketplace listing
2. Check browser console for errors
3. Check Render logs for: `[Uppy]` or `POST /api/objects/upload`
4. Verify image appears in S3 bucket under `uploads/` folder

## Cost Estimate
- **Storage**: ~$0.023/GB/month
- **PUT requests**: $0.005 per 1,000 requests
- **GET requests**: $0.0004 per 1,000 requests

**Typical monthly cost for small site: < $1**

## Troubleshooting

**403 Forbidden on upload:**
- Check IAM user has `s3:PutObject` permission
- Verify CORS settings include your domain

**Images upload but don't display:**
- Check bucket policy allows public GetObject
- Verify bucket "Block public access" is disabled for GetObject

**500 Error on /api/objects/upload:**
- Check all 4 env vars are set in Render
- Check Render logs for exact error message
