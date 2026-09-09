# ⁠♡ Semar

<p align="center">
  <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80" alt="Semar Hero Banner" width="100%" style="border-radius: 16px; max-height: 280px; object-fit: cover;" />
</p>

<p align="center">
  <strong>Self-Hosted Synchronized Lyrics Database, Multi-Node Partition Engine & SemAPI JavaScript Runtime</strong>
</p>

> **v2.2 — What's New:** Postgres-only engine (SQLite removed — boots cleanly on Vercel serverless), zero default nodes, third-party lyrics libraries as read-only **special nodes** (LRCLIB + lyrics.ovh), **MIN-AI** Markov lyric generator + AI Finder + similar tracks with a public AI Studio, random-track endpoint, minimalist UI refresh, and a hardened self-contained test suite (33 tests on in-process PGlite).

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
- [External Library Nodes (v2.2)](#-external-library-nodes-v22)
- [MIN-AI — AI for Lyrics (v2.2)](#-min-ai--ai-for-lyrics-v22)
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
  │  Your Node   │              │  Your Node   │              │ Special Node │
  │  (e.g. anime)│              │ (e.g. kpop)  │              │(lrclib/lyrics-│
  │  you create  │              │  you create  │              │   ovh, live) │
  └──────┬───────┘              └──────┬───────┘              └──────┬───────┘
         │                             │                             │
         ▼                             ▼                             ▼
  ┌──────────────┐              ┌──────────────┐              ┌──────────────┐
  │ lyrics_anime │              │ lyrics_kpop  │              │ 3rd-party API│
  │ (Table/JSONB)│              │ (Table/JSONB)│              │ (read-only)  │
  └──────────────┘              └──────────────┘              └──────────────┘
```

### No Default Nodes — You Own the Catalog

Fresh installs start with **zero local nodes**. Administrators provision custom nodes (e.g. `anime`, `kpop`, `indie`, `metal`) with 1-click in the Admin Panel, then import lyrics, approve community submissions, or let MIN-AI learn from the catalog.

### Built-in Special Nodes (External Libraries)

| Node ID | Library | Capabilities |
| :--- | :--- | :--- |
| `lrclib` | [LRCLIB](https://lrclib.net) | Full-text search + synced LRC / plain lyrics, converted to TTML on read |
| `lyricsovh` | [lyrics.ovh](https://lyrics.ovh) | Artist–Title lookup (plain lyrics) |

Special nodes are **virtual and read-only**: they appear in `/api/v1/nodes`, global search (ranked after local results), and the public Nodes directory, but have no database table — writes, edits, deletes, and submissions targeting them are rejected with HTTP 400. Disable them globally in **System Settings → Enable External Library Nodes**.

---

## ✦ PostgreSQL Native Support

PostgreSQL is a first-class production database engine in Semar:
- **Partitioned Table Isolation**: Creates `lyrics_<nodeId>` with independent B-Tree indices on `(title, artist, youtube_video_id)`.
- **JSONB Metadata**: Flexible metadata storage (Romaji, Furigana, ISRC, composer, anime season, BPM) indexed with PostgreSQL **GIN** (`CREATE INDEX ... USING gin (metadata)`).
- **Postgres-Only Core**: production runs on managed PostgreSQL (`POSTGRES_URL`); MySQL/MariaDB (`mysql2`) remains supported; zero-config **PGlite** (embedded real Postgres, `USE_PGLITE=1`) covers demos, tests, and single-node deploys. SQLite was removed in v2.2 — it cannot work on serverless filesystems.

---

## ✦ SemAPI - JavaScript Dynamic API Management

**SemAPI** allows administrators to create, test, and manage custom REST endpoints directly inside the web panel with **real server-side execution** inside a sandboxed Node.js `vm` environment.

### SemAPI Capabilities
- **Custom Methods**: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `ALL`
- **Route-Specific Configuration**: Custom paths (`/v1/anime/search`, `/v1/bridge/resolve`), rate limits, API key requirements.
- **Context API (`ctx`)**:
  - `ctx.query`, `ctx.params`, `ctx.body`, `ctx.headers`
  - `ctx.nodes`: Access node partitions (`ctx.nodes.searchLyrics(nodeId, 'LiSA')`, `ctx.nodes.listNodes()`)
  - `ctx.minai`: MIN-AI engine (`ctx.minai.generate({ seed, lines })`, `ctx.minai.finder(q)`, `ctx.minai.similar(nodeId, id)`) · **v2.2**
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
14. **Database Console**: PostgreSQL/MySQL/PGlite connection tester, schema inspector, and safe SQL runner.
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
- `GET /api/v1/lyrics/random` — Random track from the local catalog · **v2.2**
- `GET /api/minai/status` — MIN-AI model status (trained/tracks/states) · **v2.2**
- `POST /api/minai/train` — Rebuild the Markov model from local lyrics (admin) · **v2.2**
- `POST /api/minai/generate` — Generate original lyric lines (`seed`, `lines`, `wordsPerLine`, `artist`) · **v2.2**
- `GET /api/minai/finder?q={vibe}` — Ranked vibe/keyword search with scores + snippets · **v2.2**
- `GET /api/minai/similar/:nodeId/:id` — Tracks with similar lyric vocabulary · **v2.2**

---

## ✦ External Library Nodes (v2.2)

Two third-party lyrics databases ship as **special nodes** — no API keys, no setup:

- **Search integration**: global search fans out to providers in parallel and appends their results after local hits (15-min search cache, 6-hour track cache, graceful on provider outage).
- **Deep links**: every provider track opens at `/lyrics/lrclib/:id` with synced LRC → TTML conversion on read.
- **Public pages**: `/nodes/lrclib` and `/nodes/lyricsovh` offer live library search UIs.
- **Guardrails**: reserved IDs (`lrclib`, `lyricsovh`) can't be provisioned as local nodes; all write paths reject specials with HTTP 400; a cached kill-switch (`System Settings → Enable External Library Nodes`) removes them from search within a minute.

## ✦ MIN-AI — AI for Lyrics (v2.2)

**MIN-AI** is a transparent, dependency-free lyric intelligence engine — classic n-gram Markov chains (order ≤ 3, per line), trained on **all plain lyrics across every local node**:

- **AI Studio (`/ai`)**: generate original lines from a seed word and/or artist style, with line/word sliders and one-click copy.
- **AI Finder**: vibe search (`midnight city lights`) ranked by stopword-filtered vocabulary overlap, with match scores and lyric snippets.
- **More Like This**: every lyric page shows similar tracks by shared vocabulary.
- **Honest AI**: deterministic with `rngSeed`, every generated word provably comes from the training corpus, model stats (tracks/states/vocab) are public, and the model auto-trains lazily on first use (admins can retrain from the dashboard).
- **SemAPI-native**: handlers get `ctx.minai.generate/finder/similar`, and a starter route (`POST /api/semapi/run/v1/minai/generate`) ships in the seed.

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
# Bundled app + PostgreSQL 16 (production-ready, one command)
docker compose up -d --build
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
1. Connecting PostgreSQL, MySQL, or embedded PGlite
2. Creating the master superadmin credentials
3. Understanding the node model (you create nodes after setup; LRCLIB + lyrics.ovh are built in)
4. Customizing branding and site identity

---

## ✦ Configuration & Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Server listening port | `3000` |
| `POSTGRES_URL` | PostgreSQL connection URL | `postgres://...` |
| `DATABASE_URL` | Fallback database URL | - |
| `MYSQL_URL` | MySQL / MariaDB connection URL | - |
| `USE_PGLITE` | Use embedded in-process Postgres instead of a server | unset (off) |
| `PGLITE_DIR` | PGlite data directory (blank = in-memory/ephemeral) | unset |
| `JWT_SECRET` | Secret key for JWT admin tokens | `semar_secret` |
| `DISABLE_JANITOR` | Disable the TTL/log janitor scheduler | unset (enabled) |
| `NODE_ENV` | Environment mode | `production` |

---

## ✦ License

Distributed under the MIT License. See `LICENSE` for more information.

<p align="center">
  Crafted with ⁠♡ by <strong>orekiServices</strong>
</p>
