/**
 * AWS S3 CORS Configuration
 *
 * Applies the CORS rule required for direct browser uploads from
 * https://cloud-video.netlify.app and localhost development.
 */

const { S3Client, PutBucketCorsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function ensureS3Cors(bucketName) {
  const command = new PutBucketCorsCommand({
    Bucket: bucketName,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: [
            'https://cloud-video.netlify.app',
            'http://localhost:5173',
          ],
          AllowedMethods: ['PUT', 'GET', 'HEAD'],
          AllowedHeaders: ['*'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  });

  await s3Client.send(command);
}

module.exports = { ensureS3Cors };