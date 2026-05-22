# Product Catalog API — Part 2 (Company Assignment)

An in-memory **Product Management REST API** built with **Express 5**, **TypeScript**, and **ES Modules**. Products are stored in memory with SKU uniqueness, optional media URLs, pagination for listing, and layered architecture (routes → controller → service → store).

This README documents **every project file**, **every HTTP status code path**, **how to run the server**, and **why a Rolling Window** is used in **Part 1** of the same assignment (rate limiter).

---

## Table of Contents

1. [Assignment Overview (Part 1 + Part 2)](#assignment-overview-part-1--part-2)
2. [Why Rolling Window? (Part 1)](#why-rolling-window-part-1)
3. [Prerequisites](#prerequisites)
4. [How to Run](#how-to-run)
5. [Project Structure — File-by-File](#project-structure--file-by-file)
6. [Architecture & Request Flow](#architecture--request-flow)
7. [API Reference — Every Endpoint & Status Code](#api-reference--every-endpoint--status-code)
8. [Business Rules & Validation](#business-rules--validation)
9. [Manual Testing (cURL / Postman)](#manual-testing-curl--postman)
10. [Status Code Summary Table](#status-code-summary-table)
11. [Design Decisions](#design-decisions)
12. [Limitations & Production Notes](#limitations--production-notes)

---

## Assignment Overview (Part 1 + Part 2)

| Part | Folder | Purpose |
|------|--------|---------|
| **Part 1** | `Source Asia/Part - 1` | Rate Limiter API using **Rolling (Sliding) Window** — max **5 requests per user per 60 seconds** |
| **Part 2** | `Source Asia/Part - 2` | Product Catalog API — CRUD-style product operations with media URLs (this project) |

Part 2 does **not** implement rate limiting. Rolling window logic lives in Part 1 (`rateLimit.service.ts`). Both parts share the same stack: Express, TypeScript, in-memory `Map` stores, layered folders.

---

## Why Rolling Window? (Part 1)

If your assignment asks you to justify **Rolling Window** for rate limiting, use this summary (implemented in `Part - 1/src/services/rateLimit.service.ts`):

### Algorithms compared

| Algorithm | How it works | Main weakness |
|-----------|--------------|---------------|
| **Fixed window** | Counter resets every fixed interval (e.g. each minute). | **Burst at boundary**: 5 requests at `00:59` + 5 at `01:00` = 10 in 2 seconds. |
| **Token bucket** | Tokens refill over time; each request spends one token. | More moving parts (refill rate, bucket size), harder to explain per-user audit trail. |
| **Rolling (sliding) window** ✅ | Store each request timestamp; on every check, drop timestamps older than 60s; allow if count &lt; limit. | Slightly more memory (array of timestamps per user). |

### Why Rolling Window was chosen (Part 1)

1. **Fair limiting** — No reset “cliff” at minute boundaries; quota is always “last 60 seconds from now”.
2. **Accurate enforcement** — Exactly 5 requests in any continuous 60-second period, not 5 per calendar minute.
3. **Observable** — `requestTimestamps.length` powers `/api/stats` as `current_window_requests`.
4. **Simple logic** — Filter old timestamps, compare length to `maxRequests`, push timestamp on accept.

```
Timeline (60s window, limit = 5):

  R1────R2────R3────R4────R5────────────(61s later)────R6 allowed
  └────────── all 5 in window ──────────┘   R1 expires → room for 1 more
```

Part 2 focuses on **product domain rules** (SKU, URLs, pagination), not rate limits.

---

## Prerequisites

- **Node.js** 20+ (ES2022 target in `tsconfig.json`)
- **pnpm** 11+ (required by `package.json` → `devEngines.packageManager`)

---

## How to Run

### 1. Install dependencies

```bash
cd "Source Asia/Part - 2"
pnpm install
```

> **Note:** Scripts use `tsx` to run TypeScript. If `pnpm start` fails with “tsx not found”, install it:
>
> ```bash
> pnpm add -D tsx
> ```

### 2. Environment variables (optional)

Create a `.env` file in the project root (`.env` is gitignored):

```env
PORT=4000
```

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | HTTP port (`src/config/config.ts`) |

### 3. Start the server

| Command | Description |
|---------|-------------|
| `pnpm start` | Run once: `tsx src/app.ts` |
| `pnpm dev` | Watch mode: `tsx watch src/app.ts` |
| `pnpm build` | Compile TypeScript to `build/` via `tsc` |

Expected console output:

```text
 Server running on http://localhost:4000
```

### 4. Health check

```bash
curl http://localhost:4000/health
```

### 5. Run Part 1 (rate limiter) separately

```bash
cd "../Part - 1"
pnpm install
pnpm start
```

Default Part 1 port: **3030** (unless `PORT` is set in `.env`).

Run Part 1 and Part 2 on **different ports** so both can run at the same time.

---

## Project Structure — File-by-File

```
Part - 2/
├── package.json              # Scripts, dependencies, pnpm engine
├── pnpm-lock.yaml            # Locked dependency versions
├── tsconfig.json             # TypeScript compiler options
├── .gitignore                # Ignores node_modules, .env, logs, build artifacts
└── src/
    ├── app.ts                # Express app entry, middleware, routes, server start
    ├── config/
    │   └── config.ts         # Loads .env, exports frozen port config
    ├── types/
    │   └── product.types.ts  # Interfaces and Map type aliases
    ├── store/
    │   └── product.store.ts  # In-memory singleton Maps
    ├── service/
    │   └── product.service.ts # Validation + business logic
    ├── controller/
    │   └── product.controller.ts # HTTP status codes + JSON responses
    └── routes/
        └── product.routes.ts  # URL → controller mapping
```

### `package.json`

| Field / script | Purpose |
|----------------|---------|
| `"type": "module"` | Native ESM (`import` / `export`) |
| `start` | `tsx src/app.ts` |
| `dev` | `tsx watch src/app.ts` — auto-restart on file changes |
| `build` | `tsc` → output in `build/` |
| **Dependencies** | `express`, `dotenv`, `helmet`, `uuid` |
| **DevDependencies** | `typescript`, `@types/express`, `@types/uuid` |

### `tsconfig.json`

| Setting | Value | Why |
|---------|-------|-----|
| `target` | ES2022 | Modern Node features |
| `module` / `moduleResolution` | ESNext / Bundler | ESM imports |
| `rootDir` / `outDir` | `src` / `build` | Compiled JS location |
| `strict` + extra checks | enabled | Safer types (`noUnusedLocals`, `noImplicitReturns`, etc.) |
| `include` | `src/**/*` | Only application source is compiled |

### `src/app.ts` — Application entry

**Responsibilities:**

- Create Express app
- Global middleware:
  - `express.json({ limit: "10kb" })` — parse JSON body, cap size
  - `express.urlencoded({ extended: true, limit: "10kb" })` — form bodies
  - `helmet()` — security headers (XSS, etc.)
- `GET /health` → **200** with `success`, `message`, `time` (ISO string)
- Mount product routes at `/api`
- `startServer()`:
  - Listen on `config.port`
  - On `EADDRINUSE` → log and `process.exit(1)`
  - Other listen errors → log and exit
  - Startup catch → log and exit

**Does not** use a global error handler or 404 handler — unknown routes fall through to Express default (typically **404** with no custom JSON body).

### `src/config/config.ts`

- Calls `dotenv.config()` at import time
- Exports frozen `config` object:
  - `port`: `Number(process.env.PORT) || 4000`

### `src/types/product.types.ts`

| Export | Description |
|--------|-------------|
| `IProduct` | Full product: `id`, `name`, `sku`, `image_urls`, `video_urls`, `createdAt` |
| `ICreateProductRequest` | Body for create: required `name`, `sku`; optional URL arrays |
| `IAddMediaRequest` | Body for add media: optional `image_urls`, `video_urls` |
| `IProductListItem` | List view: counts + `thumbnail_url` (first image) instead of full URL arrays |
| `ProductStore` | `Map<string, IProduct>` keyed by product `id` |
| `SkuStore` | `Map<string, string>` maps `sku` → `productId` for duplicate detection |

### `src/store/product.store.ts`

- `productsStore` — all products by ID
- `skuStore` — SKU → product ID index
- **Singleton pattern:** one module-level `Map` per store; all imports share the same instance
- Data is **lost on server restart** (in-memory only)

### `src/service/product.service.ts` — Business logic

| Function | Behavior |
|----------|----------|
| `isValidUrl(url)` | Must start with `http://` or `https://` |
| `createProductService(payload)` | Validates, checks duplicate SKU, creates UUID, saves to both maps |
| `getAllProductsService(page, limit)` | Reads all products, slices for pagination, maps to `IProductListItem` |
| `getProductByIdService(id)` | Lookup or throw `"Product not found"` |
| `addMediaToProductService(id, payload)` | Append validated URLs to existing product |

**Throws `Error` with specific messages** — controller maps messages to HTTP status codes.

### `src/controller/product.controller.ts` — HTTP layer

Maps service errors to status codes (see [API Reference](#api-reference--every-endpoint--status-code)).

### `src/routes/product.routes.ts`

| Method | Path (under `/api`) | Handler |
|--------|---------------------|---------|
| POST | `/createProduct` | `createProduct` |
| GET | `/getAllProducts` | `getAllProducts` |
| GET | `/getProductById/:id` | `getProductById` |
| POST | `/:id/media` | `addProductMedia` |

**Route order note:** `/:id/media` is registered after named routes so `createProduct` is not captured as an `:id`.

---

## Architecture & Request Flow

```mermaid
flowchart LR
    Client -->|HTTP| app.ts
    app.ts --> product.routes.ts
    product.routes.ts --> product.controller.ts
    product.controller.ts --> product.service.ts
    product.service.ts --> product.store.ts
```

1. **Routes** — URL and HTTP method only  
2. **Controller** — Read `req.body` / `req.params` / `req.query`, call service, set status + JSON  
3. **Service** — Validation and rules; throws `Error` with message  
4. **Store** — In-memory `Map` persistence  

---

## API Reference — Every Endpoint & Status Code

Base URL: `http://localhost:4000`  
Product routes prefix: `/api`

---

### `GET /health`

**Purpose:** Liveness check for load balancers or monitoring.

| Status | When | Response body |
|--------|------|----------------|
| **200** | Always (server up) | `{ "success": true, "message": "health check successful", "time": "<ISO8601>" }` |

**Example:**

```bash
curl http://localhost:4000/health
```

---

### `POST /api/createProduct`

**Purpose:** Create a new product with optional image/video URL lists.

**Request body (`application/json`):**

```json
{
  "name": "Wireless Mouse",
  "sku": "WM-001",
  "image_urls": ["https://cdn.example.com/img1.jpg"],
  "video_urls": ["https://cdn.example.com/demo.mp4"]
}
```

| Field | Required | Rules |
|-------|----------|-------|
| `name` | Yes | Non-empty after trim |
| `sku` | Yes | Non-empty after trim; must be unique |
| `image_urls` | No | Max 20 items; each URL must be `http://` or `https://` |
| `video_urls` | No | Max 20 items; same URL rules |

#### Response cases

| Status | Condition | Response |
|--------|-----------|----------|
| **201** | Product created | `{ "success": true, "message": "Product created successfully", "data": <IProduct> }` |
| **400** | Missing/empty `name` or `sku` | `{ "success": false, "message": "Product name is required" }` or `"Product SKU is required"` |
| **400** | Invalid URL | `{ "success": false, "message": "Invalid image URL" }` or `"Invalid video URL"` |
| **400** | Too many URLs | `{ "success": false, "message": "Maximum 20 image URLs allowed" }` (or video variant) |
| **409** | SKU already exists | `{ "success": false, "message": "Duplicate SKU" }` |
| **500** | Unexpected error | `{ "success": false, "message": "Internal Server Error" }` |

**Controller mapping:** errors whose message includes `required`, `Invalid`, or `Maximum` → **400**; exact `"Duplicate SKU"` → **409**; else **500**.

**Example — success:**

```bash
curl -X POST http://localhost:4000/api/createProduct \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Desk Lamp\",\"sku\":\"DL-100\",\"image_urls\":[\"https://example.com/lamp.jpg\"]}"
```

**Example — duplicate SKU (409):**

```bash
# Run the same SKU twice
curl -X POST http://localhost:4000/api/createProduct \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Copy\",\"sku\":\"DL-100\"}"
```

---

### `GET /api/getAllProducts`

**Purpose:** Paginated list with summary fields (not full media arrays).

**Query parameters:**

| Param | Default | Rules |
|-------|---------|-------|
| `page` | `1` | Integer ≥ 1 |
| `limit` | `10` | Integer ≥ 1 and ≤ 50 |

#### Response cases

| Status | Condition | Response |
|--------|-----------|----------|
| **200** | Valid pagination | `{ "success": true, "page": 1, "limit": 10, "total": <n>, "products": [ IProductListItem, ... ] }` |
| **400** | `page < 1` or `limit < 1` or `limit > 50` | `{ "success": false, "message": "Invalid pagination values" }` |
| **500** | Unexpected error | `{ "success": false, "message": "Internal Server Error" }` |

**`IProductListItem` fields:** `id`, `name`, `sku`, `image_count`, `video_count`, `thumbnail_url` (first image or omitted), `createdAt`.

**Examples:**

```bash
curl "http://localhost:4000/api/getAllProducts?page=1&limit=10"
curl "http://localhost:4000/api/getAllProducts?page=0&limit=10"   # 400
curl "http://localhost:4000/api/getAllProducts?page=1&limit=100" # 400 (limit > 50)
```

**Edge case:** Empty store → **200** with `total: 0`, `products: []`.

---

### `GET /api/getProductById/:id`

**Purpose:** Full product details including all `image_urls` and `video_urls`.

#### Response cases

| Status | Condition | Response |
|--------|-----------|----------|
| **200** | Product exists | `{ "success": true, "data": <IProduct> }` |
| **400** | Missing `id` param (defensive check) | `{ "success": false, "message": "Invalid product id" }` |
| **404** | Unknown ID | `{ "success": false, "message": "Product not found" }` |
| **500** | Unexpected error | `{ "success": false, "message": "Internal Server Error" }` |

**Example:**

```bash
curl http://localhost:4000/api/getProductById/<product-uuid>
```

---

### `POST /api/:id/media`

**Purpose:** Append more images/videos to an existing product (does not replace existing media).

**Request body:**

```json
{
  "image_urls": ["https://cdn.example.com/img2.jpg"],
  "video_urls": []
}
```

| Rule | Detail |
|------|--------|
| At least one array | Must provide non-empty `image_urls` and/or `video_urls` |
| Per-request limits | Max 20 new image URLs and max 20 new video URLs per call |
| URL format | Same `http://` / `https://` validation as create |

#### Response cases

| Status | Condition | Response |
|--------|-----------|----------|
| **200** | Media appended | `{ "success": true, "message": "Media added successfully", "data": <updated IProduct> }` |
| **400** | Missing route `id` | `{ "success": false, "message": "Invalid product id" }` |
| **400** | No URLs provided | `{ "success": false, "message": "At least one image or video URL is required" }` |
| **400** | Invalid URL / max exceeded | Messages containing `Invalid`, `Maximum`, or `required` |
| **404** | Product not found | `{ "success": false, "message": "Product not found" }` |
| **500** | Unexpected error | `{ "success": false, "message": "Internal Server Error" }` |

**Example:**

```bash
curl -X POST http://localhost:4000/api/<product-uuid>/media \
  -H "Content-Type: application/json" \
  -d "{\"image_urls\":[\"https://example.com/extra.png\"]}"
```

**Note:** There is no **413** handler; oversized JSON may be rejected by Express body parser (**413** / parse error) before reaching the controller.

---

## Business Rules & Validation

### URL validation

- Only `http://` and `https://` prefixes are accepted (no `ftp://`, relative paths, or bare domains).

### SKU uniqueness

- `skuStore` enforces O(1) duplicate check before insert.
- On create: both `productsStore` and `skuStore` are updated.
- **No delete/update SKU endpoint** in current code — SKU cannot be changed via API.

### Media limits

- Max **20** URLs per array **per request** (create or add-media).
- Add-media **appends** to existing arrays — total count across multiple calls can exceed 20 unless you add that rule later.

### Pagination

- In-memory slice: `startIndex = (page - 1) * limit`
- Order follows `Map` iteration order (insertion order in modern JS `Map`).

### IDs

- Product `id` is **UUID v4** (`uuid` package).

---

## Manual Testing (cURL / Postman)

### End-to-end flow

```bash
# 1. Health
curl http://localhost:4000/health

# 2. Create product
curl -X POST http://localhost:4000/api/createProduct \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Product\",\"sku\":\"TEST-001\",\"image_urls\":[\"https://example.com/a.jpg\"]}"

# 3. List (copy id from create response)
curl "http://localhost:4000/api/getAllProducts?page=1&limit=10"

# 4. Get by id
curl http://localhost:4000/api/getProductById/<ID>

# 5. Add media
curl -X POST http://localhost:4000/api/<ID>/media \
  -H "Content-Type: application/json" \
  -d "{\"video_urls\":[\"https://example.com/v.mp4\"]}"

# 6. Validation — 400 empty name
curl -X POST http://localhost:4000/api/createProduct \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"\",\"sku\":\"X-1\"}"
```

### Part 1 — Rolling window quick test (port 3030)

```bash
# 5 allowed → 201
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3030/api/request \
    -H "Content-Type: application/json" \
    -d "{\"user_id\":\"alice\",\"payload\":{\"n\":$i}}"
done

# 6th → 429
curl -X POST http://localhost:3030/api/request \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"alice\",\"payload\":{\"n\":6}}"

# Stats → 200
curl http://localhost:3030/api/stats
```

---

## Status Code Summary Table

### Part 2 — Product API

| Code | Meaning | Endpoints |
|------|---------|-----------|
| **200** | OK | `GET /health`, `GET /getAllProducts`, `GET /getProductById/:id`, `POST /:id/media` |
| **201** | Created | `POST /createProduct` |
| **400** | Bad request (validation / pagination / invalid id) | All product endpoints (various cases) |
| **404** | Product not found | `GET /getProductById/:id`, `POST /:id/media` |
| **409** | Conflict (duplicate SKU) | `POST /createProduct` |
| **500** | Internal server error | All product endpoints (unhandled exceptions) |

### Part 1 — Rate Limiter (Rolling Window) — reference

| Code | Meaning | Endpoint |
|------|---------|----------|
| **200** | OK | `GET /health`, `GET /api/stats` |
| **201** | Request accepted | `POST /api/request` (under limit) |
| **400** | Invalid body (`user_id` / `payload`) | `POST /api/request` |
| **429** | Rate limit exceeded | `POST /api/request` (6+ in 60s window) |

---

## Design Decisions

| Decision | Reason |
|----------|--------|
| **Layered architecture** | Clear separation: routing, HTTP concerns, business rules, storage |
| **In-memory `Map`** | Fast O(1) lookup; no DB setup for assignment/demo |
| **Separate `skuStore`** | Duplicate SKU check without scanning all products |
| **`IProductListItem` for list** | Smaller payloads; thumbnail + counts instead of full URL lists |
| **`helmet` on Part 2 only** | Extra security headers for product API |
| **Error messages as strings** | Simple mapping in controller via `message.includes(...)` |
| **Frozen `config`** | Prevents accidental runtime mutation of port |

---

## Limitations & Production Notes

| Topic | Current behavior | Production improvement |
|-------|------------------|------------------------|
| **Persistence** | Data lost on restart | PostgreSQL / MongoDB |
| **Concurrency** | Single process memory | Redis + distributed locks |
| **Auth** | None | API keys / JWT |
| **Rate limiting** | Not in Part 2 | Use Part 1 pattern or API gateway |
| **Media** | URLs only, no upload | S3 + signed URLs |
| **SKU updates** | Not supported | `PATCH` product endpoint |
| **Global 404/500 handler** | Not implemented | Central error middleware |
| **Cumulative media cap** | Only per-request max 20 | Enforce max total URLs per product |

---

## Related Documentation

- **Part 1 (Rolling Window Rate Limiter):** see `../Part - 1/README.md` for extended rate-limit tests and file-level docs.

---

**Author note:** This document is written for company assignment submission — it covers each source file, every documented HTTP status path, run instructions, and the rationale for Rolling Window in Part 1 alongside the Part 2 Product API implementation.
