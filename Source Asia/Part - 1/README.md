# 🚦 Rate Limiter API — Rolling Window Implementation

A production-grade, in-memory **Rate Limiting API** built with **Express 5**, **TypeScript**, and a **Rolling Window** algorithm. The service enforces a maximum of **5 requests per user per 60-second sliding window** and exposes analytics via a stats endpoint.

---

## 📑 Table of Contents

- [Why Rolling Window?](#-why-rolling-window-over-other-algorithms)
- [Project Architecture](#-project-architecture)
- [File-by-File Breakdown](#-file-by-file-breakdown)
- [Type Definitions](#-type-definitions--typestypesrequestts)
- [API Endpoints & Status Codes](#-api-endpoints--status-codes)
- [How to Run](#-how-to-run)
- [Environment Variables](#-environment-variables)
- [Testing with cURL](#-testing-with-curl)
- [Design Decisions](#-design-decisions)
- [Tech Stack](#-tech-stack)

---

## 🧠 Why Rolling Window Over Other Algorithms?

There are three commonly used rate-limiting strategies. Here's why the **Rolling (Sliding) Window** was chosen:

| Algorithm | How It Works | Drawback |
|---|---|---|
| **Fixed Window** | Divides time into fixed intervals (e.g., 12:00–12:01). Resets counter at each boundary. | **Burst problem**: A user can send 5 requests at 12:00:59 and 5 more at 12:01:00, effectively getting 10 requests in 2 seconds. |
| **Token Bucket** | Tokens are added at a steady rate; each request consumes one. | More complex, requires background refill logic, harder to audit per-user. |
| **Rolling (Sliding) Window** ✅ | Keeps exact timestamps of each request. On every new request, timestamps older than 60 seconds are discarded, and the remaining count is checked against the limit. | Slightly more memory per user (stores timestamp array instead of a single counter). |

### Why Rolling Window Was Chosen

1. **No burst loophole** — Unlike Fixed Window, there is no boundary where a user can double their quota. The window slides with every request.
2. **Fairness** — Every user always gets exactly 5 requests in any 60-second span, no matter when the requests arrive.
3. **Simplicity** — No background timers or token refill loops. The cleanup happens inline during each `isAllowed()` call.
4. **Auditability** — Because we store each timestamp, the `/api/stats` endpoint can report exactly how many requests are currently in the window.

### Visual Example

```
Timeline (seconds):  0s -------- 30s -------- 60s -------- 90s
User sends:          R1  R2  R3  R4  R5         R6(allowed!)
                     ↑                          ↑
                     └── These 5 are in window ──┘ At 61s, R1 expires → room for R6

Fixed Window would have reset at 60s boundary, potentially allowing 10 total.
Rolling Window correctly counts only timestamps within the last 60 seconds.
```

---

## 🏗 Project Architecture

```
Part - 1/
├── .env                          # Environment variables (PORT)
├── package.json                  # Project metadata, scripts & dependencies
├── pnpm-lock.yaml                # Deterministic dependency lock file
├── pnpm-workspace.yaml           # PNPM workspace configuration
├── tsconfig.json                 # TypeScript compiler options
├── build/                        # Compiled JS output (generated via `pnpm build`)
└── src/
    ├── app.ts                    # Application entry point — server bootstrap
    ├── config/
    │   └── config.ts             # Centralized environment configuration
    ├── types/
    │   └── types.request.ts      # TypeScript interfaces & type aliases
    ├── store/
    │   └── memory.store.ts       # In-memory Map store (singleton)
    ├── services/
    │   └── rateLimit.service.ts  # Core rolling window rate-limit logic
    ├── controller/
    │   └── request.controller.ts # Request handlers (business + response logic)
    └── routes/
        └── request.routes.ts     # Route definitions & HTTP method mapping
```

### Data Flow

```
Client Request
      │
      ▼
  app.ts (Express server)
      │
      ▼
  request.routes.ts (route matching)
      │
      ▼
  request.controller.ts (validation + response)
      │
      ▼
  rateLimit.service.ts (rolling window check)
      │
      ▼
  memory.store.ts (in-memory Map<userId, stats>)
```

---

## 📂 File-by-File Breakdown

### 1. `src/app.ts` — Application Entry Point

```typescript
import express from "express";
import { config } from "./config/config";
import apiRoutes from "./routes/request.routes";

const app = express();

// Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Hello World",
    time: new Date().toISOString()
  });
});

app.use("/api", apiRoutes);
```

**What it does:**

| Aspect | Detail |
|---|---|
| **Express instance** | Creates and configures the Express 5 application. |
| **Body parsing** | `express.json({ limit: "10kb" })` — Parses JSON request bodies and caps payload size at 10KB to prevent abuse. |
| **URL encoding** | `express.urlencoded({ extended: true, limit: "10kb" })` — Parses URL-encoded form data with nested object support. |
| **Health check** | `GET /health` returns `200` with a success message and server timestamp. Useful for uptime monitoring. |
| **Route mounting** | All API routes are mounted under the `/api` prefix. |
| **Server start** | `startServer()` is an async function with error handling for port conflicts (`EADDRINUSE`) and general startup failures. |
| **Graceful error handling** | Listens on the `error` event of the HTTP server. If the port is already in use, it logs a specific message and exits with code `1`. |

---

### 2. `src/config/config.ts` — Environment Configuration

```typescript
import dotenv from 'dotenv';
dotenv.config();

export const config = Object.freeze({
  port: Number(process.env.PORT) || 3030,
});
```

**What it does:**

| Aspect | Detail |
|---|---|
| **dotenv** | Loads variables from the `.env` file into `process.env`. |
| **Object.freeze** | The config object is frozen — it cannot be modified at runtime, preventing accidental mutation of configuration values. This is a safety measure. |
| **Fallback** | If `PORT` is not defined in `.env`, defaults to `3030`. The `.env` file currently sets `PORT=3000`. |
| **Type coercion** | `Number(process.env.PORT)` explicitly converts the string env var to a number. |

---

### 3. `src/types/types.request.ts` — Type Definitions

```typescript
export interface IUserRequest {
  user_id: string;
  payload: unknown;
}

export interface IUserStats {
  acceptedRequests: number;
  rejectedRequests: number;
  requestTimestamps: number[];
}

export type RateLimitStore = Map<string, IUserStats>;
```

**What each type does:**

| Type | Purpose |
|---|---|
| `IUserRequest` | Shape of the incoming POST request body. `user_id` is the string identifier; `payload` is typed as `unknown` (safest possible type — forces explicit type checking before use). |
| `IUserStats` | Per-user statistics stored in memory. `acceptedRequests` tracks successful count, `rejectedRequests` tracks blocked count, and `requestTimestamps` is the array of Unix-millisecond timestamps used by the rolling window. |
| `RateLimitStore` | A type alias for `Map<string, IUserStats>` — maps each user ID to their stats object. Using a `Map` (instead of a plain object) provides O(1) lookups, built-in `.entries()` iteration, and avoids prototype pollution risks. |

---

### 4. `src/store/memory.store.ts` — In-Memory Data Store

```typescript
import { RateLimitStore } from "../types/types.request";

export const rateLimitStore: RateLimitStore = new Map();
```

**What it does:**

| Aspect | Detail |
|---|---|
| **Singleton Map** | A single `Map` instance exported as a module-level constant. Since ES modules are cached after first import, every file that imports `rateLimitStore` gets the **same** Map instance — this is the singleton pattern. |
| **No database** | The store is entirely in-memory. Data resets on server restart. This is intentional for a rate limiter — historical data isn't needed beyond the current window. |
| **Why a separate file?** | Separating the store from the service allows: (a) swapping to Redis/DB later without touching business logic, (b) sharing the same store across multiple services if needed, (c) cleaner unit testing with mock stores. |

---

### 5. `src/services/rateLimit.service.ts` — Rolling Window Rate Limiter (Core Logic)

```typescript
export class RateLimitService {
  private store: RateLimitStore;
  private maxRequests: number;
  private readonly WINDOW_SIZE = 60 * 1000; // 1 minute in ms

  constructor(maxRequests: number) {
    this.store = rateLimitStore;
    this.maxRequests = maxRequests;
  }

  isAllowed(userId: string): boolean {
    const currentTime = Date.now();

    const userStats = this.store.get(userId) || {
      acceptedRequests: 0,
      rejectedRequests: 0,
      requestTimestamps: []
    };

    // Remove old timestamps outside rolling window
    userStats.requestTimestamps = userStats.requestTimestamps.filter(
      (timestamp) => currentTime - timestamp < this.WINDOW_SIZE
    );

    // Check limit
    if (userStats.requestTimestamps.length < this.maxRequests) {
      userStats.requestTimestamps.push(currentTime);
      userStats.acceptedRequests = userStats.requestTimestamps.length;
      this.store.set(userId, userStats);
      return true;
    }

    // Rejected
    userStats.rejectedRequests += 1;
    this.store.set(userId, userStats);
    return false;
  }
}
```

**Step-by-step algorithm:**

| Step | What Happens | Why |
|---|---|---|
| 1 | Capture `Date.now()` (current Unix time in ms). | All timestamp comparisons use this single snapshot for consistency. |
| 2 | Fetch user's stats from the Map, or create a fresh stats object if this is a new user. | Handles first-time users gracefully without requiring pre-registration. |
| 3 | **Filter** the `requestTimestamps` array — keep only timestamps where `currentTime - timestamp < 60000`. | This is the **rolling window cleanup**. Any request older than 60 seconds is discarded. |
| 4 | Check if filtered array length is less than `maxRequests` (5). | If there's room in the window, the request is allowed. |
| 5a | **If allowed**: push current timestamp, update `acceptedRequests`, save to store, return `true`. | The timestamp is recorded so future calls can check against it. |
| 5b | **If rejected**: increment `rejectedRequests`, save to store, return `false`. | We don't add the timestamp for rejected requests — they don't count toward the window. |

**Key design note — `acceptedRequests` counter:**
The `acceptedRequests` field is set to `requestTimestamps.length` (not incremented). This means it reflects the **current** number of active requests in the window, not a lifetime total. This is intentional — it shows the real-time load for that user.

---

### 6. `src/controller/request.controller.ts` — Request Handlers

```typescript
const rateLimitService = new RateLimitService(5);
```

The service is instantiated with a limit of **5 requests per rolling window (60 seconds)**.

#### `createRequest` Handler

| Step | Logic |
|---|---|
| **Extract body** | Destructures `user_id` and `payload` from `req.body`. |
| **Validate** | Checks: `user_id` must exist, must be a string, and `payload` must not be `undefined`. If validation fails → `400 Bad Request`. |
| **Rate limit check** | Calls `rateLimitService.isAllowed(user_id)`. If `false` → `429 Too Many Requests`. |
| **Success** | If allowed → `201 Created`. |

#### `getStats` Handler

| Step | Logic |
|---|---|
| **Iterate store** | Converts the `rateLimitStore` Map to an array using `Array.from(...entries())`. |
| **Map data** | For each entry, outputs `user_id`, `accepted_requests`, `rejected_requests`, and `current_window_requests` (length of the timestamps array — how many requests are currently in the window). |
| **Response** | Returns `200 OK` with the stats array. |

---

### 7. `src/routes/request.routes.ts` — Route Definitions

```typescript
import { Router } from "express";
import { createRequest, getStats } from "../controller/request.controller";

const rateLimitRouter = Router();

rateLimitRouter.route("/request").post(createRequest);
rateLimitRouter.route("/stats").get(getStats);

export default rateLimitRouter;
```

**What it does:**

| Route | Method | Handler | Description |
|---|---|---|---|
| `/api/request` | `POST` | `createRequest` | Submit a new request (rate-limited) |
| `/api/stats` | `GET` | `getStats` | View per-user rate limit statistics |

---

## 📡 API Endpoints & Status Codes

### `GET /` — Health Check

**Request:**
```bash
GET http://localhost:3000/
```

**Response — `200 OK`:**
```json
{
  "success": true,
  "message": "Hello World",
  "time": "2026-05-19T17:00:00.000Z"
}
```

---

### `POST /api/request` — Submit a Rate-Limited Request

**Request:**
```bash
POST http://localhost:3000/api/request
Content-Type: application/json

{
  "user_id": "user_123",
  "payload": { "action": "process_data" }
}
```

#### All Possible Response Cases:

**✅ Case 1 — `201 Created` (Request Accepted)**

Returned when the user has **not exceeded** the 5-request limit in the current 60-second window.

```json
{
  "success": true,
  "message": "Request accepted"
}
```

**❌ Case 2 — `400 Bad Request` (Validation Failed)**

Returned when the request body is invalid. Triggers when:
- `user_id` is missing
- `user_id` is not a string (e.g., a number or boolean)
- `payload` is `undefined` (key missing entirely)

```json
{
  "success": false,
  "message": "Invalid request body"
}
```

**Examples of invalid bodies:**

```json
// Missing user_id entirely
{ "payload": "data" }

// user_id is a number, not string
{ "user_id": 123, "payload": "data" }

// Missing payload key
{ "user_id": "user_123" }

// Empty body
{}
```

**🚫 Case 3 — `429 Too Many Requests` (Rate Limit Exceeded)**

Returned when the user has already made **5 requests within the last 60 seconds**.

```json
{
  "success": false,
  "message": "Rate limit exceeded. Max 5 requests per minute allowed."
}
```

---

### `GET /api/stats` — View Rate Limit Statistics

**Request:**
```bash
GET http://localhost:3000/api/stats
```

**Response — `200 OK`:**

```json
{
  "success": true,
  "data": [
    {
      "user_id": "user_123",
      "accepted_requests": 5,
      "rejected_requests": 2,
      "current_window_requests": 5
    },
    {
      "user_id": "user_456",
      "accepted_requests": 3,
      "rejected_requests": 0,
      "current_window_requests": 3
    }
  ]
}
```

**Response fields explained:**

| Field | Type | Meaning |
|---|---|---|
| `user_id` | `string` | The unique identifier for the user. |
| `accepted_requests` | `number` | Number of accepted requests **currently in the rolling window** (not lifetime total). |
| `rejected_requests` | `number` | Total number of requests rejected due to rate limiting (cumulative since server start). |
| `current_window_requests` | `number` | How many request timestamps are active in the current 60s window (same as `accepted_requests`). |

**Edge case — empty stats:**
If no requests have been made yet:

```json
{
  "success": true,
  "data": []
}
```

---

## 🏃 How to Run

### Prerequisites

- **Node.js** ≥ 20.x
- **pnpm** ≥ 11.x (package manager)

### Step 1 — Install Dependencies

```bash
pnpm install
```

### Step 2 — Configure Environment

Create a `.env` file in the project root (one already exists):

```env
PORT=3000
```

If omitted, the server defaults to port `3030`.

### Step 3 — Run in Development Mode

```bash
pnpm dev
```

This uses `tsx watch` which:
- Runs TypeScript directly without a build step
- **Hot-reloads** on file changes (watches for modifications)

### Step 4 — Run in Production Mode

```bash
# Compile TypeScript to JavaScript
pnpm build

# Run the compiled output
pnpm start
```

### Available Scripts

| Script | Command | Description |
|---|---|---|
| `pnpm dev` | `tsx watch src/app.ts` | Start dev server with hot-reload |
| `pnpm start` | `tsx src/app.ts` | Run directly via tsx (no watch) |
| `pnpm build` | `tsc` | Compile TypeScript → JavaScript into `./build` |

---

## 🌐 Environment Variables

| Variable | Type | Default | Description |
|---|---|---|---|
| `PORT` | `number` | `3030` | Port number the Express server listens on |

---

## 🧪 Testing with cURL

### Test 1 — Health Check

```bash
curl http://localhost:3000/
```

### Test 2 — Successful Request (201)

```bash
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_1", "payload": {"action": "test"}}'
```

### Test 3 — Invalid Request Body (400)

```bash
# Missing user_id
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"payload": "test"}'
```

### Test 4 — Rate Limit Exceeded (429)

Send 6 rapid requests for the same user — the 6th will be rejected:

```bash
# PowerShell — Send 6 requests rapidly
for ($i = 1; $i -le 6; $i++) {
  Write-Host "Request $i :"
  Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/request" `
    -ContentType "application/json" `
    -Body '{"user_id": "user_test", "payload": "data"}'
}
```

```bash
# Bash / Linux / macOS — Send 6 requests rapidly
for i in $(seq 1 6); do
  echo "Request $i:"
  curl -s -X POST http://localhost:3000/api/request \
    -H "Content-Type: application/json" \
    -d '{"user_id": "user_test", "payload": "data"}'
  echo
done
```

**Expected output:**
```
Request 1: { "success": true, "message": "Request accepted" }
Request 2: { "success": true, "message": "Request accepted" }
Request 3: { "success": true, "message": "Request accepted" }
Request 4: { "success": true, "message": "Request accepted" }
Request 5: { "success": true, "message": "Request accepted" }
Request 6: { "success": false, "message": "Rate limit exceeded. Max 5 requests per minute allowed." }
```

### Test 5 — Check Statistics (200)

```bash
curl http://localhost:3000/api/stats
```

### Test 6 — Multiple Users (Independent Limits)

```bash
# User A — 1 request
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id": "alice", "payload": "data"}'

# User B — 1 request (has separate limit)
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id": "bob", "payload": "data"}'
```

Each user has their **own independent** rolling window. Alice exhausting her limit does not affect Bob.

### Test 7 — Window Expiry (Wait 60 seconds)

```bash
# Send 5 requests (exhaust limit)
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:3000/api/request \
    -H "Content-Type: application/json" \
    -d '{"user_id": "user_expiry", "payload": "data"}'
done

# Wait 60 seconds
sleep 60

# This will succeed — old timestamps have expired
curl -X POST http://localhost:3000/api/request \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user_expiry", "payload": "data"}'
```

---

## 📐 Design Decisions

| Decision | Rationale |
|---|---|
| **Express 5** | Latest major version with native promise support in route handlers and improved error handling. |
| **TypeScript (strict mode)** | `tsconfig.json` enables `strict: true`, `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noUnusedParameters`, and `noUncheckedIndexedAccess` — catching bugs at compile time rather than runtime. |
| **In-memory Map** | For a rate limiter, persistence is unnecessary. Using a `Map` gives O(1) read/write and avoids external dependencies (Redis, etc.). For production scaling, this can be swapped to Redis. |
| **Service + Store separation** | The rate-limit logic (service) is decoupled from data storage (store). This follows the **Single Responsibility Principle** — the store can be swapped independently. |
| **Controller pattern** | Validation and response formatting live in the controller, while the rate-limit decision lives in the service. This keeps each layer focused. |
| **`Object.freeze` for config** | Prevents accidental modification of config values anywhere in the application. |
| **`express.json({ limit: "10kb" })`** | Caps incoming payloads at 10KB to prevent denial-of-service via oversized request bodies. |
| **ESM modules (`"type": "module"`)** | The project uses ES module syntax (`import`/`export`) instead of CommonJS (`require`). This is the modern Node.js standard. |
| **`tsx` for development** | `tsx` executes TypeScript directly without needing a build step, and `tsx watch` provides hot-reload during development. |
| **Payload as `unknown`** | The `payload` field is typed as `unknown` rather than `any` — this is the type-safe alternative that forces explicit type narrowing before use. |

---

## 🛠 Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **Node.js** | ≥ 20.x | JavaScript runtime |
| **TypeScript** | 6.x | Static type checking |
| **Express** | 5.x | HTTP server framework |
| **dotenv** | 17.x | Environment variable loading |
| **tsx** | 4.x | TypeScript execution & hot-reload |
| **pnpm** | 11.x | Fast, disk-efficient package manager |

---

## 📊 Status Codes Summary

| Code | Meaning | When Returned |
|---|---|---|
| `200 OK` | Success | `GET /` (health check), `GET /api/stats` |
| `201 Created` | Resource created | `POST /api/request` (request accepted) |
| `400 Bad Request` | Invalid input | `POST /api/request` (missing/invalid `user_id` or `payload`) |
| `429 Too Many Requests` | Rate limited | `POST /api/request` (exceeded 5 req/min) |

---

## 📁 Configuration Files

### `tsconfig.json` — TypeScript Compiler Options

Key settings and why:

| Option | Value | Purpose |
|---|---|---|
| `target` | `ES2022` | Compile to modern JS for Node 20+ |
| `module` | `ESNext` | Use ESM module format |
| `moduleResolution` | `Bundler` | Modern resolution compatible with tsx |
| `strict` | `true` | Enable all strict type checks |
| `noUncheckedIndexedAccess` | `true` | Array/object indexing adds `undefined` to the type — prevents runtime `undefined` errors |
| `outDir` | `./build` | Compiled output directory |
| `sourceMap` | `true` | Enables debugging compiled code |
| `removeComments` | `true` | Strips comments in production build |

### `package.json` — Project Configuration

- **Type**: `"module"` — Uses ES modules
- **Package manager**: pnpm ≥ 11.x (enforced via `devEngines`)
- **No runtime dependencies** beyond `express` and `dotenv` — keeping the footprint minimal

---

> **Note**: This is an in-memory rate limiter. All data resets when the server restarts. For production use with multiple server instances, swap `memory.store.ts` to use a shared store like Redis.
