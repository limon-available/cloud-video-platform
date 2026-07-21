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