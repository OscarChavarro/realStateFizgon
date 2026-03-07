# Idealista Property Scraper

Service that runs an instrumented Chromium flow against Idealista, applies filters, paginates listings, visits property details, stores data in MongoDB, and publishes updates through RabbitMQ.

## Prerequisites

- Node.js 22.x
- MongoDB reachable from this service
- RabbitMQ reachable from this service
- Chromium/Chrome available in the configured path (or in the Docker image)

## Configuration Files

- `environment.json`: non-secret runtime config (timeouts, base URLs, browser options, filters, etc.).
- `secrets.json`: credentials and sensitive config (MongoDB, RabbitMQ, proxy, user agent, geolocation, etc.).
- `secrets-example.json`: template to create your local `secrets.json`.

Minimum setup:

```bash
cp secrets-example.json secrets.json
```

Then edit `secrets.json` with valid credentials for your environment.

## Package Structure

The codebase is intentionally split between **business scraping logic** and **technical/runtime concerns**:

- `src/application/services/scraper/`: business use cases for the Idealista scraper.
- `src/application/services/scraper/filters/`: business filtering behavior.
- `src/application/services/scraper/pagination/`: business pagination behavior.
- `src/application/services/scraper/property/`: property listing/detail business logic.
- `src/application/services/scraper/flows/`: high-level scrape/update business flows.

- `src/application/services/chromium/`: Chromium/CDP technical services.
- `src/application/services/bootstrap/`: technical startup preparation flows.
- `src/application/services/prechecks/`: technical infrastructure checks before startup.
- `src/application/services/resilience/`: technical resilience helpers (error detection/recovery support).

Facade/entry-point services are kept at the parent scraper package:

- `src/application/services/scraper/scraper-bootstrap.service.ts`: startup + bootstrap sequence.
- `src/application/services/scraper/scraper-orchestrator.service.ts`: runtime orchestration of scrape/update cycles.

## Build and Run

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run (compiled):

```bash
npm run start
```

Run (development):

```bash
npm run start:dev
```

## Linting

This project uses ESLint with TypeScript support (`eslint.config.mjs`).

Run lint checks:

```bash
npm run lint
```

Auto-fix lint issues when possible:

```bash
npm run lint:fix
```

Notes:

- Lint targets `src/**/*.ts`.
- Current setup fails on lint errors and allows warnings.

## Trigger Scraper Flows

The service exposes two HTTP endpoints (port comes from `environment.json.api.httpPort`, default `8080` in this project):

- `POST /scrapeProperties`: queue a full scrape cycle for new properties.
- `POST /updateProperties`: queue revalidation of existing open properties.

Examples:

```bash
curl -X POST http://localhost:8080/scrapeProperties
curl -X POST http://localhost:8080/updateProperties
```

## Runtime Outputs

- Browser/Xvfb logs: `output/logs/`
- Downloaded images: `output/images/`
- RabbitMQ fallback audit file: `output/audit/pending-property-urls.ndjson`

## Docker/Kubernetes

- Local container image: `Dockerfile.local`
- Kubernetes manifest: `k8s/idealistaPropertyScraper.yaml`
- Xvfb startup script: `start-with-xvfb.sh`

## Troubleshooting

- If service starts but stays waiting, check MongoDB/RabbitMQ credentials in `secrets.json`.
- If browser launch fails, inspect `output/logs/chrome_stderr.log` and `output/logs/chrome_stdout.log`.
- If the scraper cannot operate target pages correctly, validate `chrome.userAgent`, geolocation config, and allowlists in `secrets.json`.

## Related Docs

- [Anti-scraper detection measures](../doc/antiScraperDetectionMeasures.md)
