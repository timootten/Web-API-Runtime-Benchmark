import http from 'k6/http';
import { check } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// Types
interface SetupData {
  baseUrl: string;
  profile: string;
  startTime: number;
}

interface ProfileConfig {
  scenarios: Record<string, unknown>;
  thresholds: Record<string, string[]>;
}

// Custom metrics
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');
const failedRequestsRate = new Rate('failed_requests_rate');
const healthLatency = new Trend('health_latency', true);
const getUserLatency = new Trend('get_user_latency', true);
const createUserLatency = new Trend('create_user_latency', true);

// Configuration from environment
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const PROFILE = __ENV.PROFILE || 'standard';

// Profile configurations using ramping-arrival-rate
// This pushes requests at a specified rate, regardless of response time
// This reveals the TRUE maximum throughput each framework can handle
const profiles: Record<string, ProfileConfig> = {
  quick: {
    scenarios: {
      throughput_test: {
        executor: 'ramping-arrival-rate',
        startRate: 500,           // Start at 500 requests/sec
        timeUnit: '1s',
        preAllocatedVUs: 1000,    // Pre-allocate VUs to handle the load
        maxVUs: 3000,             // Allow scaling up if needed
        stages: [
          { duration: '5s', target: 2000 },   // Ramp to 2000 req/s
          { duration: '10s', target: 5000 },  // Ramp to 5000 req/s
          { duration: '10s', target: 8000 },  // Ramp to 8000 req/s
          { duration: '10s', target: 12000 }, // Ramp to 12000 req/s - stress test
          { duration: '10s', target: 15000 }, // Ramp to 15000 req/s - breaking point
          { duration: '5s', target: 500 },    // Ramp down
        ],
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      failed_requests_rate: ['rate<0.8'],  // Allow up to 80% failure to find limits
    },
  },
  standard: {
    scenarios: {
      throughput_test: {
        executor: 'ramping-arrival-rate',
        startRate: 500,
        timeUnit: '1s',
        preAllocatedVUs: 2000,
        maxVUs: 5000,
        stages: [
          { duration: '10s', target: 3000 },
          { duration: '15s', target: 6000 },
          { duration: '15s', target: 10000 },
          { duration: '15s', target: 15000 },
          { duration: '15s', target: 20000 },
          { duration: '15s', target: 25000 },  // Push harder
          { duration: '10s', target: 30000 },  // Breaking point test
          { duration: '5s', target: 500 },
        ],
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      failed_requests_rate: ['rate<0.8'],
    },
  },
  full: {
    scenarios: {
      throughput_test: {
        executor: 'ramping-arrival-rate',
        startRate: 1000,
        timeUnit: '1s',
        preAllocatedVUs: 3000,
        maxVUs: 10000,
        stages: [
          { duration: '15s', target: 5000 },
          { duration: '20s', target: 10000 },
          { duration: '20s', target: 15000 },
          { duration: '20s', target: 20000 },
          { duration: '20s', target: 25000 },
          { duration: '20s', target: 30000 },
          { duration: '20s', target: 40000 },
          { duration: '20s', target: 50000 },  // Extreme stress
          { duration: '10s', target: 1000 },
        ],
      },
    },
    thresholds: {
      http_req_duration: ['p(95)<5000'],
      failed_requests_rate: ['rate<0.6'],
    },
  },
};

const selectedProfile = profiles[PROFILE] || profiles.standard;

export const options = {
  scenarios: selectedProfile.scenarios,
  thresholds: selectedProfile.thresholds,
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)', 'count'],
};

// Setup function - runs once before the test
export function setup(): SetupData {
  console.log(`Starting benchmark with profile: ${PROFILE}`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log('Using ramping-arrival-rate to find TRUE throughput limits');

  // Wait for service to be ready
  let retries = 10;
  while (retries > 0) {
    try {
      const res = http.get(`${BASE_URL}/health`);
      if (res.status === 200) {
        console.log('Service is ready!');
        return {
          baseUrl: BASE_URL,
          profile: PROFILE,
          startTime: Date.now()
        };
      }
    } catch {
      // Ignore errors during warmup
    }
    retries--;
  }
  throw new Error('Service not available');
}

// Main test function - runs for each iteration (request)
export default function (data: SetupData): void {
  const baseUrl = data.baseUrl;

  // Randomly select one of three operations for more realistic load
  const operation = Math.random();

  let success = false;
  let latency = 0;

  if (operation < 0.4) {
    // 40% - Health check (simple JSON response)
    const res = http.get(`${baseUrl}/health`);
    latency = res.timings.duration;
    healthLatency.add(latency);

    success = check(res, {
      'health: status is 200': (r) => r.status === 200,
    });
  } else if (operation < 0.7) {
    // 30% - Get user by ID
    const userId = Math.floor(Math.random() * 100) + 1;
    const res = http.get(`${baseUrl}/users/${userId}`);
    latency = res.timings.duration;
    getUserLatency.add(latency);

    success = check(res, {
      'getUser: status is 200': (r) => r.status === 200,
    });
  } else {
    // 30% - Create user
    const timestamp = Date.now();
    const vuId = __VU || 0;
    const res = http.post(
      `${baseUrl}/users`,
      JSON.stringify({
        name: `User_${vuId}_${timestamp}`,
        email: `user_${vuId}_${timestamp}@test.com`,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
    latency = res.timings.duration;
    createUserLatency.add(latency);

    success = check(res, {
      'createUser: status is 201': (r) => r.status === 201,
    });
  }

  // Track success/failure
  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }
  failedRequestsRate.add(!success);
}

// Teardown function - runs once after the test
export function teardown(data: SetupData): void {
  console.log(`Benchmark completed for profile: ${data.profile}`);
}

// Custom summary handler - outputs detailed results
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function handleSummary(data: any): Record<string, string> {
  const serviceName = __ENV.SERVICE_NAME || 'unknown';

  // Calculate successful requests per second (the key metric!)
  const totalDuration = data.state?.testRunDurationMs || 50000;
  const durationSeconds = totalDuration / 1000;
  const successCount = data.metrics.successful_requests?.values?.count || 0;
  const failedCount = data.metrics.failed_requests?.values?.count || 0;
  const totalRequests = successCount + failedCount;
  const droppedIterations = data.metrics.dropped_iterations?.values?.count || 0;

  // Add computed metrics - THIS IS WHAT SHOWS THE REAL DIFFERENCE
  const enhancedData = {
    ...data,
    computed: {
      total_requests: totalRequests,
      successful_requests: successCount,
      failed_requests: failedCount,
      dropped_iterations: droppedIterations,
      success_rate: totalRequests > 0 ? (successCount / totalRequests) * 100 : 0,
      actual_successful_rps: successCount / durationSeconds,
      total_rps: totalRequests / durationSeconds,
      duration_seconds: durationSeconds,
    }
  };

  return {
    [`/results/${serviceName}.json`]: JSON.stringify(enhancedData, null, 2),
    stdout: textSummary(enhancedData, { indent: ' ', enableColors: true }),
  };
}

// Helper function for text summary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textSummary(data: any, options: { indent?: string; enableColors?: boolean } = {}): string {
  const { indent = '' } = options;
  const lines = [];

  lines.push('\n' + '='.repeat(60));
  lines.push(`${indent}BENCHMARK RESULTS - THROUGHPUT TEST`);
  lines.push('='.repeat(60));

  // Computed metrics (most important!)
  if (data.computed) {
    lines.push(`\n${indent}📊 THROUGHPUT SUMMARY:`);
    lines.push(`${indent}  Total Requests: ${data.computed.total_requests.toLocaleString()}`);
    lines.push(`${indent}  ✓ Successful: ${data.computed.successful_requests.toLocaleString()}`);
    lines.push(`${indent}  ✗ Failed: ${data.computed.failed_requests.toLocaleString()}`);
    lines.push(`${indent}  ⚠ Dropped: ${data.computed.dropped_iterations.toLocaleString()}`);
    lines.push(`${indent}  Success Rate: ${data.computed.success_rate.toFixed(2)}%`);
    lines.push(`${indent}  ⚡ Actual RPS (successful): ${data.computed.actual_successful_rps.toFixed(2)} req/s`);
    lines.push(`${indent}  Duration: ${data.computed.duration_seconds.toFixed(1)}s`);
  }

  // HTTP metrics
  if (data.metrics.http_req_duration) {
    const duration = data.metrics.http_req_duration;
    lines.push(`\n${indent}⏱️  LATENCY:`);
    lines.push(`${indent}  avg: ${duration.values.avg?.toFixed(2) || 'N/A'}ms`);
    lines.push(`${indent}  min: ${duration.values.min?.toFixed(2) || 'N/A'}ms`);
    lines.push(`${indent}  max: ${duration.values.max?.toFixed(2) || 'N/A'}ms`);
    lines.push(`${indent}  p(95): ${duration.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
    lines.push(`${indent}  p(99): ${duration.values['p(99)']?.toFixed(2) || 'N/A'}ms`);
  }

  // Per-endpoint latencies
  const endpointMetrics = ['health_latency', 'get_user_latency', 'create_user_latency'];
  for (const metric of endpointMetrics) {
    if (data.metrics[metric]) {
      const m = data.metrics[metric];
      const name = metric.replace(/_/g, ' ').replace('latency', '').trim();
      lines.push(`\n${indent}📍 ${name.toUpperCase()}:`);
      lines.push(`${indent}  avg: ${m.values.avg?.toFixed(2) || 'N/A'}ms`);
      lines.push(`${indent}  p(95): ${m.values['p(95)']?.toFixed(2) || 'N/A'}ms`);
    }
  }

  lines.push('\n' + '='.repeat(60) + '\n');
  return lines.join('\n');
}
