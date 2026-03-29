# AGENTS Operational Contract

This contract defines how an LLM should maintain this repository.
Use it as the default engineering policy unless a task explicitly requires an exception.

## Project Overview

- This repository is a TypeScript monorepo with one frontend project, multiple backend projects, and shared internal packages.
- Backend projects are service-oriented and communicate through HTTP, WebSocket, queues, and shared persistence/storage systems.
- Frontend architecture is feature-oriented, with thin UI components and service-driven orchestration.
- Backend architecture targets hexagonal design (ports and adapters).
- Runtime configuration is file-based and split into non-secret settings and secret settings.
- Deployment supports local development and Kubernetes-based environments.

## Project Structure

- `propertyFrontend`: frontend application.
- `propertyBackend`: primary API backend for frontend consumption.
- `idealistaPropertyScraper`: ingestion/backend service.
- `pendingImageDownloader`: asynchronous worker backend.
- `notificationMessageSender`: asynchronous notification backend.
- `modules/captchaSolvers`: shared backend package.
- `modules/proxy`: shared backend package.
- `k8s`: shared infrastructure manifests for external systems and ingress.
- `doc`: project-level architecture and operations documentation.
- `scripts`: monorepo-level utility/build scripts.

## Architecture Rules

### Frontend Projects

- Organize code by feature, not by technical layer.
- Keep cross-cutting concerns centralized in a dedicated core area.
- Keep components focused on rendering and interaction wiring.
- Put business flow orchestration in dedicated use-case/coordinator services.
- Keep feature state explicit and reactive, with a single source of truth per concern.
- Route backend communication through a centralized transport policy layer.
- Keep mapping/parsing logic separate from UI logic.
- Keep internationalization typed and fail fast for missing keys.

### Backend Projects

- Treat hexagonal architecture as the default target architecture.
- Keep domain logic framework-agnostic and independent from transport and infrastructure details.
- Keep application logic in use-case/services that orchestrate domain objects through ports.
- Define ports as explicit contracts and inject implementations through dependency inversion.
- Keep inbound adapters focused on request/response translation and authorization, not business workflows.
- Keep outbound adapters focused on integration details and idempotent side effects.
- Keep configuration, process control, and technical utilities in infrastructure-only code.
- Enforce one-way dependency direction from adapters toward ports/application/domain, never the opposite.
- For legacy or transitional backends, move incrementally toward explicit ports and smaller use cases when touching existing code.

## Code Conventions

- Use TypeScript strict mode and preserve strict typing for new code.
- Prefer small, single-purpose classes and methods with explicit names.
- Use consistent suffix-based naming for technical roles such as controller, service, use case, module, port, token, model, and type.
- Prefer constructor injection or framework-native injection with readonly dependencies.
- Keep boundary payloads as explicit types and normalize/validate external input early.
- Keep mapping and normalization logic explicit and testable.
- Prefer deterministic behavior and explicit defaults over implicit fallthrough.
- Keep logs contextual, actionable, and free of secrets.
- Avoid coupling UI/domain behavior directly to transport payload shapes.

## Testing Guidelines

- Mirror production code organization in tests.
- Prioritize unit tests for use cases, services, mappers, value objects, and guards/policies.
- Mock ports and external adapters in unit tests.
- Cover success paths, validation failures, retries, fallback behavior, and idempotency scenarios.
- Keep test names behavior-oriented and explicit about expected outcomes.
- Maintain existing coverage thresholds where configured and do not lower them to pass changes.
- When modifying untested backend services, add focused tests around changed behavior before broad refactors.
- For frontend changes, add or update component/service specs for interaction logic, state transitions, and API fallback behavior.

## External Systems

- Browser automation runtime with remote control protocol support.
- Message broker for asynchronous communication.
- Document database for persistent records.
- Shared file storage for binary assets.
- Static asset serving layer.
- OAuth2 identity provider.
- Geospatial/maps provider.
- Real-time messaging gateway.
- Metrics and dashboard stack.
- Container and orchestration platform with ingress and persistent volumes.
- Optional forward proxy and private overlay networking for egress control.

## Security Rules

- Never commit `secrets.json` files. Commit only `secrets-example.json` templates.
- Keep all credentials in secret files or Kubernetes Secrets, never in source code.
- In `idealistaPropertyScraper`, keep operational HTTP endpoints protected by Basic Auth and preserve constant-time credential comparison.
- In `propertyBackend`, keep session cookies `httpOnly`; set `secure` to `true` outside local development.
- In `propertyBackend`, keep OAuth return URL origin checks to prevent open redirects.
- In `propertyBackend`, keep permission checks in user-management and maintenance endpoints.
- In `propertyFrontend`, keep backend requests credential-aware and routed only through approved backend URL logic.
- Avoid permissive CORS with credentials in production deployments.
- Keep VNC/debug access non-public; use temporary port-forwarding for diagnostics.
- Rotate default infrastructure credentials immediately for RabbitMQ, Grafana, and any bootstrap admin users.
- Keep Prometheus/Grafana protected with authentication in non-local environments.
- Preserve non-root container execution and mounted-secret read-only patterns in Kubernetes manifests.

## Preferred Patterns

- Explicit ports plus adapter implementations with dependency injection tokens.
- Use-case services exposing a single `execute`-style entry point for orchestration.
- Configuration objects with normalization, fallback defaults, and validation.
- Retry policies for transient failures with bounded delays and clear logging.
- Queue consumers with explicit ACK/NACK behavior and safe requeue decisions.
- Idempotent processing for repeated events/messages.
- Thin inbound layers delegating to application services.
- Dedicated payload mappers between transport models and internal models.
- Feature-level frontend services coordinating API, state, and UI commands.
- Reactive frontend state using explicit signals/selectors and deterministic updates.

## Anti-patterns

- Putting core business rules directly in controllers, gateways, or components.
- Direct coupling from application logic to concrete infrastructure clients without ports.
- Cross-layer imports that break dependency direction.
- Silent fallback behavior without logging or tests.
- Hardcoded credentials, hostnames, or operational secrets in code.
- Large "god services" that mix orchestration, validation, transport mapping, and persistence in one class.
- Adding new integration behavior without retry/error classification strategy.
- Shipping changes that bypass existing test suites or reduce configured coverage discipline.
- Relying on stale automation scripts without verifying they match current package scripts.
