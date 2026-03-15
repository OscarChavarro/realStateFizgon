# Property frontend

## Frontend use cases

This section describes the product-facing flows that an end user can perform in the UI.

- Browse property inventory: open the **Property list** tab, review the paginated table, and inspect title, publication date, price, and availability state.
- Sort and prioritize results: sort by title, publication date, and price (multi-sort order is supported) to quickly compare options.
- Apply discovery filters: use the Filters dropdown to refine results by closed/open status, review states (new/favourite/rejected), publication date range, and price range.
- Explore properties on map: switch to the **Map** tab, browse geolocated markers, and open the mini popup with image carousel, price, area, bedrooms, and direct **Idealista** link.
- Inspect full property detail: select a row to open the detail panel with metadata, source link, local image gallery, full description, and location dialog.
- Use keyboard productivity shortcuts: navigate rows with `ArrowUp`/`ArrowDown`, toggle review with `Space`, open/close map location with `M`, and toggle fullscreen with `F`.
- Review candidate properties: when authenticated, classify each property as **New**, **Favourite**, or **Rejected** from both table and detail panel.
- Add personal notes: write a comment per property in the detail panel to keep personal evaluation context during house hunting.
- Personalize by language and workspace: switch EN/SP language, cycle workspace layouts, resize split panels, and use fullscreen mode.
- Authenticate and manage session: sign in with Google, see identity details in the user menu, and log out.
- Manage users (permission-based): users with `canEditUsers` can access the **Users** tab and remove users (except the current session user).
- Run maintenance operations (permission-based): users with `canMaintainDatabase` can access the **Database** tab and execute backend maintenance actions.

## Frontend project conventions

The `propertyFrontend` project uses a Java-like source/test separation by team convention:

- Source code lives in `propertyFrontend/src/main`.
- Unit tests live in `propertyFrontend/src/test`.
- Test folders mirror feature folders from `src/main/app` (for example: `core`, `auth`, `listing`, `property`, `maintenance`, `prefs`, `shell`).

Angular import/path conventions used by this project:

- Path alias `src/*` resolves to `src/main/*` (configured in `propertyFrontend/tsconfig.json`).
- Cross-cutting infrastructure belongs in `src/main/app/core` (`core/api`, `core/i18n`).
- Feature-specific code belongs in its feature folder and is split by `components`, `model`, and `services`.
