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
│   │   └── index.ts
│   ├── data/        # SQLite database
│   └── package.json
└── README.md
```

## Setup

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

### Default Admin Account
- Email: `admin@sage.local`
- Password: `admin123`

## Environment Variables

Create a `.env` file in the `server/` directory for optional configuration:

```
PORT=3001
JWT_SECRET=your-secret-key
```
