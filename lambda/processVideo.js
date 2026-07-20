/**
 * AWS Lambda - Video Processing Pipeline
 *
 * Trigger: S3 ObjectCreated event
 * Purpose: Generate thumbnail, extract duration, update MongoDB
 *
 * Architecture:
 * 1. S3 ObjectCreated event triggers this Lambda
 * 2. Lambda downloads video to /tmp
 * 3. Uses ffmpeg to extract a thumbnail frame at 1-second mark
 * 4. Uses ffprobe to extract video duration
 * 5. Uploads thumbnail to S3
 * 6. Updates MongoDB: thumbnailUrl, duration, status="ready"
 */

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

// Configure ffmpeg paths for Lambda
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
process.env.FFMPEG_PATH = ffmpegPath;
process.env.FFPROBE_PATH = ffprobePath;

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

// MongoDB connection (cached across invocations)
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  });
  cachedDb = mongoose.connection;
  return cachedDb;
}

// Define Video schema inline (matches backend/models/Video.js)
const VideoSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    thumbnailUrl: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    s3VideoKey: { type: String, required: true },
    s3ThumbnailKey: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    category: { type: String, default: 'Uncategorized' },
    tags: [String],
    visibility: { type: String, default: 'public' },
    status: { type: String, default: 'processing' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedBy: { type: String },
  },
  { timestamps: true }
);

const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

/**
 * Download an S3 object to a local file
 */
async function downloadFromS3(bucket, key, downloadPath) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  const writeStream = fs.createWriteStream(downloadPath);
  
  return new Promise((resolve, reject) => {
    response.Body.pipe(writeStream);
    response.Body.on('end', () => {
      writeStream.end();
      resolve();
    });
    response.Body.on('error', reject);
    writeStream.on('error', reject);
  });
}

/**
 * Extract video duration using ffprobe
 */
function getVideoDuration(videoPath) {
  try {
    const stdout = execSync(
      `"${ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
      { timeout: 30000 }
    );
    return parseFloat(stdout.toString().trim()) || 0;
  } catch (error) {
    console.error('ffprobe error:', error.message);
    return 0;
  }
}

/**
 * Generate thumbnail from video using ffmpeg
 * Extracts a frame at 1 second into the video
 */
function generateThumbnail(videoPath, thumbnailPath) {
  try {
    execSync(
      `"${ffmpegPath}" -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:360" "${thumbnailPath}" -y`,
      { timeout: 30000 }
    );
    return fs.existsSync(thumbnailPath);
  } catch (error) {
    console.error('ffmpeg thumbnail error:', error.message);
    return false;
  }
}

/**
 * Upload a file to S3
 */
async function uploadToS3(filePath, bucket, key, contentType) {
  const fileStream = fs.createReadStream(filePath);
  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: fileStream,
      ContentType: contentType,
    },
  });
  return upload.done();
}

/**
 * Generate CloudFront URL
 */
function getCloudFrontUrl(key) {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  if (!domain) return '';
  return `https://${domain}/${key}`;
}

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
  // Prevent Lambda from waiting for the event loop to empty
  context.callbackWaitsForEmptyEventLoop = false;

  console.log('Event:', JSON.stringify(event, null, 2));

  // Extract S3 event info
  const record = event.Records?.[0];
  if (!record) {
    console.error('No S3 record found');
    return { statusCode: 400, body: 'No S3 record' };
  }

  const bucket = record.s3.bucket.name;
  const videoKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  // Only process video files in the videos/ prefix
  if (!videoKey.startsWith('videos/')) {
    console.log(`Skipping non-video key: ${videoKey}`);
    return { statusCode: 200, body: 'Skipped' };
  }

  const tmpDir = os.tmpdir();
  const videoFileName = path.basename(videoKey);
  const videoPath = path.join(tmpDir, videoFileName);
  const thumbnailFileName = `thumb_${videoFileName.replace(/\.[^.]+$/, '.jpg')}`;
  const thumbnailPath = path.join(tmpDir, thumbnailFileName);
  const thumbnailKey = `thumbnails/${videoKey.replace('videos/', '')}`.replace(/\.[^.]+$/, '.jpg');

  try {
    // Step 1: Download video from S3
    console.log(`Downloading s3://${bucket}/${videoKey} to ${videoPath}`);
    await downloadFromS3(bucket, videoKey, videoPath);
    console.log('Download complete');

    // Step 2: Extract duration
    console.log('Extracting duration...');
    const duration = getVideoDuration(videoPath);
    console.log(`Duration: ${duration}s`);

    // Step 3: Generate thumbnail
    console.log('Generating thumbnail...');
    const thumbnailGenerated = generateThumbnail(videoPath, thumbnailPath);
    let thumbnailUrl = '';

    if (thumbnailGenerated) {
      console.log(`Uploading thumbnail to s3://${bucket}/${thumbnailKey}`);
      await uploadToS3(thumbnailPath, bucket, thumbnailKey, 'image/jpeg');
      thumbnailUrl = getCloudFrontUrl(thumbnailKey);
      console.log(`Thumbnail URL: ${thumbnailUrl}`);
    } else {
      console.log('Thumbnail generation failed, continuing without thumbnail');
    }

    // Step 4: Update MongoDB
    console.log('Connecting to MongoDB...');
    await connectToDatabase();

    const videoUrl = getCloudFrontUrl(videoKey);

    const updateData = {
      duration,
      videoUrl,
      status: 'ready',
    };

    if (thumbnailUrl) {
      updateData.thumbnailUrl = thumbnailUrl;
      updateData.s3ThumbnailKey = thumbnailKey;
    }

    const result = await Video.findOneAndUpdate(
      { s3VideoKey: videoKey },
      { $set: updateData },
      { new: true }
    );

    if (result) {
      console.log(`MongoDB updated: ${result._id} - status: ready, duration: ${duration}s`);
    } else {
      console.log(`No MongoDB document found for s3VideoKey: ${videoKey}`);
    }

    // Cleanup temp files
    try {
      fs.unlinkSync(videoPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    } catch (e) {
      console.error('Cleanup error:', e.message);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        videoKey,
        duration,
        thumbnailGenerated,
        thumbnailUrl,
        mongoUpdated: !!result,
      }),
    };
  } catch (error) {
    console.error('Processing error:', error);

    // Mark video as failed in MongoDB
    try {
      await connectToDatabase();
      await Video.findOneAndUpdate(
        { s3VideoKey: videoKey },
        { $set: { status: 'failed' } }
      );
    } catch (dbError) {
      console.error('Failed to update status to failed:', dbError.message);
    }

    // Cleanup
    try {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    } catch (e) {
      // ignore cleanup errors
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};