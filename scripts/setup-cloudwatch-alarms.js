/**
 * Setup CloudWatch Alarms
 *
 * Creates metric filters and alarms for:
 * - Upload failures (monitors upload-stream)
 * - Lambda errors (monitors /aws/lambda/processVideo)
 * - High error rate (monitors error-stream)
 *
 * Each alarm publishes to the existing SNS topic.
 *
 * Usage: node scripts/setup-cloudwatch-alarms.js --sns-topic-arn <ARN>
 *
 * Safe to re-run (checks for existing resources).
 */

const {
  CloudWatchLogsClient,
  PutMetricFilterCommand,
  DescribeMetricFiltersCommand,
} = require('@aws-sdk/client-cloudwatch-logs');
const {
  CloudWatchClient,
  PutMetricAlarmCommand,
  DescribeAlarmsCommand,
} = require('@aws-sdk/client-cloudwatch');
const { SNSClient } = require('@aws-sdk/client-sns');

// Parse CLI arguments
const args = process.argv.slice(2);
const snsTopicArn = args.includes('--sns-topic-arn')
  ? args[args.indexOf('--sns-topic-arn') + 1]
  : null;

if (!snsTopicArn) {
  console.error('Usage: node scripts/setup-cloudwatch-alarms.js --sns-topic-arn <ARN>');
  process.exit(1);
}

const REGION = process.env.AWS_REGION || 'us-east-1';
const LOG_GROUP = process.env.CLOUDWATCH_LOG_GROUP || '/cloud-video/backend';
const LAMBDA_LOG_GROUP = '/aws/lambda/processVideo';

const logsClient = new CloudWatchLogsClient({ region: REGION });
const cwClient = new CloudWatchClient({ region: REGION });
const snsClient = new SNSClient({ region: REGION });

// ──────────────────────────────────────────────
// Metric Filters
// ──────────────────────────────────────────────

const METRIC_FILTERS = [
  {
    logGroupName: LOG_GROUP,
    filterName: 'UploadFailureFilter',
    filterPattern: '{ $.eventType = "upload.failure" }',
    metricTransformations: [
      {
        metricName: 'UploadFailureCount',
        metricNamespace: 'CloudVideo',
        metricValue: '1',
      },
    ],
  },
  {
    logGroupName: LAMBDA_LOG_GROUP,
    filterName: 'LambdaErrorFilter',
    filterPattern: 'ERROR',
    metricTransformations: [
      {
        metricName: 'LambdaErrorCount',
        metricNamespace: 'CloudVideo',
        metricValue: '1',
      },
    ],
  },
  {
    logGroupName: LOG_GROUP,
    filterName: 'ErrorStreamFilter',
    filterPattern: '',
    metricTransformations: [
      {
        metricName: 'ErrorStreamCount',
        metricNamespace: 'CloudVideo',
        metricValue: '1',
      },
    ],
  },
];

// ──────────────────────────────────────────────
// Alarms
// ──────────────────────────────────────────────

const ALARMS = [
  {
    AlarmName: 'UploadFailureAlarm',
    AlarmDescription: 'Alert when a video upload fails',
    MetricName: 'UploadFailureCount',
    Namespace: 'CloudVideo',
    Statistic: 'Sum',
    Period: 300,
    EvaluationPeriods: 1,
    Threshold: 1,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    TreatMissingData: 'notBreaching',
  },
  {
    AlarmName: 'LambdaFailureAlarm',
    AlarmDescription: 'Alert when the video processing Lambda fails',
    MetricName: 'LambdaErrorCount',
    Namespace: 'CloudVideo',
    Statistic: 'Sum',
    Period: 300,
    EvaluationPeriods: 1,
    Threshold: 1,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    TreatMissingData: 'notBreaching',
  },
  {
    AlarmName: 'HighErrorRateAlarm',
    AlarmDescription: 'Alert when application error rate exceeds threshold',
    MetricName: 'ErrorStreamCount',
    Namespace: 'CloudVideo',
    Statistic: 'Sum',
    Period: 300,
    EvaluationPeriods: 1,
    Threshold: 3,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    TreatMissingData: 'notBreaching',
  },
];

// ──────────────────────────────────────────────
// Helper: check if a metric filter exists
// ──────────────────────────────────────────────

async function metricFilterExists(logGroupName, filterName) {
  try {
    const result = await logsClient.send(
      new DescribeMetricFiltersCommand({
        logGroupName,
        filterNamePrefix: filterName,
      })
    );
    return result.metricFilters && result.metricFilters.length > 0;
  } catch (err) {
    // If the log group doesn't exist yet, the filter doesn't exist
    if (err.name === 'ResourceNotFoundException') return false;
    throw err;
  }
}

// ──────────────────────────────────────────────
// Helper: check if an alarm exists
// ──────────────────────────────────────────────

async function alarmExists(alarmName) {
  try {
    const result = await cwClient.send(
      new DescribeAlarmsCommand({
        AlarmNames: [alarmName],
      })
    );
    return result.metricAlarms && result.metricAlarms.length > 0;
  } catch (err) {
    console.error(`Error checking alarm ${alarmName}:`, err.message);
    return false;
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function setup() {
  console.log('Setting up CloudWatch Alarms...\n');
  console.log(`SNS Topic ARN: ${snsTopicArn}\n`);

  // 1. Create metric filters
  for (const filter of METRIC_FILTERS) {
    const exists = await metricFilterExists(filter.logGroupName, filter.filterName);
    if (exists) {
      console.log(`  [SKIP] Metric filter "${filter.filterName}" already exists on ${filter.logGroupName}`);
      continue;
    }

    try {
      await logsClient.send(new PutMetricFilterCommand(filter));
      console.log(`  [OK]   Metric filter "${filter.filterName}" created on ${filter.logGroupName}`);
    } catch (err) {
      if (err.name === 'ResourceNotFoundException') {
        console.log(`  [WARN] Log group "${filter.logGroupName}" does not exist yet. Skipping filter "${filter.filterName}". Create it by triggering the relevant service first.`);
      } else {
        console.error(`  [FAIL] Could not create filter "${filter.filterName}":`, err.message);
      }
    }
  }

  // 2. Create alarms
  for (const alarm of ALARMS) {
    const exists = await alarmExists(alarm.AlarmName);
    if (exists) {
      console.log(`  [SKIP] Alarm "${alarm.AlarmName}" already exists`);
      continue;
    }

    try {
      const params = {
        AlarmName: alarm.AlarmName,
        AlarmDescription: alarm.AlarmDescription,
        ActionsEnabled: true,
        OKActions: [snsTopicArn],
        AlarmActions: [snsTopicArn],
        InsufficientDataActions: [],
        MetricName: alarm.MetricName,
        Namespace: alarm.Namespace,
        Statistic: alarm.Statistic,
        Period: alarm.Period,
        EvaluationPeriods: alarm.EvaluationPeriods,
        Threshold: alarm.Threshold,
        ComparisonOperator: alarm.ComparisonOperator,
        TreatMissingData: alarm.TreatMissingData,
      };

      await cwClient.send(new PutMetricAlarmCommand(params));
      console.log(`  [OK]   Alarm "${alarm.AlarmName}" created`);
    } catch (err) {
      console.error(`  [FAIL] Could not create alarm "${alarm.AlarmName}":`, err.message);
    }
  }

  console.log('\nDone.');
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});