import http from 'k6/http';
import { sleep } from 'k6';

// Warmup script - runs before the actual benchmark
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 10,
  duration: '5s',
  thresholds: {
    http_req_failed: ['rate<0.5'], // Allow some failures during warmup
  },
};

export default function () {
  // Simple warmup requests to initialize JIT compiler
  http.get(`${BASE_URL}/health`);
  sleep(0.1);

  const userId = Math.floor(Math.random() * 100) + 1;
  http.get(`${BASE_URL}/users/${userId}`);
  sleep(0.1);
}
