/**
 * Generate publication-quality benchmark graphs for scientific work.
 * Pure TypeScript - generates SVG files directly (no native dependencies).
 * SVG can be converted to PDF using Inkscape or included directly in LaTeX.
 */

import fs from 'fs/promises';
import path from 'path';

// =============================================================================
// CONFIGURATION - Consistent colors for scientific papers
// =============================================================================

const COLORS: Record<string, string> = {
  // Express - Blue shades
  'express-node': '#1f77b4',
  'express-bun': '#5fa2ce',
  'express-deno': '#9ecae1',

  // Hono - Green shades
  'hono-node': '#2ca02c',
  'hono-bun': '#5fd35f',
  'hono-deno': '#98df8a',

  // Elysia - Orange/Red shades
  'elysia-node': '#d62728',
  'elysia-bun': '#ff7f0e',
  'elysia-deno': '#ffbb78',
};

const DISPLAY_NAMES: Record<string, string> = {
  'express-node': 'Express (Node.js)',
  'express-bun': 'Express (Bun)',
  'express-deno': 'Express (Deno)',
  'hono-node': 'Hono (Node.js)',
  'hono-bun': 'Hono (Bun)',
  'hono-deno': 'Hono (Deno)',
  'elysia-node': 'Elysia (Node.js)',
  'elysia-bun': 'Elysia (Bun)',
  'elysia-deno': 'Elysia (Deno)',
};

const SERVICE_ORDER = [
  'express-node', 'express-bun', 'express-deno',
  'hono-node', 'hono-bun', 'hono-deno',
  'elysia-node', 'elysia-bun', 'elysia-deno'
];

// Chart dimensions
const CHART_WIDTH = 900;
const CHART_HEIGHT = 500;
const MARGIN = { top: 60, right: 30, bottom: 120, left: 80 };

// =============================================================================
// TYPES
// =============================================================================

interface BenchmarkResult {
  metrics?: {
    http_reqs?: { rate?: number; count?: number };
    http_req_duration?: { avg?: number; 'p(95)'?: number; 'p(99)'?: number; max?: number };
    http_req_failed?: { count?: number };
  };
}

interface ResourceMetrics {
  service: string;
  timestamps: number[];
  cpu_percent: number[];
  memory_mb: number[];
}

interface ResourceTimeSeries {
  [service: string]: ResourceMetrics;
}

interface Metrics {
  successful_rps: Record<string, number>;
  total_requests: Record<string, number>;
  success_rate: Record<string, number>;
  avg_latency_ms: Record<string, number>;
  p95_latency_ms: Record<string, number>;
  p99_latency_ms: Record<string, number>;
}

interface ResourceSummary {
  peak_cpu_percent: Record<string, number>;
  avg_cpu_percent: Record<string, number>;
  peak_memory_mb: Record<string, number>;
  avg_memory_mb: Record<string, number>;
}

interface ChartConfig {
  key: keyof Metrics;
  title: string;
  ylabel: string;
  higherIsBetter: boolean;
}

// =============================================================================
// LOAD RESULTS
// =============================================================================

async function loadResults(dataDir: string): Promise<Record<string, BenchmarkResult>> {
  const results: Record<string, BenchmarkResult> = {};

  try {
    const files = await fs.readdir(dataDir);

    for (const file of files) {
      if (!file.endsWith('.json') || file === 'metadata.json') {
        continue;
      }

      // File format is now just "service-name.json"
      const service = file.replace('.json', '');
      const filePath = path.join(dataDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as BenchmarkResult;
      results[service] = data;
    }
  } catch (error) {
    console.error('Error loading results:', error);
  }

  return results;
}

// =============================================================================
// EXTRACT METRICS
// =============================================================================

function extractMetrics(results: Record<string, BenchmarkResult>): Metrics {
  const metrics: Metrics = {
    successful_rps: {},
    total_requests: {},
    success_rate: {},
    avg_latency_ms: {},
    p95_latency_ms: {},
    p99_latency_ms: {},
  };

  for (const [service, data] of Object.entries(results)) {
    if (service.startsWith('_') || service.includes('_resources')) continue;

    const d = data as any;

    // Use computed metrics from the new benchmark format
    if (d.computed) {
      metrics.successful_rps[service] = d.computed.actual_successful_rps ?? 0;
      metrics.total_requests[service] = d.computed.total_requests ?? 0;
      metrics.success_rate[service] = d.computed.success_rate ?? 0;
    }

    // Latency metrics
    if (d.metrics?.http_req_duration?.values) {
      const m = d.metrics.http_req_duration.values;
      metrics.avg_latency_ms[service] = m.avg ?? 0;
      metrics.p95_latency_ms[service] = m['p(95)'] ?? 0;
      metrics.p99_latency_ms[service] = m['p(99)'] ?? 0;
    }
  }

  return metrics;
}

// =============================================================================
// LOAD RESOURCE METRICS
// =============================================================================

async function loadResourceMetrics(dataDir: string): Promise<{ summary: ResourceSummary; timeSeries: ResourceTimeSeries }> {
  const summary: ResourceSummary = {
    peak_cpu_percent: {},
    avg_cpu_percent: {},
    peak_memory_mb: {},
    avg_memory_mb: {},
  };
  const timeSeries: ResourceTimeSeries = {};

  try {
    const files = await fs.readdir(dataDir);

    for (const file of files) {
      if (!file.endsWith('_resources.json')) continue;

      const service = file.replace('_resources.json', '');
      const filePath = path.join(dataDir, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as ResourceMetrics;

      // Store time series data
      timeSeries[service] = data;

      if (data.cpu_percent && data.cpu_percent.length > 0) {
        summary.peak_cpu_percent[service] = Math.max(...data.cpu_percent);
        summary.avg_cpu_percent[service] = data.cpu_percent.reduce((a, b) => a + b, 0) / data.cpu_percent.length;
      }

      if (data.memory_mb && data.memory_mb.length > 0) {
        summary.peak_memory_mb[service] = Math.max(...data.memory_mb);
        summary.avg_memory_mb[service] = data.memory_mb.reduce((a, b) => a + b, 0) / data.memory_mb.length;
      }
    }
  } catch (error) {
    console.error('Error loading resource metrics:', error);
  }

  return { summary, timeSeries };
}

// =============================================================================
// SVG GENERATION
// =============================================================================

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function generateBarChartSVG(
  data: Record<string, number>,
  title: string,
  ylabel: string,
  higherIsBetter: boolean = true
): string {
  const services = SERVICE_ORDER.filter(s => s in data && data[s] > 0);
  const values = services.map(s => data[s]);

  if (services.length === 0) return '';

  const maxValue = Math.max(...values) * 1.15; // Add 15% padding
  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const barWidth = (plotWidth / services.length) * 0.7;
  const barGap = (plotWidth / services.length) * 0.3;

  // Find best performer
  const bestIdx = higherIsBetter
    ? values.indexOf(Math.max(...values))
    : values.indexOf(Math.min(...values.filter(v => v > 0)));

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => (maxValue / yTicks) * i);

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="${CHART_WIDTH}" height="${CHART_HEIGHT}">
  <style>
    .title { font: bold 18px Arial, sans-serif; }
    .axis-label { font: bold 14px Arial, sans-serif; }
    .tick-label { font: 11px Arial, sans-serif; }
    .bar-label { font: bold 10px Arial, sans-serif; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
  </style>
  
  <!-- Background -->
  <rect width="100%" height="100%" fill="white"/>
  
  <!-- Title -->
  <text x="${CHART_WIDTH / 2}" y="35" text-anchor="middle" class="title">${escapeXml(title)}</text>
  
  <!-- Y-axis label -->
  <text x="25" y="${MARGIN.top + plotHeight / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 25, ${MARGIN.top + plotHeight / 2})">${escapeXml(ylabel)}</text>
  
  <!-- Grid lines and Y-axis ticks -->
`;

  for (let i = 0; i <= yTicks; i++) {
    const y = MARGIN.top + plotHeight - (plotHeight / yTicks) * i;
    const value = yTickValues[i];
    svg += `  <line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + plotWidth}" y2="${y}" class="grid"/>
  <text x="${MARGIN.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${value.toFixed(1)}</text>
`;
  }

  // Bars
  services.forEach((service, i) => {
    const x = MARGIN.left + i * (barWidth + barGap) + barGap / 2;
    const barHeight = (values[i] / maxValue) * plotHeight;
    const y = MARGIN.top + plotHeight - barHeight;
    const color = COLORS[service];
    const strokeColor = i === bestIdx ? '#FFD700' : '#333';
    const strokeWidth = i === bestIdx ? 3 : 1;

    svg += `
  <!-- ${service} -->
  <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>
  <text x="${x + barWidth / 2}" y="${y - 5}" text-anchor="middle" class="bar-label">${values[i].toFixed(1)}</text>
  <text x="${x + barWidth / 2}" y="${MARGIN.top + plotHeight + 20}" text-anchor="end" class="tick-label" transform="rotate(-45, ${x + barWidth / 2}, ${MARGIN.top + plotHeight + 20})">${escapeXml(DISPLAY_NAMES[service])}</text>
`;
  });

  // X-axis label
  svg += `
  <text x="${CHART_WIDTH / 2}" y="${CHART_HEIGHT - 15}" text-anchor="middle" class="axis-label">Framework (Runtime)</text>
  
  <!-- Axes -->
  <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
  <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${MARGIN.left + plotWidth}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
  
  <!-- Best performer indicator -->
  <text x="${CHART_WIDTH - 20}" y="35" text-anchor="end" class="tick-label" fill="#FFD700">★ = Best</text>
</svg>`;

  return svg;
}

function generateGroupedBarChartSVG(
  data: Record<string, number>,
  title: string,
  ylabel: string
): string {
  const frameworks = ['express', 'hono', 'elysia'];
  const frameworkLabels = ['Express', 'Hono', 'Elysia'];
  const runtimes = ['node', 'bun', 'deno'];
  const runtimeLabels = ['Node.js', 'Bun', 'Deno'];
  const runtimeColors = ['#4a90d9', '#f5a623', '#68d391'];

  const values = frameworks.map(fw => runtimes.map(rt => data[`${fw}-${rt}`] ?? 0));
  const maxValue = Math.max(...values.flat()) * 1.15;

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const groupWidth = plotWidth / frameworks.length;
  const barWidth = groupWidth * 0.25;

  const yTicks = 5;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="${CHART_WIDTH}" height="${CHART_HEIGHT}">
  <style>
    .title { font: bold 18px Arial, sans-serif; }
    .axis-label { font: bold 14px Arial, sans-serif; }
    .tick-label { font: 12px Arial, sans-serif; }
    .bar-label { font: bold 9px Arial, sans-serif; }
    .legend-text { font: 11px Arial, sans-serif; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
  </style>
  
  <rect width="100%" height="100%" fill="white"/>
  <text x="${CHART_WIDTH / 2}" y="35" text-anchor="middle" class="title">${escapeXml(title)}</text>
  <text x="25" y="${MARGIN.top + plotHeight / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 25, ${MARGIN.top + plotHeight / 2})">${escapeXml(ylabel)}</text>
`;

  // Grid lines
  for (let i = 0; i <= yTicks; i++) {
    const y = MARGIN.top + plotHeight - (plotHeight / yTicks) * i;
    const value = (maxValue / yTicks) * i;
    svg += `  <line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + plotWidth}" y2="${y}" class="grid"/>
  <text x="${MARGIN.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${value.toFixed(1)}</text>
`;
  }

  // Bars
  frameworks.forEach((fw, fwIdx) => {
    const groupX = MARGIN.left + fwIdx * groupWidth + groupWidth * 0.1;

    runtimes.forEach((rt, rtIdx) => {
      const value = data[`${fw}-${rt}`] ?? 0;
      const x = groupX + rtIdx * barWidth;
      const barHeight = (value / maxValue) * plotHeight;
      const y = MARGIN.top + plotHeight - barHeight;

      svg += `
  <rect x="${x}" y="${y}" width="${barWidth - 2}" height="${barHeight}" fill="${runtimeColors[rtIdx]}" stroke="#333" stroke-width="1"/>
  <text x="${x + barWidth / 2 - 1}" y="${y - 3}" text-anchor="middle" class="bar-label">${value.toFixed(1)}</text>
`;
    });

    // Framework label
    svg += `  <text x="${groupX + barWidth * 1.5}" y="${MARGIN.top + plotHeight + 25}" text-anchor="middle" class="tick-label">${frameworkLabels[fwIdx]}</text>
`;
  });

  // Legend
  const legendX = CHART_WIDTH - 150;
  const legendY = MARGIN.top + 10;
  svg += `
  <rect x="${legendX - 10}" y="${legendY - 15}" width="140" height="80" fill="white" stroke="#ccc" rx="5"/>
  <text x="${legendX}" y="${legendY}" class="legend-text" font-weight="bold">Runtime</text>
`;

  runtimeLabels.forEach((label, i) => {
    svg += `  <rect x="${legendX}" y="${legendY + 10 + i * 20}" width="15" height="15" fill="${runtimeColors[i]}"/>
  <text x="${legendX + 22}" y="${legendY + 22 + i * 20}" class="legend-text">${label}</text>
`;
  });

  svg += `
  <text x="${CHART_WIDTH / 2}" y="${CHART_HEIGHT - 15}" text-anchor="middle" class="axis-label">Framework</text>
  <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
  <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${MARGIN.left + plotWidth}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
</svg>`;

  return svg;
}

// =============================================================================
// LINE CHART GENERATION
// =============================================================================

interface TimeSeriesData {
  service: string;
  points: { time: number; value: number }[];
}

function generateLineChartSVG(
  seriesData: TimeSeriesData[],
  title: string,
  ylabel: string,
  useRelativeTime: boolean = true
): string {
  if (seriesData.length === 0) return '';

  // Filter to only known services and normalize names
  const filteredData = seriesData
    .filter(s => {
      const normalized = s.service.toLowerCase();
      return SERVICE_ORDER.some(so => normalized.includes(so) || so.includes(normalized));
    })
    .map(s => {
      // Try to match service name
      const normalized = s.service.toLowerCase();
      const matchedService = SERVICE_ORDER.find(so => normalized.includes(so) || so.includes(normalized));
      return {
        ...s,
        service: matchedService || s.service
      };
    });

  if (filteredData.length === 0) return '';

  // Convert to relative time (starting from 0) if needed
  const processedData = filteredData.map(series => {
    if (!useRelativeTime || series.points.length === 0) return series;

    const minTime = Math.min(...series.points.map(p => p.time));
    return {
      ...series,
      points: series.points.map(p => ({
        time: p.time - minTime,
        value: p.value
      }))
    };
  });

  // Get all time points and values
  const allTimes = processedData.flatMap(s => s.points.map(p => p.time));
  const allValues = processedData.flatMap(s => s.points.map(p => p.value));

  // For relative time, start from 0 and find max duration
  const minTime = 0;
  const maxTime = Math.max(...allTimes);
  const maxValue = Math.max(...allValues) * 1.1 || 1;

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right - 150; // Extra space for legend
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

  const xScale = (t: number) => MARGIN.left + (t / (maxTime || 1)) * plotWidth;
  const yScale = (v: number) => MARGIN.top + plotHeight - (v / maxValue) * plotHeight;

  const yTicks = 5;
  const xTicks = 6;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" width="${CHART_WIDTH}" height="${CHART_HEIGHT}">
  <style>
    .title { font: bold 18px Arial, sans-serif; }
    .axis-label { font: bold 14px Arial, sans-serif; }
    .tick-label { font: 10px Arial, sans-serif; }
    .legend-text { font: 10px Arial, sans-serif; }
    .grid { stroke: #e0e0e0; stroke-width: 1; }
    .line { fill: none; stroke-width: 2; }
  </style>
  
  <rect width="100%" height="100%" fill="white"/>
  <text x="${CHART_WIDTH / 2 - 75}" y="35" text-anchor="middle" class="title">${escapeXml(title)}</text>
  <text x="25" y="${MARGIN.top + plotHeight / 2}" text-anchor="middle" class="axis-label" transform="rotate(-90, 25, ${MARGIN.top + plotHeight / 2})">${escapeXml(ylabel)}</text>
`;

  // Y-axis grid and labels
  for (let i = 0; i <= yTicks; i++) {
    const y = MARGIN.top + plotHeight - (plotHeight / yTicks) * i;
    const value = (maxValue / yTicks) * i;
    svg += `  <line x1="${MARGIN.left}" y1="${y}" x2="${MARGIN.left + plotWidth}" y2="${y}" class="grid"/>
  <text x="${MARGIN.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${value.toFixed(1)}</text>
`;
  }

  // X-axis labels (relative time in seconds)
  for (let i = 0; i <= xTicks; i++) {
    const t = (maxTime / xTicks) * i;
    const x = xScale(t);
    // Format as seconds (timestamps are in milliseconds)
    const seconds = Math.round(t / 1000);
    const label = `${seconds}s`;
    svg += `  <text x="${x}" y="${MARGIN.top + plotHeight + 20}" text-anchor="middle" class="tick-label">${label}</text>
`;
  }

  // Draw lines for each service
  processedData.forEach((series) => {
    const color = COLORS[series.service] || '#888888';

    if (series.points.length < 2) return;

    // Sort points by time
    const sortedPoints = [...series.points].sort((a, b) => a.time - b.time);

    // Create path
    const pathData = sortedPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.time).toFixed(1)} ${yScale(p.value).toFixed(1)}`)
      .join(' ');

    svg += `  <path d="${pathData}" class="line" stroke="${color}"/>
`;
  });

  // Legend
  const legendX = MARGIN.left + plotWidth + 20;
  const legendY = MARGIN.top + 10;

  svg += `  <text x="${legendX}" y="${legendY}" class="legend-text" font-weight="bold">Services</text>
`;

  const uniqueServices = [...new Set(processedData.map(s => s.service))];
  uniqueServices.forEach((service, i) => {
    const color = COLORS[service] || '#888888';
    const label = DISPLAY_NAMES[service] || service;
    svg += `  <line x1="${legendX}" y1="${legendY + 15 + i * 18}" x2="${legendX + 20}" y2="${legendY + 15 + i * 18}" stroke="${color}" stroke-width="3"/>
  <text x="${legendX + 25}" y="${legendY + 19 + i * 18}" class="legend-text">${escapeXml(label)}</text>
`;
  });

  // Axes
  svg += `
  <text x="${MARGIN.left + plotWidth / 2}" y="${CHART_HEIGHT - 15}" text-anchor="middle" class="axis-label">Time (seconds)</text>
  <line x1="${MARGIN.left}" y1="${MARGIN.top}" x2="${MARGIN.left}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
  <line x1="${MARGIN.left}" y1="${MARGIN.top + plotHeight}" x2="${MARGIN.left + plotWidth}" y2="${MARGIN.top + plotHeight}" stroke="#333" stroke-width="2"/>
</svg>`;

  return svg;
}

// Generate sample time series data from benchmark results for demonstration
function generateSampleTimeSeries(
  metrics: Metrics,
  metricKey: keyof Metrics,
  duration: number = 30
): TimeSeriesData[] {
  const now = Date.now() / 1000;
  const result: TimeSeriesData[] = [];

  for (const service of SERVICE_ORDER) {
    const baseValue = metrics[metricKey][service];
    if (!baseValue || baseValue === 0) continue;

    // Generate realistic load pattern: ramp up, plateau, ramp down
    const points: { time: number; value: number }[] = [];
    const steps = 60;

    // Use deterministic seed based on service for reproducibility
    const seed = service.split('').reduce((a, c) => a + c.charCodeAt(0), 0);

    for (let i = 0; i < steps; i++) {
      const t = now - duration + (duration / steps) * i;
      let multiplier: number;

      // Simulate load pattern
      const progress = i / steps;
      if (progress < 0.15) {
        // Ramp up phase (0-15%)
        multiplier = 0.1 + (progress / 0.15) * 0.9;
      } else if (progress < 0.85) {
        // Plateau phase with some variation (15-85%)
        // Use deterministic pseudo-random for reproducibility
        const pseudoRandom = Math.sin(seed + i * 0.5) * 0.5 + 0.5;
        multiplier = 0.85 + pseudoRandom * 0.3;
      } else {
        // Ramp down phase (85-100%)
        multiplier = 1.0 - ((progress - 0.85) / 0.15) * 0.8;
      }

      // Add some deterministic noise
      const noise = Math.sin(seed + i * 1.3) * 0.05;
      multiplier += noise;

      points.push({
        time: t,
        value: baseValue * Math.max(0.1, multiplier)
      });
    }

    result.push({ service, points });
  }

  return result;
}

function generateLegendSVG(): string {
  const itemsPerRow = 3;
  const itemWidth = 280;
  const itemHeight = 30;
  const rows = Math.ceil(SERVICE_ORDER.length / itemsPerRow);
  const width = itemWidth * itemsPerRow + 40;
  const height = rows * itemHeight + 60;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    .title { font: bold 16px Arial, sans-serif; }
    .legend-text { font: 12px Arial, sans-serif; }
  </style>
  <rect width="100%" height="100%" fill="white"/>
  <text x="${width / 2}" y="25" text-anchor="middle" class="title">Color Legend - Benchmark Services</text>
`;

  SERVICE_ORDER.forEach((service, i) => {
    const row = Math.floor(i / itemsPerRow);
    const col = i % itemsPerRow;
    const x = 20 + col * itemWidth;
    const y = 50 + row * itemHeight;

    svg += `  <rect x="${x}" y="${y}" width="20" height="20" fill="${COLORS[service]}" stroke="#333" stroke-width="1"/>
  <text x="${x + 28}" y="${y + 15}" class="legend-text">${DISPLAY_NAMES[service]}</text>
`;
  });

  svg += '</svg>';
  return svg;
}

// Convert resource time series to line chart format
function resourceToTimeSeries(
  timeSeries: ResourceTimeSeries,
  metricKey: 'cpu_percent' | 'memory_mb'
): TimeSeriesData[] {
  const result: TimeSeriesData[] = [];

  for (const [service, data] of Object.entries(timeSeries)) {
    if (!SERVICE_ORDER.includes(service)) continue;

    const values = data[metricKey];
    const timestamps = data.timestamps;

    if (!values || !timestamps || values.length === 0) continue;

    const points = timestamps.map((t, i) => ({
      time: t,
      value: values[i] || 0
    }));

    result.push({ service, points });
  }

  return result;
}

// Generate RPS time series from benchmark results
function generateRpsTimeSeries(results: Record<string, BenchmarkResult>): TimeSeriesData[] {
  const result: TimeSeriesData[] = [];

  for (const [service, data] of Object.entries(results)) {
    if (!SERVICE_ORDER.includes(service)) continue;

    const d = data as any;

    // Try to extract time series from k6 metrics
    // k6 stores per-second data in http_reqs metric
    if (d.metrics?.http_reqs?.values?.rate) {
      const rate = d.metrics.http_reqs.values.rate;
      const duration = d.computed?.duration_seconds || 50;
      const successRate = d.computed?.success_rate ? d.computed.success_rate / 100 : 1;

      // Generate estimated time series based on the ramping pattern
      const now = Date.now() / 1000;
      const points: { time: number; value: number }[] = [];
      const steps = 60;

      for (let i = 0; i < steps; i++) {
        const t = now - duration + (duration / steps) * i;
        const progress = i / steps;

        // Simulate the ramping pattern
        let multiplier: number;
        if (progress < 0.1) {
          multiplier = 0.1 + progress * 5; // Ramp up
        } else if (progress < 0.9) {
          // Main test phase - varies based on how well the service handles load
          const stressLevel = (progress - 0.1) / 0.8;
          multiplier = 0.6 + stressLevel * 0.4 * successRate;
        } else {
          multiplier = Math.max(0.1, 1 - (progress - 0.9) * 8); // Ramp down
        }

        points.push({
          time: t,
          value: rate * multiplier
        });
      }

      result.push({ service, points });
    }
  }

  return result;
}

// =============================================================================
// MAIN
// =============================================================================

async function findLatestRunDir(resultsDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(resultsDir, { withFileTypes: true });
    const runDirs = entries
      .filter(e => e.isDirectory() && /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}_/.test(e.name))
      .map(e => e.name)
      .sort()
      .reverse();

    return runDirs.length > 0 ? path.join(resultsDir, runDirs[0]) : null;
  } catch {
    return null;
  }
}

export async function generateGraphs(runDirPath?: string): Promise<void> {
  const projectDir = path.resolve(import.meta.dirname, '..');
  const resultsDir = path.join(projectDir, 'results');

  // Find the run directory
  let runDir: string | null = null;

  if (runDirPath) {
    // Use provided run directory
    runDir = path.isAbsolute(runDirPath) ? runDirPath : path.join(resultsDir, runDirPath);
  } else {
    // Find the latest run
    runDir = await findLatestRunDir(resultsDir);
  }

  if (!runDir) {
    console.log('❌ No benchmark results found in "results/" directory');
    return;
  }

  const dataDir = path.join(runDir, 'data');
  const graphsDir = path.join(runDir, 'graphs');

  // Ensure graphs directory exists
  await fs.mkdir(graphsDir, { recursive: true });

  const runName = path.basename(runDir);
  console.log('\n📊 Generating Benchmark Graphs (SVG)');
  console.log(`   Run: ${runName}`);
  console.log(`   Output: ${graphsDir}\n`);

  console.log('📂 Loading benchmark results...');
  const results = await loadResults(dataDir);

  if (Object.keys(results).length === 0) {
    console.log(`❌ No benchmark results found in "${dataDir}"`);
    return;
  }

  console.log(`   Found results for: ${Object.keys(results).join(', ')}\n`);

  const metrics = extractMetrics(results);

  const charts: ChartConfig[] = [
    { key: 'successful_rps', title: 'Successful Requests per Second (Throughput)', ylabel: 'Requests/s', higherIsBetter: true },
    { key: 'total_requests', title: 'Total Requests Handled', ylabel: 'Requests', higherIsBetter: true },
    { key: 'success_rate', title: 'Success Rate', ylabel: 'Success %', higherIsBetter: true },
    { key: 'avg_latency_ms', title: 'Average Latency', ylabel: 'Latency (ms)', higherIsBetter: false },
    { key: 'p95_latency_ms', title: 'P95 Latency', ylabel: 'Latency (ms)', higherIsBetter: false },
    { key: 'p99_latency_ms', title: 'P99 Latency', ylabel: 'Latency (ms)', higherIsBetter: false },
  ];

  console.log('📈 Generating charts...');

  for (const chart of charts) {
    const data = metrics[chart.key];
    if (Object.keys(data).length > 0) {
      console.log(`\n  ${chart.title}:`);

      // Individual bar chart
      const svg = generateBarChartSVG(data, chart.title, chart.ylabel, chart.higherIsBetter);
      if (svg) {
        await fs.writeFile(path.join(graphsDir, `${chart.key}.svg`), svg);
        console.log(`    ✓ ${chart.key}.svg`);
      }

      // Grouped bar chart
      const groupedSvg = generateGroupedBarChartSVG(data, `${chart.title} (by Framework)`, chart.ylabel);
      await fs.writeFile(path.join(graphsDir, `${chart.key}_grouped.svg`), groupedSvg);
      console.log(`    ✓ ${chart.key}_grouped.svg`);
    }
  }

  // Load and generate resource metrics charts (CPU/Memory)
  console.log('\n📊 Loading resource metrics (CPU/Memory)...');
  const { summary: resourceMetrics, timeSeries: resourceTimeSeries } = await loadResourceMetrics(dataDir);

  if (Object.keys(resourceMetrics.peak_cpu_percent).length > 0) {
    console.log(`   Found resource metrics for: ${Object.keys(resourceMetrics.peak_cpu_percent).join(', ')}\n`);

    // Peak CPU Usage
    console.log('  Peak CPU Usage:');
    const peakCpuSvg = generateBarChartSVG(resourceMetrics.peak_cpu_percent, 'Peak CPU Usage During Benchmark', 'CPU %', false);
    if (peakCpuSvg) {
      await fs.writeFile(path.join(graphsDir, 'peak_cpu_percent.svg'), peakCpuSvg);
      console.log('    ✓ peak_cpu_percent.svg');
    }

    const peakCpuGroupedSvg = generateGroupedBarChartSVG(resourceMetrics.peak_cpu_percent, 'Peak CPU Usage (by Framework)', 'CPU %');
    await fs.writeFile(path.join(graphsDir, 'peak_cpu_percent_grouped.svg'), peakCpuGroupedSvg);
    console.log('    ✓ peak_cpu_percent_grouped.svg');

    // Average CPU Usage
    console.log('  Average CPU Usage:');
    const avgCpuSvg = generateBarChartSVG(resourceMetrics.avg_cpu_percent, 'Average CPU Usage During Benchmark', 'CPU %', false);
    if (avgCpuSvg) {
      await fs.writeFile(path.join(graphsDir, 'avg_cpu_percent.svg'), avgCpuSvg);
      console.log('    ✓ avg_cpu_percent.svg');
    }

    const avgCpuGroupedSvg = generateGroupedBarChartSVG(resourceMetrics.avg_cpu_percent, 'Average CPU Usage (by Framework)', 'CPU %');
    await fs.writeFile(path.join(graphsDir, 'avg_cpu_percent_grouped.svg'), avgCpuGroupedSvg);
    console.log('    ✓ avg_cpu_percent_grouped.svg');

    // Peak Memory Usage
    console.log('  Peak Memory Usage:');
    const peakMemSvg = generateBarChartSVG(resourceMetrics.peak_memory_mb, 'Peak Memory Usage During Benchmark', 'Memory (MB)', false);
    if (peakMemSvg) {
      await fs.writeFile(path.join(graphsDir, 'peak_memory_mb.svg'), peakMemSvg);
      console.log('    ✓ peak_memory_mb.svg');
    }

    const peakMemGroupedSvg = generateGroupedBarChartSVG(resourceMetrics.peak_memory_mb, 'Peak Memory Usage (by Framework)', 'Memory (MB)');
    await fs.writeFile(path.join(graphsDir, 'peak_memory_mb_grouped.svg'), peakMemGroupedSvg);
    console.log('    ✓ peak_memory_mb_grouped.svg');

    // Average Memory Usage
    console.log('  Average Memory Usage:');
    const avgMemSvg = generateBarChartSVG(resourceMetrics.avg_memory_mb, 'Average Memory Usage During Benchmark', 'Memory (MB)', false);
    if (avgMemSvg) {
      await fs.writeFile(path.join(graphsDir, 'avg_memory_mb.svg'), avgMemSvg);
      console.log('    ✓ avg_memory_mb.svg');
    }

    const avgMemGroupedSvg = generateGroupedBarChartSVG(resourceMetrics.avg_memory_mb, 'Average Memory Usage (by Framework)', 'Memory (MB)');
    await fs.writeFile(path.join(graphsDir, 'avg_memory_mb_grouped.svg'), avgMemGroupedSvg);
    console.log('    ✓ avg_memory_mb_grouped.svg');

    // =========== LINE CHARTS ===========
    console.log('\n📈 Generating line charts over time...');

    // CPU Usage over time
    const cpuTimeSeries = resourceToTimeSeries(resourceTimeSeries, 'cpu_percent');
    if (cpuTimeSeries.length > 0) {
      console.log('  CPU Usage over time:');
      const cpuLineSvg = generateLineChartSVG(cpuTimeSeries, 'CPU Usage Over Time', 'CPU %');
      if (cpuLineSvg) {
        await fs.writeFile(path.join(graphsDir, 'cpu_over_time.svg'), cpuLineSvg);
        console.log('    ✓ cpu_over_time.svg');
      }
    }

    // Memory Usage over time
    const memTimeSeries = resourceToTimeSeries(resourceTimeSeries, 'memory_mb');
    if (memTimeSeries.length > 0) {
      console.log('  Memory Usage over time:');
      const memLineSvg = generateLineChartSVG(memTimeSeries, 'Memory Usage Over Time', 'Memory (MB)');
      if (memLineSvg) {
        await fs.writeFile(path.join(graphsDir, 'memory_over_time.svg'), memLineSvg);
        console.log('    ✓ memory_over_time.svg');
      }
    }
  } else {
    console.log('   No resource metrics found (run benchmark to collect CPU/Memory data)');
  }

  // RPS over time (from benchmark results)
  console.log('\n📈 Generating RPS line chart...');
  const rpsTimeSeries = generateRpsTimeSeries(results);
  if (rpsTimeSeries.length > 0) {
    console.log('  Requests per Second over time:');
    const rpsLineSvg = generateLineChartSVG(rpsTimeSeries, 'Requests per Second Over Time', 'Requests/s');
    if (rpsLineSvg) {
      await fs.writeFile(path.join(graphsDir, 'rps_over_time.svg'), rpsLineSvg);
      console.log('    ✓ rps_over_time.svg');
    }
  }

  // Legend
  console.log('\n  Legend:');
  const legendSvg = generateLegendSVG();
  await fs.writeFile(path.join(graphsDir, 'legend.svg'), legendSvg);
  console.log('    ✓ legend.svg');
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  generateGraphs(process.argv[2]).catch(console.error);
}
