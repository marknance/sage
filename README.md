# Sage - Personal AI Expert Studio

Sage is a personal AI expert studio that lets you create, manage, and consult specialized AI agents called "Experts." Each Expert is configured with a domain, personality, behaviors, and memory, and can be powered by any supported AI backend (Ollama, LMStudio, OpenAI, Anthropic, and others).

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
├── client/          # React frontend (port 5173)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── stores/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── server/          # Express backend (port 3001)
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── lib/
│   │   └── index.ts
│   ├── data/        # SQLite database
│   └── package.json
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Local Development

1. Install dependencies:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

2. Start the backend:
   ```bash
   cd server && npm run dev
   ```

3. Start the frontend (in a separate terminal):
   ```bash
   cd client && npm run dev
   ```

4. Open http://localhost:5173 in your browser.

### First Login

On first run, Sage generates a random admin password and prints it to the server console:

```
[SAGE SETUP] Admin credentials: admin@sage.local / <random-password>
[SAGE SETUP] You must change this password on first login.
```

Look for this in the terminal where you started the server.

## Production Deployment (Docker)

1. Copy and configure environment variables:
   ```bash
   cp .env.example .env
   ```

2. Set the required `JWT_SECRET` (minimum 32 characters):
   ```bash
   # Generate a secure secret:
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Optionally set `ENCRYPTION_KEY` and `ENCRYPTION_SALT` to encrypt stored API keys at rest.

4. Build and run:
   ```bash
   docker compose up -d
   ```

5. Open http://localhost:3000 in your browser.

6. Check the container logs for the initial admin password:
   ```bash
   docker compose logs sage | grep "SAGE SETUP"
   ```

### Health Check

The container includes a health check at `/api/health` that verifies database connectivity. Monitor it with:
```bash
docker inspect --format='{{.State.Health.Status}}' sage-sage-1
```

## Environment Variables

See `.env.example` for all options. Summary:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes (prod) | Auto-generated (dev) | JWT signing secret, min 32 chars |
| `PORT` | No | `3001` | Server port |
| `ENCRYPTION_KEY` | No | — | AES-256 key for API key encryption, min 32 chars |
| `ENCRYPTION_SALT` | No | — | Salt for key derivation, min 16 chars (required if ENCRYPTION_KEY is set) |
| `ALLOWED_ORIGINS` | No | `localhost:5173,5174` (dev) / `localhost:3000` (Docker) | CORS allowed origins |
| `LOG_LEVEL` | No | `info` | Logging level |
| `NODE_ENV` | No | — | Set to `production` in Docker |
