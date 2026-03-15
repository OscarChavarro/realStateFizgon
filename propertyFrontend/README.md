# Property frontend

## Frontend project conventions

The `propertyFrontend` project uses a Java-like source/test separation by team convention:

- Source code lives in `propertyFrontend/src/main`.
- Unit tests live in `propertyFrontend/src/test`.
- Test folders mirror feature folders from `src/main/app` (for example: `core`, `auth`, `listing`, `property`, `maintenance`, `prefs`, `shell`).

Angular import/path conventions used by this project:

- Path alias `src/*` resolves to `src/main/*` (configured in `propertyFrontend/tsconfig.json`).
- Cross-cutting infrastructure belongs in `src/main/app/core` (`core/api`, `core/i18n`).
- Feature-specific code belongs in its feature folder and is split by `components`, `model`, and `services`.
