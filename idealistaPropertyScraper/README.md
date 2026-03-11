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

Scheduler setup:

- `environment.json.scheduler.reScrapeIntervalMs` controls automatic re-scrape while the state machine is idle.
- Behavior: when state is `IDLE` and that interval has elapsed since the last time the machine reached `IDLE`, `ScheduleService` promotes the state to `SCRAPING_FOR_NEW_PROPERTIES`.

## Package Structure

The codebase is intentionally split between **business scraping logic** and **technical/runtime concerns**:

- `src/main/application/services/scraper/`: business use cases for the Idealista scraper.
- `src/main/application/services/scraper/filters/`: business filtering behavior.
- `src/main/application/services/scraper/pagination/`: business pagination behavior.
- `src/main/application/services/scraper/property/`: property listing/detail business logic.
- `src/main/application/services/scraper/flows/`: high-level scrape/update business flows.

- `src/main/application/services/chromium/`: Chromium/CDP technical services.
- `src/main/application/services/bootstrap/`: technical startup preparation flows.
- `src/main/application/services/prechecks/`: technical infrastructure checks before startup.
- `src/main/application/services/resilience/`: technical resilience helpers (error detection/recovery support).

Facade/entry-point services are kept at the parent scraper package:

- `src/main/application/services/scraper/scraper-bootstrap.service.ts`: startup + bootstrap sequence.
- `src/main/application/services/scraper/scraper-orchestrator.service.ts`: runtime orchestration of scrape/update cycles.

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

- Lint targets `src/main/**/*.ts`.
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

## Recovery Runbook

This service includes automatic browser recovery when Chromium fails during runtime.

Failure handling behavior:

- Trigger conditions:
  - Chromium process exits unexpectedly and CDP is no longer reachable.
  - A fatal error bubbles up from the scraper state loop.
- Recovery actions:
  - Stop Chromium (`SIGTERM`), wait briefly, then force kill (`SIGKILL`) if still alive.
  - Wait a short recovery window before retrying (currently `10s` in bootstrap logic).
  - Relaunch Chromium with the same startup path used on boot.
  - Re-apply startup CDP readiness and geolocation startup permissions.
  - Set scraper state to `IDLE`.
- Post-recovery execution:
  - The scraper loop is restarted.
  - While state is `IDLE`, the scheduler can promote to `SCRAPING_FOR_NEW_PROPERTIES` after `environment.json.scheduler.reScrapeIntervalMs`.

Expected state timeline after failure:

1. Failure detected (`ChromiumFailureGuardService` logs an error).
2. Browser restart sequence is executed.
3. State machine is forced to `IDLE`.
4. Scheduler eventually triggers a new scrape cycle if the configured idle interval has elapsed.

How to diagnose:

- Inspect application logs for recovery milestones:
  - `Browser failure detected: ...`
  - `Browser will be restarted after waiting ... seconds.`
  - `Browser restart completed. Scraper state was set to IDLE.`
- Check Chromium logs:
  - `output/logs/chrome_stderr.log`
  - `output/logs/chrome_stdout.log`
- Validate scheduler behavior:
  - Confirm `environment.json.scheduler.reScrapeIntervalMs`.
  - Confirm state transitions include return to `IDLE` and later promotion to `SCRAPING_FOR_NEW_PROPERTIES`.
- In Kubernetes:
  - Verify pod logs around the failure timestamp.
  - Confirm the container remains alive and no crash loop is occurring.

## Troubleshooting

- If service starts but stays waiting, check MongoDB/RabbitMQ credentials in `secrets.json`.
- If browser launch fails, inspect `output/logs/chrome_stderr.log` and `output/logs/chrome_stdout.log`.
- If the scraper cannot operate target pages correctly, validate `chrome.userAgent`, geolocation config, and allowlists in `secrets.json`.

## Related Docs

- [Anti-scraper detection measures](../doc/antiScraperDetectionMeasures.md)
