import { spawn, execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readdirSync, appendFileSync } from 'fs';
import { join, resolve } from 'path';
import { generateGraphs } from './generate-graphs.js';

// Types
interface TestConfig {
  name: string;
  service: string;
  port: number;
  framework: string;
  runtime: string;
}

interface ProfileConfig {
  name: string;
  displayName: string;
  warmupDuration: string;
  cooldownSeconds: number;
}

interface ResourceMetrics {
  service: string;
  timestamps: number[];
  cpu_percent: number[];
  memory_mb: number[];
}

// Global run directory (set in main)
let RUN_DIR = '';
let DATA_DIR = '';

// Configuration
const TESTS: TestConfig[] = [
  { name: 'express-node', service: 'express-node', port: 3010, framework: 'Express', runtime: 'Node.js' },
  { name: 'express-bun', service: 'express-bun', port: 3011, framework: 'Express', runtime: 'Bun' },
  { name: 'express-deno', service: 'express-deno', port: 3012, framework: 'Express', runtime: 'Deno' },
  { name: 'hono-node', service: 'hono-node', port: 3020, framework: 'Hono', runtime: 'Node.js' },
  { name: 'hono-bun', service: 'hono-bun', port: 3021, framework: 'Hono', runtime: 'Bun' },
  { name: 'hono-deno', service: 'hono-deno', port: 3022, framework: 'Hono', runtime: 'Deno' },
  { name: 'elysia-node', service: 'elysia-node', port: 3030, framework: 'Elysia', runtime: 'Node.js' },
  { name: 'elysia-bun', service: 'elysia-bun', port: 3031, framework: 'Elysia', runtime: 'Bun' },
  { name: 'elysia-deno', service: 'elysia-deno', port: 3032, framework: 'Elysia', runtime: 'Deno' },
];

const PROFILES: Record<string, ProfileConfig> = {
  quick: { name: 'quick', displayName: 'Quick', warmupDuration: '3s', cooldownSeconds: 5 },
  standard: { name: 'standard', displayName: 'Standard', warmupDuration: '5s', cooldownSeconds: 10 },
  full: { name: 'full', displayName: 'Full', warmupDuration: '10s', cooldownSeconds: 15 },
};

// Parse command line arguments
function parseArgs(): { profile: string } {
  const args = process.argv.slice(2);
  let profile = 'standard';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--profile' && args[i + 1]) {
      profile = args[i + 1];
    }
  }

  if (!PROFILES[profile]) {
    console.error(`Invalid profile: ${profile}. Valid options: ${Object.keys(PROFILES).join(', ')}`);
    process.exit(1);
  }

  return { profile };
}

// Utility functions
function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info'): void {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    error: '\x1b[31m',
    warn: '\x1b[33m',
  };
  const reset = '\x1b[0m';
  console.log(`${colors[type]}[${timestamp}] ${message}${reset}`);
}

function execCommand(command: string, silent = false): string {
  try {
    return execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit'
    });
  } catch (error) {
    if (!silent) {
      throw error;
    }
    return '';
  }
}

// Docker functions
async function startService(service: string): Promise<void> {
  log(`Building and starting ${service}...`);
  execCommand(`docker-compose --profile ${service} up -d --build ${service}`);
}

async function stopService(service: string): Promise<void> {
  log(`Stopping ${service}...`);
  execCommand(`docker-compose --profile ${service} stop ${service}`, true);
  execCommand(`docker-compose --profile ${service} rm -f ${service}`, true);
}

async function waitForService(port: number, maxRetries = 30): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Service not ready yet
    }
    await sleep(1);
  }
  return false;
}

// Resource monitoring functions
function collectDockerStats(containerName: string): { cpu: number; memory: number } | null {
  try {
    const output = execSync(
      `docker stats ${containerName} --no-stream --format "{{.CPUPerc}},{{.MemUsage}}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    ).trim();

    if (!output) return null;

    const [cpuStr, memStr] = output.split(',');
    const cpu = parseFloat(cpuStr.replace('%', '')) || 0;

    // Parse memory (e.g., "45.2MiB / 512MiB" -> 45.2)
    const memMatch = memStr.match(/([\d.]+)\s*(MiB|GiB|KiB)/i);
    let memory = 0;
    if (memMatch) {
      memory = parseFloat(memMatch[1]);
      if (memMatch[2].toLowerCase() === 'gib') memory *= 1024;
      if (memMatch[2].toLowerCase() === 'kib') memory /= 1024;
    }

    return { cpu, memory };
  } catch {
    return null;
  }
}

async function monitorResources(
  containerName: string,
  intervalMs: number = 1000
): Promise<{ stop: () => ResourceMetrics }> {
  const metrics: ResourceMetrics = {
    service: containerName,
    timestamps: [],
    cpu_percent: [],
    memory_mb: []
  };

  const startTime = Date.now();
  let running = true;

  const collect = () => {
    if (!running) return;

    const stats = collectDockerStats(containerName);
    if (stats) {
      metrics.timestamps.push(Date.now() - startTime);
      metrics.cpu_percent.push(stats.cpu);
      metrics.memory_mb.push(stats.memory);
    }

    if (running) {
      setTimeout(collect, intervalMs);
    }
  };

  // Start collecting
  collect();

  return {
    stop: () => {
      running = false;
      return metrics;
    }
  };
}

// K6 functions
async function runK6Warmup(baseUrl: string): Promise<void> {
  log('Running warmup...');

  return new Promise((resolve, reject) => {
    const k6 = spawn('docker', [
      'run', '--rm',
      '--network', 'web-api-runtime-benchmark_benchmark-network',
      '-v', `${process.cwd()}/k6/dist:/scripts`,
      'grafana/k6:latest',
      'run',
      '-e', `BASE_URL=${baseUrl}`,
      '/scripts/warmup.js'
    ], { stdio: 'inherit' });

    k6.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Warmup failed with code ${code}`));
      }
    });
  });
}

async function runK6Benchmark(
  serviceName: string,
  baseUrl: string,
  profile: string
): Promise<void> {
  log(`Running benchmark for ${serviceName} with profile: ${profile}...`);

  return new Promise((resolve, reject) => {
    const k6 = spawn('docker', [
      'run', '--rm',
      '--network', 'web-api-runtime-benchmark_benchmark-network',
      '-v', `${process.cwd()}/k6/dist:/scripts`,
      '-v', `${DATA_DIR}:/results`,
      '-e', `BASE_URL=${baseUrl}`,
      '-e', `PROFILE=${profile}`,
      '-e', `SERVICE_NAME=${serviceName}`,
      'grafana/k6:latest',
      'run',
      '/scripts/benchmark.js'
    ], { stdio: 'inherit' });

    k6.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Benchmark failed with code ${code}`));
      }
    });
  });
}

// Main execution
async function runBenchmark(test: TestConfig, profileConfig: ProfileConfig): Promise<boolean> {
  const separator = '='.repeat(60);
  console.log(`\n${separator}`);
  log(`Starting test: ${test.framework} on ${test.runtime}`, 'info');
  console.log(separator);

  let resourceMonitor: { stop: () => ResourceMetrics } | null = null;

  try {
    // Start the service
    await startService(test.service);

    // Wait for service to be ready
    log(`Waiting for ${test.name} to be ready...`);
    const isReady = await waitForService(test.port);

    if (!isReady) {
      log(`Service ${test.name} failed to start`, 'error');
      return false;
    }

    log(`${test.name} is ready!`, 'success');

    // Run warmup
    const containerUrl = `http://${test.service}:3000`;
    await runK6Warmup(containerUrl);

    // Short pause after warmup
    await sleep(2);

    // Start resource monitoring
    log('Starting resource monitoring...');
    resourceMonitor = await monitorResources(test.service, 500); // Collect every 500ms

    // Run actual benchmark
    await runK6Benchmark(test.name, containerUrl, profileConfig.name);

    // Stop monitoring and save metrics
    const resourceMetrics = resourceMonitor.stop();
    resourceMonitor = null;

    // Save resource metrics
    const resourceFile = join(DATA_DIR, `${test.name}_resources.json`);
    writeFileSync(resourceFile, JSON.stringify(resourceMetrics, null, 2));
    log(`Resource metrics saved (${resourceMetrics.cpu_percent.length} samples)`, 'success');

    // Log peak values
    const peakCpu = Math.max(...resourceMetrics.cpu_percent);
    const avgCpu = resourceMetrics.cpu_percent.reduce((a, b) => a + b, 0) / resourceMetrics.cpu_percent.length;
    const peakMem = Math.max(...resourceMetrics.memory_mb);
    const avgMem = resourceMetrics.memory_mb.reduce((a, b) => a + b, 0) / resourceMetrics.memory_mb.length;
    log(`  Peak CPU: ${peakCpu.toFixed(1)}%, Avg CPU: ${avgCpu.toFixed(1)}%`, 'info');
    log(`  Peak Memory: ${peakMem.toFixed(1)}MB, Avg Memory: ${avgMem.toFixed(1)}MB`, 'info');

    log(`Benchmark for ${test.name} completed!`, 'success');

    // Cooldown
    log(`Cooldown for ${profileConfig.cooldownSeconds} seconds...`);
    await sleep(profileConfig.cooldownSeconds);

    return true;
  } catch (error) {
    log(`Error during benchmark for ${test.name}: ${error}`, 'error');
    return false;
  } finally {
    // Stop monitoring if still running
    if (resourceMonitor) {
      resourceMonitor.stop();
    }
    // Always stop the service
    await stopService(test.service);
  }
}

async function main(): Promise<void> {
  const { profile } = parseArgs();
  const profileConfig = PROFILES[profile];

  console.log('\n' + '='.repeat(60));
  console.log('  WEB API RUNTIME BENCHMARK');
  console.log('  Performance comparison of Express, Hono, and Elysia');
  console.log('  on Node.js, Bun, and Deno');
  console.log('='.repeat(60));

  log(`Profile: ${profileConfig.displayName}`, 'info');
  log(`Total tests: ${TESTS.length}`, 'info');

  // Create results directory structure: results/<timestamp>_<Profile>/data/ and /graphs/
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  RUN_DIR = resolve('./results', `${timestamp}_${profileConfig.displayName}`);
  DATA_DIR = resolve(RUN_DIR, 'data');
  const graphsDir = resolve(RUN_DIR, 'graphs');

  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(graphsDir, { recursive: true });

  log(`Results will be saved to: ${RUN_DIR}`, 'info');

  const results: { test: string; success: boolean; duration?: number }[] = [];
  const startTime = Date.now();

  // Run all tests sequentially
  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const testStartTime = Date.now();

    log(`\nTest ${i + 1}/${TESTS.length}: ${test.framework} on ${test.runtime}`, 'info');

    const success = await runBenchmark(test, profileConfig);
    const duration = (Date.now() - testStartTime) / 1000;

    results.push({
      test: test.name,
      success,
      duration
    });

    if (success) {
      log(`✓ ${test.name} completed in ${duration.toFixed(1)}s`, 'success');
    } else {
      log(`✗ ${test.name} failed`, 'error');
    }
  }

  const totalDuration = (Date.now() - startTime) / 1000;

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('  BENCHMARK SUMMARY');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  log(`Completed: ${successCount}/${TESTS.length} tests`, successCount === TESTS.length ? 'success' : 'warn');
  log(`Total duration: ${(totalDuration / 60).toFixed(1)} minutes`, 'info');

  console.log('\nResults:');
  for (const result of results) {
    const status = result.success ? '✓' : '✗';
    const color = result.success ? '\x1b[32m' : '\x1b[31m';
    console.log(`${color}  ${status} ${result.test} (${result.duration?.toFixed(1)}s)\x1b[0m`);
  }

  // Save run metadata
  const metadata = {
    timestamp: new Date().toISOString(),
    profile: profileConfig.displayName,
    totalDuration,
    results
  };

  writeFileSync(
    join(DATA_DIR, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Generate graphs automatically
  await generateGraphs(resolve(RUN_DIR));

  console.log('\n' + '='.repeat(60));
  log(`Results and graphs saved to: ${RUN_DIR}`, 'success');
  console.log('='.repeat(60) + '\n');
}

// Run
main().catch(error => {
  log(`Fatal error: ${error}`, 'error');
  process.exit(1);
});
