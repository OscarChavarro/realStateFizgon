# Property Detail Scraper

This micro service consumes property URLs from RabbitMQ queue `property-listing-urls` in vhost `dev`.
For each URL, it opens the page in Chrome (via CDP) and waits 5 seconds before consuming the next one.

## Build and Run

```bash
npm install
npm run build
npm run start
```

## Setup

1. Copy `secrets-example.json` to `secrets.json`.
2. Fill in RabbitMQ credentials.
