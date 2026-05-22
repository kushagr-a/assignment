# Rate Limiter API — Rolling Window

In-memory rate limiting API built with **Express 5** and **TypeScript**. Enforces **5 requests per user per 60-second sliding window**.

---

## How It Works

The rolling window algorithm stores exact timestamps of each request per user. On every incoming request, timestamps older than 60 seconds are discarded and the remaining count is checked against the limit.

This avoids the burst loophole of Fixed Window (where a user can double their quota at interval boundaries) — no background timers, no external dependencies.

```
Timeline:   0s ── 30s ── 60s ── 90s
Requests:   R1 R2 R3 R4 R5      R6 ✓
                                ↑
                    At 61s, R1 expires → R6 is now allowed
```

---

## Stack

| | |
|---|---|
| Runtime | Node.js >= 20.x |
| Language | TypeScript (strict mode) |
| Framework | Express 5 |
| Package Manager | pnpm >= 11.x |

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server (hot-reload)
pnpm dev

# Build for production
pnpm build && pnpm start
```

**Environment** — create a `.env` file in the project root:

```env
PORT=3000
```

Defaults to `3030` if not set.

---

## API Reference

### `GET /`
Health check.

```json
{
  "success": true,
  "message": "Hello World",
  "time": "2026-05-19T17:00:00.000Z"
}
```

---

### `POST /api/request`
Submit a rate-limited request.

**Request body:**
```json
{
  "user_id": "user_123",
  "payload": { "action": "anything" }
}
```

| Status | When | Response |
|---|---|---|
| `201 Created` | Request accepted | `{ "success": true, "message": "Request accepted" }` |
| `400 Bad Request` | `user_id` missing, not a string, or `payload` absent | `{ "success": false, "message": "Invalid request body" }` |
| `429 Too Many Requests` | Exceeded 5 requests in the last 60s | `{ "success": false, "message": "Rate limit exceeded. Max 5 requests per minute allowed." }` |

---

### `GET /api/stats`
Per-user request statistics.

```json
{
  "success": true,
  "data": [
    {
      "user_id": "user_123",
      "accepted_requests": 5,
      "rejected_requests": 2,
      "current_window_requests": 5
    }
  ]
}
```

`accepted_requests` reflects the current rolling window count, not a lifetime total. `rejected_requests` is cumulative since server start.

---

## Quick Test

```bash
# Run 6 requests — 6th should be rejected
for i in $(seq 1 6); do
  curl -s -X POST http://localhost:3000/api/request \
    -H "Content-Type: application/json" \
    -d '{"user_id": "test_user", "payload": "data"}'
  echo
done
```

---

## Key Design Decisions

**In-memory `Map` store** — persistence is unnecessary for a rate limiter; data beyond the current window is irrelevant. Swap `memory.store.ts` for Redis if multi-instance deployment is needed.

**Service/store separation** — rate-limit logic and data storage are decoupled. The store can be replaced without touching business logic.

**`payload` typed as `unknown`** — safer than `any`; forces explicit type narrowing before use.

**`Object.freeze` on config** — prevents accidental mutation of environment values at runtime.

---

> All data resets on server restart. For production multi-instance deployments, replace the in-memory store with a shared Redis instance.