# bot-discord

HTTP service that sends Discord notifications as embeds via webhooks. The webhook URL is resolved per channel via the DB-gateway (Twitch channel id → Discord channel webhook).

## Stack

- **Node.js** + **TypeScript**
- **Express** (REST API)
- **Winston** (logging)

## Prerequisites

- Node.js (version supported by the project)
- Access to the DB Gateway (channels API with `discordWebhookUrl`)

## Installation

```bash
npm install
cp .env.example .env
# Edit .env for your environment
```

## Environment variables

| Variable              | Description                          | Default                                     |
| --------------------- | ------------------------------------ | ------------------------------------------- |
| PORT                  | Server port                          | 3000                                        |
| NODE_ENV              | development / integration / production / test | development                         |
| DB_GATEWAY_BASE_URL   | DB Gateway base URL (channels API)   | http://localhost:3000                       |
| ALLOWED_ORIGINS       | CORS origins (comma-separated)       | http://localhost:3000,http://localhost:8080 |

## Scripts

| Command            | Description                        |
| ------------------ | ---------------------------------- |
| npm run dev        | Start the server in dev (ts-node)   |
| npm run build      | Compile TypeScript                  |
| npm start          | Start the server (after build)      |
| npm test           | Run tests and coverage              |
| npm run test:coverage | Run tests with detailed coverage |
| npm run test:watch | Run tests in watch mode             |
| npm run test:ci    | Run tests in CI mode                |
| npm run prettier   | Format code with Prettier           |

---

# API (Swagger-style)

Base URL: `http://localhost:3000` (or your deployment URL).

## Health

### GET /health

Service health check.

**Responses**

- **200 OK**

```json
{
  "status": "healthy",
  "timestamp": "2025-03-15T12:00:00.000Z",
  "environment": "development"
}
```

---

## Notifications

### POST /notify

Send a Discord notification as an embed to the webhook configured for the given channel. The channel is looked up via the DB-gateway; its `discordWebhookUrl` is used to post to Discord.

**Request**

- **Content-Type:** `application/json`
- **Body:** JSON object

| Field      | Type   | Required | Description                    |
| ---------- | ------ | -------- | ------------------------------ |
| channelId  | string | yes      | Channel ID (e.g. Twitch channel id) |
| title      | string | no       | Embed title                    |
| text       | string | yes      | Embed description content      |

**Example body**

```json
{
  "channelId": "ch1",
  "title": "Notification",
  "text": "Hello, this is the message body."
}
```

**Responses**

- **200 OK** – Notification sent successfully

```json
{
  "success": true
}
```

- **400 Bad Request** – Missing required field

```json
{
  "error": "channelId required"
}
```

```json
{
  "error": "text required"
}
```

- **404 Not Found** – Channel not found or channel has no Discord webhook configured

```json
{
  "error": "Channel not found"
}
```

```json
{
  "error": "Channel has no Discord webhook configured"
}
```

- **502 Bad Gateway** – Failed to send notification (e.g. Discord API error)

```json
{
  "error": "Failed to send notification"
}
```

---

## Generic errors

- **404 Not Found** – Route or resource does not exist (default Express response for undefined routes).
