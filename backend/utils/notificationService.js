/**
 * AWS SNS Notification Service
 *
 * Sends email notifications via SNS for key platform events.
 * Failures are logged but never thrown, ensuring notifications
 * never break the application.
 *
 * Architecture:
 *   Event occurs → publish(event) → SNS Topic → Email subscriptions
 *                       │
 *                       └── On error → console.error only, continue
 */

const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const TOPIC_ARN = process.env.AWS_SNS_TOPIC_ARN || '';

/**
 * Publish a message to the SNS topic
 * @param {string} subject - Email subject line
 * @param {string} message - Plain text body
 * @param {Object} [extra] - Optional extra params
 */
async function publish(subject, message, extra = {}) {
  if (!TOPIC_ARN) {
    console.warn('SNS_TOPIC_ARN not configured, skipping notification');
    return;
  }

  const params = {
    TopicArn: TOPIC_ARN,
    Subject: subject.substring(0, 100),
    Message: message,
    ...extra,
  };

  try {
    const command = new PublishCommand(params);
    const result = await snsClient.send(command);
    console.log(`SNS notification sent: ${subject} (MessageId: ${result.MessageId})`);
    return result;
  } catch (error) {
    // Log the error but NEVER throw — notifications are non-critical
    console.error('SNS publish error:', error.message);
  }
}

/**
 * Send notification when a video upload succeeds
 * @param {Object} video - The video document from MongoDB
 */
async function publishVideoUploaded(video) {
  const subject = `[CloudVideo] Video Uploaded: "${video.title}"`;
  const message = [
    `A new video has been uploaded successfully.`,
    ``,
    `Title:       ${video.title}`,
    `Description: ${video.description?.substring(0, 200)}`,
    `Category:    ${video.category || 'Uncategorized'}`,
    `Duration:    ${video.duration || 'processing'}s`,
    `Status:      ${video.status}`,
    `Uploaded by: ${video.uploadedBy || 'unknown'}`,
    `Video ID:    ${video._id}`,
    `Timestamp:   ${new Date().toISOString()}`,
  ].join('\n');

  return publish(subject, message);
}

/**
 * Send notification when a video upload fails
 * @param {Object} video - The video document from MongoDB
 * @param {string} reason - Error reason
 */
async function publishVideoFailed(video, reason) {
  const subject = `[CloudVideo] Upload Failed: "${video.title}"`;
  const message = [
    `A video upload has failed.`,
    ``,
    `Title:       ${video.title}`,
    `Reason:      ${reason}`,
    `Video ID:    ${video._id}`,
    `Timestamp:   ${new Date().toISOString()}`,
  ].join('\n');

  return publish(subject, message);
}

/**
 * Send notification when a viewer becomes a creator
 * @param {Object} user - The user document from MongoDB
 */
async function publishCreatorUpgrade(user) {
  const subject = `[CloudVideo] New Creator: ${user.username}`;
  const message = [
    `A viewer has upgraded to a Creator account.`,
    ``,
    `Username:  ${user.username}`,
    `Email:     ${user.email}`,
    `User ID:   ${user._id}`,
    `Timestamp: ${new Date().toISOString()}`,
  ].join('\n');

  return publish(subject, message);
}

/**
 * Send notification when an admin deletes a video
 * @param {Object} video - The deleted video document
 * @param {Object} admin - The admin user who deleted it
 */
async function publishVideoDeleted(video, admin) {
  const subject = `[CloudVideo] Video Deleted: "${video.title}"`;
  const message = [
    `A video has been deleted by an administrator.`,
    ``,
    `Title:       ${video.title}`,
    `Deleted by:  ${admin.username} (${admin.email})`,
    `Video ID:    ${video._id}`,
    `Timestamp:   ${new Date().toISOString()}`,
  ].join('\n');

  return publish(subject, message);
}

module.exports = {
  publishVideoUploaded,
  publishVideoFailed,
  publishCreatorUpgrade,
  publishVideoDeleted,
};