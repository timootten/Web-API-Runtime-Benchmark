# Web API Runtime Benchmark

Performance- und Ressourcenvergleich containerisierter Web-API-Stacks: **Express**, **Hono** und **Elysia** auf **Node.js**, **Bun** und **Deno** in Docker.

## Forschungsfrage

> Wie unterscheiden sich Latenz (p95/p99), Durchsatz (RPS) und Ressourcenverbrauch (CPU/RAM) von Express, Hono und Elysia bei der Ausführung auf Node.js, Bun und Deno in einer standardisierten Docker-Testumgebung unter identischer Last?

## Voraussetzungen

- Docker & Docker Compose
- Node.js >= 20.x
- k6 (wird als Docker Container ausgeführt)

## Installation

```bash
npm install
```

## Benchmark ausführen

### Testprofile

| Profile    | Dauer (ca.) | Beschreibung                      |
| ---------- | ----------- | --------------------------------- |
| `quick`    | ~10 min     | Schneller Test für Entwicklung    |
| `standard` | ~20 min     | Empfohlen für finale Messungen    |
| `full`     | ~40 min     | Maximale statistische Genauigkeit |

### Tests starten

```bash
# Quick Test (~10 Minuten)
npm run test:quick

# Standard Test (~20 Minuten) - Empfohlen
npm run test:standard

# Full Test (~40 Minuten)
npm run test:full
```

### Report generieren

Nach Abschluss der Tests:

```bash
npm run report
```

Dies erzeugt in `./results/`:

- `report_TIMESTAMP.html` - Interaktiver HTML Report mit Grafiken
- `report_TIMESTAMP.csv` - CSV für weitere Analyse
- `report_TIMESTAMP.json` - Strukturierte JSON-Daten

## Monitoring

Während der Tests ist Grafana verfügbar unter:

- **Grafana**: http://localhost:3001 (Credentials: admin/admin)
- **Prometheus**: http://localhost:9090

Das vorkonfigurierte Dashboard zeigt:

- CPU-Auslastung pro Container
- RAM-Verbrauch
- Network I/O

## Projektstruktur

```
.
├── apis/                     # API Implementierungen
│   ├── express-node/         # Express auf Node.js
│   ├── express-bun/          # Express auf Bun
│   ├── express-deno/         # Express auf Deno
│   ├── hono-node/            # Hono auf Node.js
│   ├── hono-bun/             # Hono auf Bun
│   ├── hono-deno/            # Hono auf Deno
│   ├── elysia-node/          # Elysia auf Node.js
│   ├── elysia-bun/           # Elysia auf Bun
│   └── elysia-deno/          # Elysia auf Deno
├── k6/                       # k6 Lasttest Scripts
│   ├── benchmark.js          # Haupt-Benchmark
│   └── warmup.js             # Warmup Script
├── monitoring/               # Prometheus & Grafana Config
│   ├── prometheus.yml
│   └── grafana/
│       ├── dashboards/
│       └── provisioning/
├── results/                  # Benchmark Ergebnisse (JSON, CSV, HTML)
├── scripts/                  # Orchestrierungs-Scripts
│   ├── run-benchmarks.ts     # Test Runner
│   └── generate-report.ts    # Report Generator
└── docker-compose.yml        # Docker Compose Konfiguration
```

## API Endpunkte

Alle APIs implementieren identische Endpunkte:

| Endpunkt     | Methode | Beschreibung          |
| ------------ | ------- | --------------------- |
| `/health`    | GET     | Health Check (JSON)   |
| `/users/:id` | GET     | User abrufen (SQLite) |
| `/users`     | GET     | Alle User abrufen     |
| `/users`     | POST    | User erstellen        |

## Testmethodik

1. **Warmup**: 5s mit 10 VUs zum Aufwärmen der JIT-Compiler
2. **Ramp-up**: Schrittweise Erhöhung der Last
3. **Messung**: Stabiles Lastplateau für verlässliche Metriken
4. **Cooldown**: 10-15s Pause zwischen Tests

### Gemessene Metriken

- **Latenz**: avg, min, max, p90, p95, p99
- **Durchsatz**: Requests per Second (RPS)
- **Fehlerrate**: Prozent fehlgeschlagener Requests
- **Ressourcen**: CPU-%, RAM (via cAdvisor/Prometheus)

## Container Limits

Alle API-Container laufen mit identischen Ressourcenlimits:

- **CPU**: 1 Core
- **RAM**: 512 MB

## Aufräumen

```bash
# Container und Volumes entfernen
npm run docker:down

# Ergebnisse löschen
npm run clean
```

## Lizenz

MIT
