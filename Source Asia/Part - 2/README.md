# Product Catalog API — Part 2

In-memory product management REST API built with **Express 5** and **TypeScript**. Supports product creation with SKU uniqueness, optional media URLs, paginated listing, and full product detail retrieval.

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
pnpm install

pnpm dev        # development with hot-reload
pnpm build && pnpm start  # production
```

Create a `.env` file in the project root:

```env
PORT=4000
```

Defaults to `4000` if not set.

---

## API Reference

### `GET /health`
Health check.

```json
{ "success": true, "message": "health check successful", "time": "..." }
```

---

### `POST /api/createProduct`
Create a new product.

**Request body:**
```json
{
  "name": "Wireless Mouse",
  "sku": "WM-001",
  "image_urls": ["https://cdn.example.com/img1.jpg"],
  "video_urls": ["https://cdn.example.com/demo.mp4"]
}
```

`name` and `sku` are required. `image_urls` and `video_urls` are optional (max 20 each, must be valid `http://` or `https://` URLs).

| Status | When |
|---|---|
| `201 Created` | Product created successfully |
| `400 Bad Request` | Missing name/sku, invalid URL, or more than 20 URLs |
| `409 Conflict` | SKU already exists |
| `500 Internal Server Error` | Unexpected error |

---

### `GET /api/getAllProducts`
Paginated product list. Returns summary fields — counts and thumbnail instead of full URL arrays.

**Query params:** `page` (default: 1), `limit` (default: 10, max: 50)

```bash
GET /api/getAllProducts?page=1&limit=10
```

```json
{
  "success": true,
  "page": 1,
  "limit": 10,
  "total": 3,
  "products": [
    {
      "id": "uuid",
      "name": "Wireless Mouse",
      "sku": "WM-001",
      "image_count": 2,
      "video_count": 1,
      "thumbnail_url": "https://cdn.example.com/img1.jpg",
      "createdAt": "..."
    }
  ]
}
```

| Status | When |
|---|---|
| `200 OK` | Valid request (empty list also returns 200) |
| `400 Bad Request` | `page < 1`, `limit < 1`, or `limit > 50` |

---

### `GET /api/getProductById/:id`
Full product details including all `image_urls` and `video_urls`.

| Status | When |
|---|---|
| `200 OK` | Product found |
| `404 Not Found` | Unknown ID |

---

### `POST /api/:id/media`
Append images or videos to an existing product. Does not replace existing media.

**Request body:**
```json
{
  "image_urls": ["https://cdn.example.com/img2.jpg"],
  "video_urls": []
}
```

At least one non-empty array required. Same URL validation and max 20 per request apply.

| Status | When |
|---|---|
| `200 OK` | Media appended |
| `400 Bad Request` | No URLs provided, invalid URL, or max exceeded |
| `404 Not Found` | Product not found |

---

## Quick Test

```bash
# Create a product
curl -X POST http://localhost:4000/api/createProduct \
  -H "Content-Type: application/json" \
  -d '{"name":"Desk Lamp","sku":"DL-100","image_urls":["https://example.com/lamp.jpg"]}'

# List products
curl "http://localhost:4000/api/getAllProducts?page=1&limit=10"

# Get by ID (replace <id> with uuid from create response)
curl http://localhost:4000/api/getProductById/<id>

# Add media
curl -X POST http://localhost:4000/api/<id>/media \
  -H "Content-Type: application/json" \
  -d '{"video_urls":["https://example.com/demo.mp4"]}'
```

---

## Key Design Decisions

**Separate `skuStore` Map** — SKU uniqueness is checked in O(1) via a dedicated `sku → productId` index, avoiding a full scan on every create.

**`IProductListItem` for list endpoint** — returns counts and a single thumbnail instead of full URL arrays, keeping list payloads small.

**Append-only media** — `POST /:id/media` appends to existing arrays rather than replacing them, preserving previously added media.

**Layered architecture** — routes handle URL mapping, controllers handle HTTP concerns, services hold business rules, store handles persistence. Each layer can be swapped independently.

---

> All data is in-memory and resets on server restart. For production use, replace the Map store with a persistent database and add authentication.