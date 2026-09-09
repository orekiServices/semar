# ⁠♡ Semar

<p align="center">
  <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80" alt="Semar Hero Banner" width="100%" style="border-radius: 16px; max-height: 280px; object-fit: cover;" />
</p>

<p align="center">
  <strong>Self-Hosted Synchronized Lyrics Database, Multi-Node Partition Engine & SemAPI JavaScript Runtime</strong>
</p>

> **v2.1 — What's New:** real request-metrics engine + Prometheus `/api/metrics`, community lyrics submissions with admin moderation queue, trending charts, opt-in API-key enforcement with per-key rate limits & node scoping, SemAPI export/import bundles, TTL cache janitor, config backups, Docker + CI, and seeded default SemAPI routes.

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2ForekiServices%2Fsemar"><img src="https://vercel.com/button" alt="Deploy with Vercel" /></a>
  <img src="https://img.shields.io/badge/Vercel-Production%20Ready-000000?style=flat&logo=vercel&logoColor=white" alt="Vercel Deployment" />
  <img src="https://img.shields.io/badge/PostgreSQL-16%20Native%20JSONB-336791?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/SemAPI-Node.js%20VM-ec4899?style=flat&logo=javascript&logoColor=white" alt="SemAPI" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat&logo=vue.js&logoColor=white" alt="Vue 3" />
</p>

---

## ✦ Table of Contents

- [Overview](#-overview)
- [Architecture & Multi-Node Isolation](#-architecture--multi-node-isolation)
- [PostgreSQL Native Support](#-postgresql-native-support)
- [SemAPI - JavaScript Dynamic API Management](#-semapi---javascript-dynamic-api-management)
- [YouTube Video ID Lyrics Cache](#-youtube-video-id-lyrics-cache)
- [Web Admin Setup & Control Panel](#-web-admin-setup--control-panel)
- [Synchronized LRC Karaoke Player](#-synchronized-lrc-karaoke-player)
- [REST API Reference](#-rest-api-reference)
- [Community Submissions & Trending (v2.1)](#-community-submissions--trending-v21)
- [Real Metrics & Prometheus (v2.1)](#-real-metrics--prometheus-v21)
- [API Key Policies (v2.1)](#-api-key-policies-v21)
- [Deployment & Setup](#-deployment--setup)
  - [Deploy to Vercel](#deploy-to-vercel)
  - [Self-Hosted (Docker & Node.js)](#self-hosted-docker--nodejs)
  - [First-Time Setup Wizard](#first-time-setup-wizard)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [License](#-license)

---

## ✦ Overview

**Semar** is a modern, modular, self-hosted lyrics platform built from the ground up in TypeScript (Express.js backend + Vue 3 / Nuxt-style frontend). Unlike traditional monolithic lyrics databases, Semar provides **isolated database namespaces** for independent nodes, real-time **JavaScript serverless dynamic API routes (SemAPI)**, first-class **PostgreSQL** support with native `JSONB` metadata and index optimization, and an advanced **YouTube Video ID lyrics cache**.

---

## ✦ Architecture & Multi-Node Isolation

Semar eliminates the bottleneck of one giant monolithic lyrics table by introducing **Semar Nodes**. Each node acts as an independent lyrics service inside Semar with its own isolated database table, caching namespace, rate limit, and curation rules.

```
                      ┌─────────────────────────────────┐
                      │          Semar Router           │
                      └────────────────┬────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         ▼                             ▼                             ▼
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │  Akai Node   │              │  PiNE Node   │              │  PAKAI Node  │
  │ (J-Pop/Anime)│              │(Global Catalog│             │(Mature/18+)  │
  │ ~280k scale  │              │ ~500k scale  │              │  ~3k scale   │
  └──────┬───────┘              └──────┬───────┘              └──────┬───────┘
         │                             │                             │
         ▼                             ▼                             ▼
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │ lyrics_akai  │              │ lyrics_pine  │              │ lyrics_pakai │
  │ (Table/JSONB)│              │ (Table/JSONB)│              │ (Table/JSONB)│
  └──────────────┘              └──────────────┘              └──────────────┘
```

### Pre-Configured Default Nodes

| Node ID | Name | Focus & Curation | Target Scale | Isolation Mode | NSFW Restrict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `akai` | **Akai** | Japanese, Anime, Vocaloid, J-Pop & J-Rock (Romaji/Kanji) | ~280,000 | `lyrics_akai` | ❌ Public Safe |
| `pine` | **PiNE** | Worldwide Pop, Rock, Hip-Hop, Electronic & Indie hits | ~500,000 | `lyrics_pine` | ❌ Public Safe |
| `pakai` | **PAKAI** | Underground, raw parodies, explicit & adult content | ~3,000 | `lyrics_pakai` | 🔞 18+ Age Gate |

Administrators can dynamically provision new custom nodes (e.g. `kpop`, `classical`, `metal`) with 1-click in the Admin Panel without modifying code.

---

## ✦ PostgreSQL Native Support

PostgreSQL is a first-class production database engine in Semar:
- **Partitioned Table Isolation**: Creates `lyrics_<nodeId>` with independent B-Tree indices on `(title, artist, youtube_video_id)`.
- **JSONB Metadata**: Flexible metadata storage (Romaji, Furigana, ISRC, composer, anime season, BPM) indexed with PostgreSQL **GIN** (`CREATE INDEX ... USING gin (metadata)`).
- **Multi-Engine Abstraction**: Also supports MySQL/MariaDB (`mysql2`) and local zero-config SQLite (`better-sqlite3`).

---

## ✦ SemAPI - JavaScript Dynamic API Management

**SemAPI** allows administrators to create, test, and manage custom REST endpoints directly inside the web panel with **real server-side execution** inside a sandboxed Node.js `vm` environment.

### SemAPI Capabilities
- **Custom Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `ALL`
- **Route-Specific Configuration**: Custom paths (`/v1/anime/search`, `/v1/bridge/resolve`), rate limits, API key requirements.
- **Context API (`ctx`)**:
  - `ctx.query`, `ctx.params`, `ctx.body`, `ctx.headers`
  - `ctx.nodes`: Access specific node partitions (`ctx.nodes.searchLyrics('akai', 'LiSA')`)
  - `ctx.lyrics`: Global lyrics functions (`ctx.lyrics.getByYouTubeId('CwkzK-Fh400')`)
  - `ctx.db`: Direct SQL query execution (`ctx.db.query(...)`)
  - `ctx.cache`: In-memory & DB cache operations (`ctx.cache.get(...)`)
  - `ctx.log(...)`: Server-side log capturing
  - `ctx.status(code).json(data)`: Custom JSON responses
- **Web-Panel Interactive Tester**: Test any route with custom query strings, body JSON, and headers, and inspect HTTP response codes, latency in ms, and server `ctx.log()` messages in real time.
- **Execution Telemetry & Logs**: Captures request bodies, IP addresses, execution durations, and error stack traces.

---

## ✦ YouTube Video ID Lyrics Cache

Semar implements direct music video synchronization caching:
$$\text{youtubeVideoId} \longrightarrow \text{lyrics} \longrightarrow \text{timing / metadata} \longrightarrow \text{source} \longrightarrow \text{node}$$

When a YouTube Video ID is queried (e.g. `GET /api/v1/lyrics/youtube/CwkzK-Fh400` or `yt:CwkzK-Fh400` in the search bar):
1. Checked against high-speed in-memory LRU cache.
2. If missed, queries persistent `youtube_cache` table.
3. If not in cache, traverses active node tables and auto-promotes the resolved lyrics into the cache.

---

## ✦ Web Admin Setup & Control Panel

Semar includes 16 dedicated administration and customization interfaces:

1. **Dashboard**: Metrics overview, node volume distribution, 24-hour request timeline, top queried songs.
2. **Admin Setup**: First-time setup wizard and superadmin credential management.
3. **SemAPI Studio**: JavaScript route builder, syntax editor, live tester, and execution logs.
4. **Nodes Management**: Provision, manage, and configure isolated node namespaces.
5. **Node Details**: Deep inspection into node record tables, node-specific About info, and rate limits.
6. **Lyrics Database**: Global lyrics explorer, synchronized LRC editor with interactive preview player.
7. **Cache Console**: YouTube Video ID mappings table, LRU memory statistics, warmup & purge tools.
8. **About Page**: Markdown public About page customizer.
9. **Branding & Theme**: Site title ("⁠♡ Semar"), logo, hero banners, and custom CSS injector.
10. **Custom Pages**: Manage `/p/:slug` public pages (Terms, Guidelines, DMCA).
11. **API Documentation**: Interactive Swagger/OpenAPI style console with copyable cURL snippets.
12. **Server & Audit Logs**: Centralized real-time audit trail and IP tracking.
13. **Statistics & Analytics**: Latency curves, node query distribution, cache hit ratios.
14. **Database Console**: PostgreSQL/MySQL/SQLite connection tester, schema inspector, and safe SQL runner.
15. **Security & API Keys**: Generate scoped API keys with rate limits and node restrictions.
16. **System Settings**: Global server configuration, cache TTL, default node, and maintenance mode.

---

## ✦ Synchronized LRC Karaoke Player

- **Millisecond Precision**: Parses and synchronizes standard `[mm:ss.xx]` and enhanced word-by-word timestamps.
- **Interactive Karaoke Dock**: Auto-scrolls actively playing lines with glowing gradient highlights.
- **Click-to-Seek**: Click any lyric line to jump playback instantly to that timestamp.
- **Speed Selector**: 0.75x, 1x, 1.25x, 1.5x playback rates.

---

## ✦ REST API Reference

### Core Endpoints
- `GET /api/v1/lyrics/search?q={query}&limit={limit}` — Multi-node fuzzy lyrics search
- `GET /api/v1/lyrics/trending?limit={limit}` — Trending tracks by play count (cached 5 min) · **v2.1**
- `GET /api/v1/lyrics/youtube/:videoId` — Instant YouTube Video ID cache resolver
- `POST /api/v1/lyrics/youtube/associate` — Map YouTube Video ID to track
- `POST /api/v1/submissions` — Submit lyrics for moderator review (public, rate-limited) · **v2.1**
- `GET /api/v1/nodes` — List active nodes and partition metadata
- `GET /api/v1/nodes/:nodeId/lyrics` — Query specific node partition
- `POST /api/v1/nodes/:nodeId/lyrics` — Insert lyrics into node table
- `GET /api/v1/cache/stats` — Real-time memory and persistent cache metrics
- `POST /api/v1/cache/warmup` — Warm up memory LRU cache
- `POST /api/v1/cache/purge-expired` — Purge TTL-expired cache rows (admin) · **v2.1**
- `ALL /api/semapi/run/:path*` — Execute dynamic administrator JavaScript SemAPI endpoints
- `GET /api/semapi/routes/:id/export` — Download a portable route bundle (admin) · **v2.1**
- `POST /api/semapi/routes/import` — Import route bundle(s) (admin) · **v2.1**
- `GET /api/admin/submissions` — Moderation queue (admin) · **v2.1**
- `POST /api/admin/submissions/:id/approve` — Approve & publish into a node (admin) · **v2.1**
- `POST /api/admin/submissions/:id/reject` — Reject with reviewer note (admin) · **v2.1**
- `GET /api/admin/stats/realtime` — Live metrics snapshot + real timeline (admin) · **v2.1**
- `GET /api/admin/database/backup` — Portable JSON config backup (admin) · **v2.1**
- `GET /api/metrics` — Prometheus exposition endpoint · **v2.1**

---

## ✦ Community Submissions & Trending (v2.1)

Visitors can contribute lyrics at **`/submit`** — every submission lands in the admin **Submissions** moderation queue (`/admin/submissions`) with a pending badge in the sidebar. Approving publishes the track into the target node partition (LRC → TTML auto-conversion included); rejecting keeps an audit-trailed reviewer note. Anti-spam is built in: 10 req/min per IP plus a 10/day rolling cap.

The home page shows a **Trending Now** strip powered by `GET /api/v1/lyrics/trending`, ranked by real play counts.

---

## ✦ Real Metrics & Prometheus (v2.1)

The dashboard timeline is now **100% real traffic** — every request is recorded by a zero-DB-write in-memory engine (hourly buckets, per-route counters, latency), flushed to `system_metrics` every 5 minutes and merged with persisted history after restarts. Scrape `GET /api/metrics` with Prometheus:

```yaml
scrape_configs:
  - job_name: semar
    static_configs:
      - targets: ['semar:3000']
```

A background **janitor** runs on boot and every 6 hours: purges TTL-expired YouTube cache rows and prunes `semapi_logs` (30d), `audit_logs` (90d) and `system_metrics` (30d). Disable with `DISABLE_JANITOR=1`.

---

## ✦ API Key Policies (v2.1)

API keys are now enforced, not just issued:

- **System Settings → Require API Key for Search**: when enabled, all public lyrics reads need a valid key (`X-API-Key` / `X-SemAPI-Key` header or `?apiKey=`).
- **Per-key rate limits**: each key's `rate_limit_rpm` is enforced independently (HTTP 429 on breach).
- **Node scoping**: keys with `node_restrictions` only see those partitions; `read` permission is required for lyrics reads.
- YouTube cache rows accept an optional `ttlDays` for automatic janitor eviction.

---

## ✦ Deployment & Setup

### Deploy to Vercel

Semar is optimized for Vercel Serverless Functions and Edge hosting:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2ForekiServices%2Fsemar)

1. Set your `POSTGRES_URL` or `DATABASE_URL` environment variable in the Vercel Dashboard (e.g. Vercel Postgres, Neon, Supabase, or AWS RDS).
2. Set `JWT_SECRET` to a secure random string.
3. Deploy! Vercel automatically routes `/api/*` to `api/index.ts` and serves the compiled Vue 3 frontend from `dist/`.

### Self-Hosted (Docker & Node.js)

**Docker (recommended)** — ships a multi-stage image with the Vue client pre-built:

```bash
# SQLite (zero-config, data persisted in a volume)
docker compose up -d --build

# ...or with the bundled PostgreSQL 16 for production scale:
# 1. Uncomment POSTGRES_URL in docker-compose.yml
# 2. docker compose up -d --build
```

**Plain Node.js:**

```bash
# 1. Clone repository
git clone https://github.com/orekiServices/semar.git
cd semar

# 2. Install dependencies
npm install

# 3. Build client frontend
npm run build

# 4. Start standalone server
npm start
```

### First-Time Setup Wizard

When starting Semar for the first time, navigate to:
```
http://localhost:3000/setup
```
The wizard guides you through:
1. Connecting PostgreSQL, MySQL, or SQLite
2. Creating the master superadmin credentials
3. Initializing the Akai, PiNE, and PAKAI node partitions
4. Customizing branding and site identity

---

## ✦ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Server listening port | `3000` |
| `POSTGRES_URL` | PostgreSQL connection URL | `postgres://...` |
| `DATABASE_URL` | Fallback database URL | - |
| `MYSQL_URL` | MySQL / MariaDB connection URL | - |
| `SQLITE_PATH` | Path to embedded SQLite database | `./data/semar.db` |
| `JWT_SECRET` | Secret key for JWT admin tokens | `semar_secret` |
| `DISABLE_JANITOR` | Disable the TTL/log janitor scheduler | unset (enabled) |
| `NODE_ENV` | Environment mode | `production` |

---

## ✦ License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Crafted with ⁠♡ by <strong>orekiServices</strong>
</p>
