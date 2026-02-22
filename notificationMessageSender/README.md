# Notification Message Sender

Micro service based on NestJS + TypeScript that consumes notification messages from RabbitMQ and prepares the flow for sending them to a Whatsapp user or group.

## Behavior

- Consumes messages from queue `outgoing-notification-messages`.
- Processes one message at a time (`prefetch(1)`).
- After consuming a message, waits the configured time before processing the next one.
- At startup, initializes WhatsApp via `@whiskeysockets/baileys`; if the session is not linked yet, a QR is printed in terminal.
- Messages consumed from RabbitMQ are delivered to a configured Whatsapp user or group.

## Configuration

Required files:
- `environment.json`
- `secrets.json` (copy from `secrets-example.json`)

Relevant configuration:
- `metrics.httpPort`: HTTP port used to expose observability endpoints (default `9464`).
- `notificaton.postMessageSentWaitInMs`: wait time in milliseconds after consuming each message (default `3600000`, i.e. 3600 seconds).
- `whiskeysocketswhatsapp.authFolderPath`: local folder to persist WhatsApp auth session.
- `whiskeysocketswhatsapp.printQrInTerminal`: print QR in terminal when linking is needed.
- `whiskeysocketswhatsapp.markOnlineOnConnect`: Baileys online presence behavior.
- `whiskeysocketswhatsapp.connectTimeoutMs`: timeout for WhatsApp connection on startup.

Credentials and destination data are read from `secrets.json`:
- `whiskeysocketswhatsapp.phoneNumber`: destination phone number (used to derive `@s.whatsapp.net` JID).
- `whiskeysocketswhatsapp.destinationJid`: optional explicit destination JID (`...@s.whatsapp.net` or `...@g.us`). If set, it overrides `phoneNumber`.

## Observability endpoints

- `GET /health`: basic liveness endpoint.
- `GET /metrics`: Prometheus exposition endpoint.
  - Implemented with `prom-client`.
  - Exposed metric: `notification_message_sender_whatsapp_messages_sent_success_total`.
  - This counter is incremented after every successful WhatsApp send operation.
  - Also includes default Node.js process metrics (`prom-client` default collectors).

Example local scrape:

```bash
curl http://localhost:9464/metrics
```

## Run

```bash
npm install
npm run build
npm run start
```
