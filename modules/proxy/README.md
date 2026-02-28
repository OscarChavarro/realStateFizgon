# @real-state-fizgon/proxy

Shared proxy connectivity validation module for the scrapers.

## Layout

- Source code: `src/`
- Build output: `dist/`

## Build

From `modules/proxy`:

```bash
npm install
npm run build
```

If you saw `sh: tsc: command not found`, it means dependencies were not installed yet in this module. Run `npm install` again inside `modules/proxy`.

## Consumption from scrapers

Scrapers consume this module as a local dependency:

```json
"@real-state-fizgon/proxy": "file:../modules/proxy"
```

After rebuilding this module, reinstall dependencies in each scraper so they pick up the updated `dist`:

```bash
cd propertyListingIdealistaScraper && npm install
cd ../propertyDetailIdealistaScraper && npm install
```
