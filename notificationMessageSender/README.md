# Notification Message Sender

Micro service based on NestJS + TypeScript that consumes notification messages from RabbitMQ and prepares the flow for sending them to a Whatsapp user or group.

## Behavior

- Consumes messages from queue `outgoing-notification-messages`.
- Processes one message at a time (`prefetch(1)`).
- After consuming a message, waits the configured time before processing the next one.
- Messages consumed from RabbitMQ are intended to be delivered to a Whatsapp user or group.

## Configuration

Required files:
- `environment.json`
- `secrets.json` (copy from `secrets-example.json`)

Relevant configuration:
- `notificaton.postMessageSentWaitInMs`: wait time in milliseconds after consuming each message (default `3600000`, i.e. 3600 seconds).

RabbitMQ credentials are read from `secrets.json`.

## Run

```bash
npm install
npm run build
npm run start
```
