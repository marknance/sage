import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import bcrypt from 'bcrypt';
import fs from 'node:fs';
import authRouter from './routes/auth.js';
import expertsRouter from './routes/experts.js';
import categoriesRouter from './routes/categories.js';
import conversationsRouter from './routes/conversations.js';
import backendsRouter from './routes/backends.js';
import settingsRouter from './routes/settings.js';
import adminRouter from './routes/admin.js';
import { authLimiter, apiLimiter, streamLimiter } from './middleware/rateLimit.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Database initialization
const dbPath = path.join(__dirname, '..', 'data', 'sage.db');
const db: DatabaseType = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS ai_backends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    base_url TEXT,
    api_key TEXT,
    org_id TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS experts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    domain TEXT NOT NULL,
    personality_tone TEXT DEFAULT 'formal',
    system_prompt TEXT,
    backend_id INTEGER REFERENCES ai_backends(id),
    model_override TEXT,
    memory_enabled INTEGER DEFAULT 1,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expert_behaviors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER REFERENCES experts(id) ON DELETE CASCADE,
    behavior_key TEXT NOT NULL,
    enabled INTEGER DEFAULT 0,
    UNIQUE(expert_id, behavior_key)
  );

  CREATE TABLE IF NOT EXISTS expert_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expert_category_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER REFERENCES experts(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES expert_categories(id) ON DELETE CASCADE,
    UNIQUE(expert_id, category_id)
  );

  CREATE TABLE IF NOT EXISTS expert_memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expert_id INTEGER REFERENCES experts(id) ON DELETE CASCADE,
    memory_type TEXT NOT NULL,
    content TEXT NOT NULL,
    source_conversation_id INTEGER REFERENCES conversations(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'New Conversation',
    type TEXT NOT NULL DEFAULT 'standard',
    expert_debate_enabled INTEGER DEFAULT 0,
    auto_suggest_experts INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversation_experts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    expert_id INTEGER REFERENCES experts(id),
    backend_override_id INTEGER REFERENCES ai_backends(id),
    model_override TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    expert_id INTEGER REFERENCES experts(id),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    extracted_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme TEXT DEFAULT 'dark',
    default_backend_id INTEGER REFERENCES ai_backends(id),
    default_model TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed admin user if not exists
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@sage.local');
if (!existingAdmin) {
  const passwordHash = bcrypt.hashSync('admin123', 10);
  db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run('Admin', 'admin@sage.local', passwordHash, 'admin');
  console.log('Seeded admin user: admin@sage.local / admin123');
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/conversations/:id/messages/stream', streamLimiter);
app.use('/api', apiLimiter);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/experts', expertsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/backends', backendsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin', adminRouter);

// Health endpoint
app.get('/api/health', (_req, res) => {
  try {
    const result = db.prepare('SELECT 1 AS ok').get() as { ok: number } | undefined;
    res.json({
      status: 'ok',
      database: result?.ok === 1 ? 'connected' : 'error',
    });
  } catch {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Sage server running on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});

export { app, db };
