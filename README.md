# Sage — Personal AI Expert Studio

Sage is a self-hosted AI expert studio that lets you create, manage, and consult specialized AI agents called **Experts**. Each Expert is configured with a domain, personality, behaviors, and persistent memory, and can be powered by any supported AI backend.

## Features

- **Custom AI Experts** — Create domain-specific agents with tailored system prompts, personality tones, and toggleable behaviors
- **Multi-Backend Support** — Connect Ollama, OpenAI, Anthropic, LMStudio, or any OpenAI-compatible API
- **Real-Time Streaming** — SSE-powered token-by-token response streaming
- **Expert Memory** — Experts automatically learn and remember facts, preferences, and context across conversations
- **Multi-Expert Conversations** — Assign multiple experts to a conversation with `@mention` routing
- **Debate Mode** — Have multiple experts respond in sequence, each seeing prior responses
- **Document Uploads** — Attach PDF, DOCX, Markdown, CSV, and other files as conversation context
- **Templates & AI Generation** — 8 built-in templates plus AI-assisted expert creation
- **Import/Export** — Share experts as JSON; export conversations as JSON or Markdown
- **Tags & Pinning** — Organize conversations with colored tags and pins
- **Admin Panel** — User management, content moderation, and system stats
- **Encrypted API Keys** — AES-256-GCM encryption for stored provider credentials
- **Dark, Light & Thunder Themes** — Three built-in themes
- **Keyboard Shortcuts** — Quick navigation with Ctrl+K search and more

## Quick Start (Docker)

The fastest way to run Sage:

```bash
git clone <repo-url> && cd sage
./deploy.sh
```

The deploy script handles everything: creates `.env` with an auto-generated secret, builds the Docker image, starts the container, waits for the health check, and prints the admin credentials.

See [Deployment](#deployment) for details and manual steps.

## Development Setup

### Prerequisites

- Node.js 20+
- npm

### Install & Run

Using the init script:

```bash
./init.sh
```

This installs dependencies for both client and server, then starts both in the background.

Or manually:

```bash
# Terminal 1 — Backend
cd server && npm install && npm run dev

# Terminal 2 — Frontend
cd client && npm install && npm run dev
```

Open http://localhost:5173 in your browser.

### First Login

On first run, Sage generates a random admin password and prints it to the server console:

```
[SAGE SETUP] Admin credentials: admin@sage.local / <random-password>
[SAGE SETUP] You must change this password on first login.
```

## Deployment

### Docker Compose

```bash
# One-command deploy
./deploy.sh

# Manage
./deploy.sh --stop       # Stop containers
./deploy.sh --restart    # Restart containers
./deploy.sh --logs       # Tail logs
./deploy.sh --status     # Show container status and health
```

### Manual Docker Setup

```bash
cp .env.example .env
# Edit .env — set JWT_SECRET (min 32 chars)
docker compose up -d --build
docker compose logs sage | grep "SAGE SETUP"   # Get admin password
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes (prod) | Auto-generated (dev) | JWT signing secret, min 32 chars |
| `PORT` | No | `3001` (dev) / `3000` (Docker) | Server port |
| `ENCRYPTION_KEY` | No | — | AES-256 key for API key encryption, min 32 chars |
| `ENCRYPTION_SALT` | No | — | Salt for key derivation, min 16 chars |
| `ALLOWED_ORIGINS` | No | `localhost:5173,5174` (dev) / `localhost:3000` (Docker) | CORS allowed origins |
| `LOG_LEVEL` | No | `info` | Logging level (trace/debug/info/warn/error/fatal) |
| `NODE_ENV` | No | — | Set to `production` in Docker |

### Health Check

The container includes a health check at `/api/health` that verifies database connectivity:

```bash
curl http://localhost:3000/api/health
# {"status":"ok","database":"connected"}

docker inspect --format='{{.State.Health.Status}}' sage-sage-1
```

### Backup & Restore

Sage stores all data in a single SQLite database inside a Docker volume.

**Backup:**
```bash
docker compose exec sage cp /app/server/data/sage.db /app/server/data/sage.db.bak
docker cp "$(docker compose ps -q sage)":/app/server/data/sage.db ./sage-backup.db
```

**Restore:**
```bash
docker compose stop
docker cp ./sage-backup.db "$(docker compose ps -q sage)":/app/server/data/sage.db
docker compose start
```

## User Guide

For a complete walkthrough of all features, see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)**.

## Tech Stack

### Frontend
- React 19 with TypeScript
- Tailwind CSS v4
- React Router v7
- TanStack Query v5 (server state)
- Zustand (UI state)
- Vite 7 (build tool)

### Backend
- Node.js 20+ with Express 5
- TypeScript
- SQLite via better-sqlite3
- JWT authentication with bcrypt
- REST API with SSE streaming

## Project Structure

```
sage/
├── client/              # React frontend (port 5173 dev / built into server for prod)
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # API client, utilities
│   │   ├── stores/      # Zustand state stores
│   │   ├── App.tsx      # Router and layout
│   │   └── main.tsx     # Entry point
│   └── package.json
├── server/              # Express backend (port 3001 dev / 3000 prod)
│   ├── src/
│   │   ├── middleware/  # Auth, rate limiting, validation
│   │   ├── routes/      # API route handlers
│   │   ├── services/    # AI provider integration, business logic
│   │   ├── lib/         # Database, encryption, logging
│   │   └── index.ts     # Server entry, schema, startup
│   ├── data/            # SQLite database (gitignored)
│   └── package.json
├── docs/                # Documentation
│   └── USER_GUIDE.md    # End-user guide
├── deploy.sh            # One-command Docker deployment
├── init.sh              # Local development setup
├── Dockerfile           # Multi-stage production build
├── docker-compose.yml   # Container orchestration
└── .env.example         # Environment variable template
```

## API Reference

All endpoints are under `/api` and require JWT authentication (via httpOnly cookie) unless noted.

| Group | Prefix | Key Endpoints |
|-------|--------|---------------|
| **Auth** | `/api/auth` | `POST /login`, `POST /register`, `POST /logout`, `GET /me`, `PUT /password` |
| **Experts** | `/api/experts` | CRUD, `/templates`, `/generate`, `/import`, `/:id/export`, `/:id/clone`, `/:id/memories` |
| **Conversations** | `/api/conversations` | CRUD, `/:id/messages/stream` (SSE), `/:id/documents`, `/:id/experts`, `/bulk-delete`, `/:id/export` |
| **Backends** | `/api/backends` | CRUD, `/:id/test`, `/:id/models` |
| **Categories** | `/api/categories` | CRUD with expert counts |
| **Tags** | `/api/tags` | CRUD, `/conversations/:id/tags` |
| **Settings** | `/api/settings` | `GET /`, `PUT /` (theme, defaults) |
| **Admin** | `/api/admin` | `/users`, `/conversations`, `/experts`, `/stats` (admin role required) |
| **Health** | `/api/health` | `GET /` (no auth required) |

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   React SPA     │────▶│  Express API     │────▶│  SQLite (WAL)    │
│   (Vite/Tailwind)│◀────│  (REST + SSE)    │◀────│  better-sqlite3  │
└─────────────────┘     └──────┬───────────┘     └──────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │   AI Providers       │
                    │  ┌─────┐ ┌────────┐  │
                    │  │Ollama│ │OpenAI  │  │
                    │  └─────┘ └────────┘  │
                    │  ┌─────┐ ┌────────┐  │
                    │  │Anth.│ │LMStudio│  │
                    │  └─────┘ └────────┘  │
                    │  ┌────────────────┐  │
                    │  │Custom (compat.)│  │
                    │  └────────────────┘  │
                    └──────────────────────┘
```

The frontend is a React SPA that communicates with the Express backend via REST endpoints and SSE for streaming. In production (Docker), the compiled frontend is served as static files by Express on port 3000. In development, Vite serves the frontend on port 5173 with a proxy to the backend on port 3001.

The backend uses SQLite in WAL mode for concurrent reads. All AI provider calls go through a unified OpenAI-compatible `/v1/chat/completions` interface with automatic retries, context window trimming, and streaming support.

## License

MIT
