/**
 * Amazon CloudWatch Logger
 *
 * Sends structured application logs to CloudWatch Logs.
 * Each category gets its own log stream.
 * Failures are silently caught - never break the application.
 *
 * Log Group: /cloud-video/backend
 *   - upload-stream
 *   - auth-stream
 *   - error-stream
 */

const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  PutLogEventsCommand,
} = require('@aws-sdk/client-cloudwatch-logs');

const client = new CloudWatchLogsClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP || '/cloud-video/backend';
const sequenceTokens = {};

async function ensureLogGroup() {
  try {
    await client.send(new CreateLogGroupCommand({ logGroupName: LOG_GROUP }));
  } catch (err) {
    if (err.name !== 'ResourceAlreadyExistsException') {
      console.error('CloudWatch create log group error:', err.message);
    }
  }
}

async function ensureLogStream(streamName) {
  try {
    await client.send(new CreateLogStreamCommand({
      logGroupName: LOG_GROUP,
      logStreamName: streamName,
    }));
  } catch (err) {
    if (err.name !== 'ResourceAlreadyExistsException') {
      console.error('CloudWatch create log stream error:', err.message);
    }
  }
}

// Initialize on load
(async () => {
  await ensureLogGroup();
  await Promise.all([
    ensureLogStream('upload-stream'),
    ensureLogStream('auth-stream'),
    ensureLogStream('error-stream'),
  ]);
})();

async function _sendLog(streamName, message) {
  try {
    const logEvents = [{
      timestamp: Date.now(),
      message: typeof message === 'string' ? message : JSON.stringify(message),
    }];
    const params = {
      logGroupName: LOG_GROUP,
      logStreamName: streamName,
      logEvents,
    };
    if (sequenceTokens[streamName]) {
      params.sequenceToken = sequenceTokens[streamName];
    }
    const result = await client.send(new PutLogEventsCommand(params));
    if (result.nextSequenceToken) {
      sequenceTokens[streamName] = result.nextSequenceToken;
    }
  } catch (err) {
    console.error('CloudWatch send log error:', err.message);
  }
}

// Public API
async function logUploadSuccess(video) {
  await _sendLog('upload-stream', {
    eventType: 'upload.success',
    videoId: video._id?.toString(),
    title: video.title,
    userId: video.user?.toString(),
    uploadedBy: video.uploadedBy,
    category: video.category,
    timestamp: new Date().toISOString(),
  });
}

async function logUploadFailure(videoId, title, reason) {
  const entry = {
    eventType: 'upload.failure',
    videoId: videoId || 'unknown',
    title: title || 'unknown',
    reason: reason || 'Unknown error',
    timestamp: new Date().toISOString(),
  };
  await _sendLog('upload-stream', entry);
  await _sendLog('error-stream', entry);
}

async function logAuthSuccess(userId, email) {
  await _sendLog('auth-stream', {
    eventType: 'auth.success',
    userId,
    email,
    timestamp: new Date().toISOString(),
  });
}

async function logAuthFailure(email, reason) {
  const entry = {
    eventType: 'auth.failure',
    email,
    reason,
    timestamp: new Date().toISOString(),
  };
  await _sendLog('auth-stream', entry);
  await _sendLog('error-stream', entry);
}

module.exports = {
  logUploadSuccess,
  logUploadFailure,
  logAuthSuccess,
  logAuthFailure,
};