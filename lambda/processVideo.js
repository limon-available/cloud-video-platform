/**
 * AWS Lambda - Video Processing Pipeline (Fully Event-Driven)
 *
 * Trigger: S3 ObjectCreated event
 * Purpose:
 *   1. Find MongoDB doc by s3VideoKey
 *   2. Set status to "processing"
 *   3. Download video from S3
 *   4. Extract duration via ffprobe
 *   5. Generate thumbnail via ffmpeg
 *   6. Upload thumbnail to S3
 *   7. Update MongoDB: status="ready", duration, thumbnailUrl, videoUrl
 *   8. Send SNS notification
 *   9. Write CloudWatch log
 */

const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
const { CloudWatchLogsClient, PutLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');
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
const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const cwLogsClient = new CloudWatchLogsClient({ region: process.env.AWS_REGION || 'us-east-1' });

const SNS_TOPIC = process.env.SNS_TOPIC_ARN || '';
const CW_LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP || '/cloud-video/backend';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || '';

let cwSeqToken = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) return cachedDb;
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 30000,
  });
  cachedDb = mongoose.connection;
  return cachedDb;
}

const VideoSchema = new mongoose.Schema({
  title: String, description: String, thumbnailUrl: { type: String, default: '' },
  videoUrl: { type: String, default: '' }, s3VideoKey: { type: String, required: true },
  s3ThumbnailKey: { type: String, default: '' }, duration: { type: Number, default: 0 },
  views: { type: Number, default: 0 }, likes: { type: Number, default: 0 },
  category: { type: String, default: 'Uncategorized' }, tags: [String],
  visibility: { type: String, default: 'public' },
  status: { type: String, default: 'pending' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  uploadedBy: { type: String },
}, { timestamps: true });
const Video = mongoose.models.Video || mongoose.model('Video', VideoSchema);

async function downloadFromS3(bucket, key, downloadPath) {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  const writeStream = fs.createWriteStream(downloadPath);
  return new Promise((resolve, reject) => {
    response.Body.pipe(writeStream);
    response.Body.on('end', () => { writeStream.end(); resolve(); });
    response.Body.on('error', reject);
    writeStream.on('error', reject);
  });
}

function getVideoDuration(videoPath) {
  try {
    const stdout = execSync(`"${ffprobePath}" -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`, { timeout: 30000 });
    return parseFloat(stdout.toString().trim()) || 0;
  } catch (e) { return 0; }
}

function generateThumbnail(videoPath, thumbnailPath) {
  try {
    execSync(`"${ffmpegPath}" -i "${videoPath}" -ss 00:00:01 -vframes 1 -vf "scale=640:360" "${thumbnailPath}" -y`, { timeout: 30000 });
    return fs.existsSync(thumbnailPath);
  } catch (e) { return false; }
}

async function uploadToS3(filePath, bucket, key, contentType) {
  const fileStream = fs.createReadStream(filePath);
  const upload = new Upload({ client: s3Client, params: { Bucket: bucket, Key: key, Body: fileStream, ContentType: contentType } });
  return upload.done();
}

function getCloudFrontUrl(key) {
  return CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}/${key}` : '';
}

async function sendSns(subject, message) {
  if (!SNS_TOPIC) return;
  try {
    await snsClient.send(new PublishCommand({ TopicArn: SNS_TOPIC, Subject: subject.substring(0, 100), Message: message }));
  } catch (e) { console.error('SNS error:', e.message); }
}

async function sendCwLog(streamName, message) {
  try {
    const params = { logGroupName: CW_LOG_GROUP, logStreamName: streamName, logEvents: [{ timestamp: Date.now(), message: JSON.stringify(message) }] };
    if (cwSeqToken) params.sequenceToken = cwSeqToken;
    const result = await cwLogsClient.send(new PutLogEventsCommand(params));
    if (result.nextSequenceToken) cwSeqToken = result.nextSequenceToken;
  } catch (e) { console.error('CW log error:', e.message); }
}

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  console.log('Event:', JSON.stringify(event));

  const record = event.Records?.[0];
  if (!record) return { statusCode: 400, body: 'No S3 record' };

  const bucket = record.s3.bucket.name;
  const videoKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

  if (!videoKey.startsWith('videos/')) return { statusCode: 200, body: 'Skipped' };

  const tmpDir = os.tmpdir();
  const videoFileName = path.basename(videoKey);
  const videoPath = path.join(tmpDir, videoFileName);
  const thumbFileName = `thumb_${videoFileName.replace(/\.[^.]+$/, '.jpg')}`;
  const thumbPath = path.join(tmpDir, thumbFileName);
  const thumbnailKey = `thumbnails/${videoKey.replace('videos/', '')}`.replace(/\.[^.]+$/, '.jpg');

  try {
    // Find pending MongoDB doc by s3VideoKey
    await connectToDatabase();
    let video = await Video.findOne({ s3VideoKey: videoKey });
    if (!video) {
      console.log(`No pending doc for ${videoKey}, creating one`);
      video = await Video.create({
        title: videoKey.split('/').pop(),
        description: 'Auto-created from S3 event',
        s3VideoKey: videoKey,
        status: 'pending',
      });
    }

    // Set to processing
    video.status = 'processing';
    await video.save();

    // Download video
    await downloadFromS3(bucket, videoKey, videoPath);
    console.log('Downloaded');

    // Extract duration
    const duration = getVideoDuration(videoPath);
    console.log('Duration:', duration);

    // Generate thumbnail
    const thumbGenerated = generateThumbnail(videoPath, thumbPath);
    let thumbnailUrl = '';
    if (thumbGenerated) {
      await uploadToS3(thumbPath, bucket, thumbnailKey, 'image/jpeg');
      thumbnailUrl = getCloudFrontUrl(thumbnailKey);
    }

    // Build CloudFront video URL
    const videoUrl = getCloudFrontUrl(videoKey);

    // Update MongoDB: ready
    video.duration = duration;
    video.videoUrl = videoUrl;
    if (thumbnailUrl) {
      video.thumbnailUrl = thumbnailUrl;
      video.s3ThumbnailKey = thumbnailKey;
    }
    video.status = 'ready';
    await video.save();

    // SNS notification
    await sendSns(
      `[CloudVideo] Video Published: ${video.title}`,
      `Title: ${video.title}\nDuration: ${duration}s\nStatus: ${video.status}\nVideo ID: ${video._id}\nTimestamp: ${new Date().toISOString()}`
    );

    // CloudWatch log
    await sendCwLog('upload-stream', {
      eventType: 'upload.success',
      videoId: video._id.toString(),
      title: video.title,
      duration,
      status: 'ready',
      timestamp: new Date().toISOString(),
    });

    // Cleanup
    try { fs.unlinkSync(videoPath); if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (e) {}

    return { statusCode: 200, body: JSON.stringify({ videoKey, duration }) };
  } catch (error) {
    console.error('Processing error:', error);
    // Mark failed
    try {
      await connectToDatabase();
      await Video.findOneAndUpdate({ s3VideoKey: videoKey }, { $set: { status: 'failed' } });
    } catch (e) {}

    // SNS failure notification
    await sendSns(`[CloudVideo] Upload Failed: ${videoKey.split('/').pop()}`, `Video: ${videoKey}\nReason: ${error.message}\nTimestamp: ${new Date().toISOString()}`);

    // CloudWatch failure log
    await sendCwLog('upload-stream', { eventType: 'upload.failure', videoId: videoKey, reason: error.message, timestamp: new Date().toISOString() });

    try { if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath); if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath); } catch (e) {}
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};