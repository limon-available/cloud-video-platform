# Backend Setup Notes


## S3 CORS for Direct Uploads

If you see this browser error during upload:
`Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present on the requested resource.`

Fix: configure the bucket CORS in AWS Console.

### AWS Console Steps

1) S3 bucket `cloud-video-platform` → **Permissions** → scroll to **Cross-origin resource sharing (CORS)** → **Edit** and paste:

```xml
<CORSConfiguration>
  <CORSRule>
    <AllowedOrigin>https://cloud-video.netlify.app</AllowedOrigin>
    <AllowedOrigin>http://localhost:5173</AllowedOrigin>
    <AllowedMethod>PUT</AllowedMethod>
    <AllowedMethod>GET</AllowedMethod>
    <AllowedMethod>HEAD</AllowedMethod>
    <AllowedHeader>*</AllowedHeader>
    <ExposeHeader>ETag</ExposeHeader>
    <MaxAgeSeconds>3000</MaxAgeSeconds>
  </CORSRule>
</CORSConfiguration>
```

2) Save.

### IAM Verification

Ensure the IAM user whose keys are in `backend/.env` has at least:
- `s3:PutBucketCors`
- `s3:GetBucketCors`

### App Note

`backend/server.js` calls `ensureS3Cors(process.env.AWS_S3_BUCKET_NAME)` on startup. If startup logs show:
`Failed to configure S3 CORS for bucket ...`
then fix the IAM permissions above.

---

# AWS Deployment Guide

This guide covers the existing implementation only — no code changes.

## 1. Lambda Function

### 1.1 Create Function
- AWS Console → Lambda → **Create function**
- Name: `cloud-video-processor`
- Runtime: **Node.js 20.x**
- Architecture: **x86_64**
- Permissions: Create a new role with Lambda permissions (you can attach policies later)

### 1.2 Files to Upload
Package the Lambda deployment from the `lambda/` directory.

Required contents:
- `lambda/processVideo.js`
- `lambda/package.json`
- `lambda/node_modules/`

Build steps:
```bash
cd lambda
npm install
zip -r ../lambda-deploy.zip .
```

Then in the Lambda console:
- **Code source** → **Upload from** → `.zip file` → upload `lambda-deploy.zip`

### 1.3 Lambda Configuration
- Timeout: **5 minutes** (or more, depending on video size)
- Memory: **1024 MB** (recommended for ffmpeg)
- Ephemeral storage: **512 MB** minimum

## 2. IAM Role and Permissions

### 2.1 Role Name
`cloud-video-lambda-role`

### 2.2 Trust Policy
Allow Lambda service to assume the role:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

### 2.3 Permissions Policy
Attach an inline policy with:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::cloud-video-platform/videos/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::cloud-video-platform/thumbnails/*"
    },
    {
      "Effect": "Allow",
      "Action": ["sns:Publish"],
      "Resource": "arn:aws:sns:*:*:cloud-video-notifications"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::cloud-video-platform/*"
    }
  ]
}
```

## 3. Environment Variables

In the Lambda console → **Configuration** → **Environment variables**, add:

| Variable | Value | Example |
|----------|-------|---------|
| `AWS_REGION` | Bucket region | `eu-north-1` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster...` |
| `AWS_S3_BUCKET_NAME` | S3 bucket name | `cloud-video-platform` |
| `CLOUDFRONT_DOMAIN` | CloudFront domain | `d37li4q4jjj3gg.cloudfront.net` |
| `SNS_TOPIC_ARN` | SNS topic ARN | `arn:aws:sns:eu-north-1:123456789012:cloud-video-notifications` |
| `CLOUDWATCH_LOG_GROUP` | CloudWatch log group | `/cloud-video/backend` |

Optional:
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` — only if not using instance role.

## 4. S3 ObjectCreated Trigger

In the S3 Console:
1. Select bucket `cloud-video-platform`
2. **Properties** → **Event notifications** → **Create event notification**
3. Name: `TriggerVideoProcessor`
4. Event types: check **All object create events**
5. Prefix: `videos/`
6. Destination: **Lambda function** → choose `cloud-video-processor`
7. Save

## 5. How Lambda Updates MongoDB

`lambda/processVideo.js` does the following after thumbnail generation:
1. Connects to MongoDB Atlas via `process.env.MONGODB_URI`
2. Finds the video document by `s3VideoKey`
3. Updates:
   - `status = 'ready'`
   - `videoUrl = https://<cloudfront-domain>/<s3VideoKey>`
   - `thumbnailUrl = https://<cloudfront-domain>/<thumbnailKey>`
   - `s3ThumbnailKey`
   - `duration`

No additional backend endpoint is required — Lambda writes directly to MongoDB Atlas.

## 6. SNS and CloudWatch

### 6.1 SNS Topic
- Create topic: `cloud-video-notifications`
- Subscribe your email to receive notifications

### 6.2 CloudWatch Logs
Log group: `/cloud-video/backend`
Log streams used:
- `upload-stream` for upload success/failure events
- `auth-stream` for authentication events
- `error-stream` for application errors

Set the retention as needed (default: **Never expire**).

## 7. Post-Deployment Validation

1. Create an admin/creator user via the backend API.
2. Log in to `https://cloud-video.netlify.app`
3. Upload a video via **Upload Video**.
4. Verify:
   - S3 object exists under `videos/<userId>/`
   - CloudFront URL is generated
   - Thumbnail appears under `thumbnails/<userId>/`
   - MongoDB document `status` changes from `pending` → `ready`
   - Email notification arrives via SNS
   - CloudWatch log stream `upload-stream` shows the success event

If startup logs show:
`Failed to configure S3 CORS for bucket ...`
fix the IAM permissions in section 2.3.
