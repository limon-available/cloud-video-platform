const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { CloudFrontClient } = require('@aws-sdk/client-cloudfront');
const { Upload } = require('@aws-sdk/lib-storage');

/**
 * AWS Configuration (SDK v3)
 * 
 * Architecture: Amazon S3 + CloudFront
 * 
 * Why S3?
 * - Scalable object storage for video files and thumbnails
 * - 99.999999999% durability
 * - Lifecycle policies for cost optimization
 * - Server-side encryption for security
 * 
 * Why CloudFront?
 * - Global CDN for low-latency video delivery
 * - Edge caching reduces S3 load
 * - DDoS protection via AWS Shield
 * - HTTPS termination at edge
 * - Geo-restriction capabilities
 */

// S3 Client (v3)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// CloudFront Client (v3)
const cloudfrontClient = new CloudFrontClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Generate a CloudFront URL for video delivery
 * @param {string} s3Key - The S3 object key
 * @returns {string} CloudFront URL
 */
const getCloudFrontSignedUrl = (s3Key) => {
  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN;
  if (!cloudfrontDomain) return '';
  return `https://${cloudfrontDomain}/${s3Key}`;
};

/**
 * Upload file to S3 using SDK v3
 * @param {Buffer} fileBuffer - File data
 * @param {string} key - S3 object key
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} S3 upload result
 */
const uploadToS3 = async (fileBuffer, key, contentType) => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  const parallelUploads3 = new Upload({
    client: s3Client,
    params: {
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
    },
    queueSize: 4,
    partSize: 5 * 1024 * 1024, // 5MB parts for large files
    leavePartsOnError: false,
  });

  try {
    const result = await parallelUploads3.done();
    console.log(`File uploaded to S3: ${result.Location}`);
    return result;
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

/**
 * Delete file from S3 using SDK v3
 * @param {string} key - S3 object key
 * @returns {Promise<void>}
 */
const deleteFromS3 = async (key) => {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await s3Client.send(command);
    console.log(`File deleted from S3: ${key}`);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw new Error('Failed to delete file from S3');
  }
};

/**
 * Generate S3 object key for video
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @returns {string} S3 key
 */
const getVideoKey = (userId, filename) => {
  const timestamp = Date.now();
  return `videos/${userId}/${timestamp}-${filename}`;
};

/**
 * Generate S3 object key for thumbnail
 * @param {string} userId - User ID
 * @param {string} filename - Original filename
 * @returns {string} S3 key
 */
const getThumbnailKey = (userId, filename) => {
  const timestamp = Date.now();
  return `thumbnails/${userId}/${timestamp}-${filename}`;
};

module.exports = {
  s3Client,
  cloudfrontClient,
  getCloudFrontSignedUrl,
  uploadToS3,
  deleteFromS3,
  getVideoKey,
  getThumbnailKey,
};