# 🚀 Web API Runtime Benchmark

A comprehensive, scientific-grade benchmarking suite comparing modern JavaScript/TypeScript web frameworks across multiple runtimes. This project measures real-world performance of **Express**, **Hono**, and **Elysia** running on **Node.js**, **Bun**, and **Deno** in containerized environments.

<p align="center">
  <img src="https://img.shields.io/badge/Frameworks-Express%20%7C%20Hono%20%7C%20Elysia-blue" alt="Frameworks">
  <img src="https://img.shields.io/badge/Runtimes-Node.js%20%7C%20Bun%20%7C%20Deno-green" alt="Runtimes">
  <img src="https://img.shields.io/badge/Load%20Testing-k6-orange" alt="k6">
  <img src="https://img.shields.io/badge/Containers-Docker-blue" alt="Docker">
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Research Question](#-research-question)
- [Tested Combinations](#-tested-combinations)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Detailed Setup Guide](#-detailed-setup-guide)
- [Running Benchmarks](#-running-benchmarks)
- [Understanding Results](#-understanding-results)
- [Metrics Explained](#-metrics-explained)
- [Generated Reports](#-generated-reports)
- [Architecture](#-architecture)
- [Test Methodology](#-test-methodology)
- [Configuration](#-configuration)
- [Monitoring](#-monitoring)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

This benchmark suite provides a **fair, reproducible comparison** of web framework performance by:

- Running all frameworks under **identical conditions** (same Docker resource limits)
- Using **realistic workloads** (CRUD operations with SQLite database)
- Measuring multiple dimensions: **throughput**, **latency**, **resource usage**
- Generating **publication-quality graphs** and reports
- Supporting **ramping load tests** to find breaking points

### Why This Benchmark?

Most existing benchmarks either:

- Test only "hello world" endpoints (unrealistic)
- Don't isolate resources properly (unfair comparison)
- Don't test across multiple runtimes
- Don't provide reproducible results

This project solves all these issues with a standardized, containerized approach.

---

## 🔬 Research Question

> **How do latency (p95/p99), throughput (requests/second), and resource consumption (CPU/RAM) differ between Express, Hono, and Elysia when running on Node.js, Bun, and Deno in a standardized Docker test environment under identical load?**

---

## 🧪 Tested Combinations

| Framework   | Node.js | Bun | Deno |
| ----------- | :-----: | :-: | :--: |
| **Express** |   ✅    | ✅  |  ✅  |
| **Hono**    |   ✅    | ✅  |  ✅  |
| **Elysia**  |   ✅    | ✅  |  ✅  |

### Framework Overview

| Framework   | Description                                 | Designed For         |
| ----------- | ------------------------------------------- | -------------------- |
| **Express** | The classic Node.js framework (since 2010)  | Stability, ecosystem |
| **Hono**    | Ultralight, multi-runtime framework         | Speed, portability   |
| **Elysia**  | Bun-first framework with TypeBox validation | Performance, DX      |

### Runtime Overview

| Runtime     | Description                       | Key Features                         |
| ----------- | --------------------------------- | ------------------------------------ |
| **Node.js** | The original JavaScript runtime   | Mature, stable, huge ecosystem       |
| **Bun**     | All-in-one JS runtime & toolkit   | Fast startup, native bundler         |
| **Deno**    | Secure runtime by Node.js creator | TypeScript native, secure by default |

---

## 📦 Prerequisites

Before running the benchmarks, ensure you have the following installed:

### Required Software

| Software           | Version | Installation                                      |
| ------------------ | ------- | ------------------------------------------------- |
| **Docker**         | 20.10+  | [Get Docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.0+    | Included with Docker Desktop                      |
| **Node.js**        | 20.x+   | [Download Node.js](https://nodejs.org/)           |
| **Git**            | 2.x+    | [Download Git](https://git-scm.com/)              |

### System Requirements

| Resource | Minimum                            | Recommended |
| -------- | ---------------------------------- | ----------- |
| **CPU**  | 4 cores                            | 8+ cores    |
| **RAM**  | 8 GB                               | 16+ GB      |
| **Disk** | 10 GB free                         | 20+ GB free |
| **OS**   | Windows 10/11, macOS 10.15+, Linux | Any         |

> ⚠️ **Important**: Close other resource-intensive applications during benchmarks for accurate results.

---

## ⚡ Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/web-api-runtime-benchmark.git
cd web-api-runtime-benchmark

# 2. Install dependencies
npm install

# 3. Run a quick benchmark (~10 minutes)
npm run benchmark:quick
```

That's it! Results will be generated in the `./results/` folder.

---

## 📖 Detailed Setup Guide

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/web-api-runtime-benchmark.git
cd web-api-runtime-benchmark

# Install Node.js dependencies
npm install
```

### Step 2: Verify Docker Installation

```bash
# Check Docker is running
docker --version
docker compose version

# Verify Docker can run containers
docker run hello-world
```

### Step 3: Build the k6 Scripts

```bash
# Compile TypeScript k6 scripts
npm run build:k6
```

### Step 4: (Optional) Pre-pull Docker Images

This speeds up the first benchmark run:

```bash
# Pull all required base images
docker pull node:20-alpine
docker pull oven/bun:alpine
docker pull denoland/deno:alpine
```

---

## 🏃 Running Benchmarks

### Available Test Profiles

| Profile    | Duration | Max Load     | Use Case                          |
| ---------- | -------- | ------------ | --------------------------------- |
| `quick`    | ~10 min  | 20,000 req/s | Development, quick checks         |
| `standard` | ~20 min  | 30,000 req/s | **Recommended for final results** |
| `full`     | ~35 min  | 40,000 req/s | Maximum statistical accuracy      |

### Commands

```bash
# Quick benchmark (~10 minutes)
npm run benchmark:quick

# Standard benchmark (~20 minutes) - RECOMMENDED
npm run benchmark:standard

# Full benchmark (~35 minutes)
npm run benchmark:full
```

### What Happens During a Benchmark

1. **Infrastructure Setup** (~2 min)
   - Docker Compose starts all containers
   - All 9 API services start up

2. **Per-Service Testing** (repeated 9 times)
   - **Warmup Phase**: JIT compilers optimize code
   - **Load Test**: k6 ramps up requests progressively
   - **Resource Monitoring**: CPU/RAM sampled every 250ms
   - **Cooldown**: System stabilizes before next test

3. **Report Generation**
   - Results are processed and analyzed
   - SVG graphs are generated
   - HTML report is created

---

## 📊 Understanding Results

Results are saved in timestamped folders under `./results/`:

```
results/
└── 2026-01-26T15-30-00_Standard/
    ├── data/
    │   ├── express-node.json          # Raw k6 results
    │   ├── express-node_resources.json # CPU/RAM time series
    │   ├── hono-bun.json
    │   ├── hono-bun_resources.json
    │   └── ... (all 9 services)
    ├── graphs/
    │   ├── successful_rps.svg          # Throughput comparison
    │   ├── p95_latency_ms.svg          # Latency comparison
    │   ├── peak_cpu_percent.svg        # CPU usage
    │   ├── peak_memory_mb.svg          # Memory usage
    │   ├── cpu_over_time.svg           # CPU timeline
    │   ├── memory_over_time.svg        # Memory timeline
    │   └── ... (more graphs)
    └── report.html                      # Interactive HTML report
```

---

## 📈 Metrics Explained

### Throughput Metrics

| Metric             | Description                                | Unit  | Better   |
| ------------------ | ------------------------------------------ | ----- | -------- |
| **Successful RPS** | Requests processed successfully per second | req/s | Higher ↑ |
| **Total Requests** | Total requests handled during test         | count | Higher ↑ |
| **Success Rate**   | Percentage of requests that succeeded      | %     | Higher ↑ |

### Latency Metrics

| Metric              | Description                   | Unit | Better  |
| ------------------- | ----------------------------- | ---- | ------- |
| **Average Latency** | Mean response time            | ms   | Lower ↓ |
| **p95 Latency**     | 95th percentile response time | ms   | Lower ↓ |
| **p99 Latency**     | 99th percentile response time | ms   | Lower ↓ |

> **What are percentiles?**
>
> - **p95 = 50ms** means 95% of requests completed in ≤50ms
> - **p99 = 100ms** means 99% of requests completed in ≤100ms
> - These are more meaningful than averages for real-world performance

### Resource Metrics

| Metric          | Description                   | Unit | Better  |
| --------------- | ----------------------------- | ---- | ------- |
| **Peak CPU**    | Maximum CPU usage during test | %    | Lower ↓ |
| **Avg CPU**     | Average CPU usage during test | %    | Lower ↓ |
| **Peak Memory** | Maximum RAM usage during test | MB   | Lower ↓ |
| **Avg Memory**  | Average RAM usage during test | MB   | Lower ↓ |

### Efficiency Score

The benchmark calculates an **efficiency score** that balances throughput against resource usage:

```
Efficiency = Successful RPS / (Avg CPU% × Peak Memory MB)
```

This helps identify which combination delivers the best performance per resource unit.

---

## 📑 Generated Reports

### HTML Report (`report.html`)

An interactive report containing:

- 📊 All comparison charts (bar charts, line charts)
- 📋 Summary tables with all metrics
- 🏆 Rankings by different criteria
- 📈 Time-series graphs for CPU/RAM

### SVG Graphs

Publication-quality vector graphics suitable for:

- Academic papers (LaTeX compatible)
- Presentations
- Blog posts
- Documentation

Available graphs:

| Graph                  | Description                         |
| ---------------------- | ----------------------------------- |
| `successful_rps.svg`   | Throughput comparison (bar chart)   |
| `total_requests.svg`   | Total requests handled              |
| `success_rate.svg`     | Success rate percentage             |
| `avg_latency_ms.svg`   | Average latency comparison          |
| `p95_latency_ms.svg`   | p95 latency comparison              |
| `p99_latency_ms.svg`   | p99 latency comparison              |
| `peak_cpu_percent.svg` | Peak CPU usage                      |
| `avg_cpu_percent.svg`  | Average CPU usage                   |
| `peak_memory_mb.svg`   | Peak memory usage                   |
| `avg_memory_mb.svg`    | Average memory usage                |
| `cpu_over_time.svg`    | CPU usage over time (line chart)    |
| `memory_over_time.svg` | Memory usage over time (line chart) |

---

### Container Resource Limits

All API containers run with **identical constraints** for fair comparison:

| Resource   | Limit  |
| ---------- | ------ |
| **CPU**    | 1 core |
| **Memory** | 512 MB |

---

## 🔬 Test Methodology

### Load Testing Strategy

This benchmark uses **ramping-arrival-rate** testing, which:

- Sends requests at a **fixed rate**, regardless of response time
- Reveals the **true maximum throughput** each framework can handle
- Shows **how gracefully** each framework degrades under overload

### Test Phases

```
Request Rate
     ▲
     │                    ┌─────────┐
     │               ┌────┘         │
     │          ┌────┘              │
     │     ┌────┘                   │
     │┌────┘                        └────┐
     │                                    └──▶ Time
     └────────────────────────────────────────
       Ramp    Stress    Peak    Ramp
        Up      Test     Test    Down
```

### Per-Service Test Flow

1. **JIT Warmup** (3-10s depending on profile)
   - Light load to trigger JIT optimization
   - Ensures compiled code paths are hot

2. **Main Benchmark**
   - Progressive load increase
   - Multiple stages to find saturation point
   - Continuous resource monitoring

3. **Cooldown** (5-15s)
   - System returns to baseline
   - Prevents interference between tests

### Statistical Validity

- Each test runs the **exact same workload**
- Resource limits are **enforced by Docker**
- Results include **percentile distributions**
- Multiple data points for **time-series analysis**

---

## ⚙️ Configuration

### Modifying Test Profiles

Edit `k6/benchmark.ts` to customize load patterns:

```typescript
const profiles = {
  quick: {
    scenarios: {
      throughput_test: {
        executor: "ramping-arrival-rate",
        startRate: 500, // Starting requests/second
        preAllocatedVUs: 2000, // Virtual users pre-allocated
        maxVUs: 5000, // Maximum virtual users
        stages: [
          { duration: "5s", target: 2000 }, // Ramp to 2000 req/s
          { duration: "10s", target: 5000 }, // Push to 5000 req/s
          // ... more stages
        ],
      },
    },
  },
};
```

### Container Resource Limits

Modify `docker-compose.yml` to change resource constraints:

```yaml
services:
  express-node:
    deploy:
      resources:
        limits:
          cpus: "1" # CPU cores
          memory: 512M # Memory limit
```

## 🔧 Troubleshooting

### Common Issues

#### Docker containers won't start

```bash
# Check if ports are in use
netstat -an | grep -E "3010|3020|3030|9090|3001"

# Remove all containers and try again
docker compose down -v
npm run benchmark:quick
```

#### "Cannot connect to Docker daemon"

```bash
# Start Docker Desktop (Windows/macOS)
# Or start Docker service (Linux):
sudo systemctl start docker
```

#### k6 runs out of VUs

This means the server is too slow to handle the configured load. The benchmark will still complete, but results may show high failure rates.

#### Out of memory errors

```bash
# Increase Docker memory limit in Docker Desktop settings
# Or reduce maxVUs in k6/benchmark.ts
```

### Cleanup Commands

```bash
# Stop all containers
docker compose down

# Remove all containers, networks, and volumes
docker compose down -v

# Clean up results
npm run clean

# Full reset (remove Docker images too)
docker compose down -v --rmi all
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. **Add new frameworks**: Create a new folder in `apis/` following the existing pattern
2. **Improve accuracy**: Suggest better testing methodologies
3. **Fix bugs**: Submit pull requests for any issues found
4. **Documentation**: Improve this README or add more docs

### Adding a New Framework

1. Create folder: `apis/{framework}-{runtime}/`
2. Add `Dockerfile`, `index.ts`, `package.json`
3. Implement the 4 required endpoints
4. Add service to `docker-compose.yml`
5. Add to test configuration in `scripts/run-benchmarks.ts`

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [k6](https://k6.io/) - Modern load testing tool
- [Express](https://expressjs.com/) - Fast, unopinionated web framework
- [Hono](https://hono.dev/) - Ultrafast web framework
- [Elysia](https://elysiajs.com/) - Ergonomic web framework for Bun
- [Docker](https://www.docker.com/) - Container platform

---

<p align="center">
  Made with ❤️ for the JavaScript/TypeScript community
</p>
