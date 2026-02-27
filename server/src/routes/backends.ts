import { Router } from 'express';
import axios from 'axios';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { isValidUrl, isWithinLength } from '../lib/validate.js';

const router = Router();
router.use(authenticate);

const TYPE_DEFAULTS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  custom: '',
};

function maskBackend(row: any) {
  const { api_key, ...rest } = row;
  return { ...rest, has_api_key: !!api_key };
}

// GET / — list backends
router.get('/', (req, res) => {
  const backends = db.prepare('SELECT * FROM ai_backends WHERE user_id = ? ORDER BY created_at DESC')
    .all(req.user!.id);
  res.json({ backends: backends.map(maskBackend) });
});

// POST / — create backend
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { name, type, base_url, api_key, org_id, is_active } = req.body;

  if (!name || !type) {
    res.status(400).json({ error: 'name and type are required' });
    return;
  }
  if (!isWithinLength(name, 1, 100)) {
    res.status(400).json({ error: 'Name must be 1-100 characters' });
    return;
  }

  const resolvedUrl = base_url || TYPE_DEFAULTS[type] || '';
  if (resolvedUrl && !isValidUrl(resolvedUrl)) {
    res.status(400).json({ error: 'Invalid base URL format' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO ai_backends (user_id, name, type, base_url, api_key, org_id, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, type, resolvedUrl, api_key || null, org_id || null, is_active ?? 1);

  const backend = db.prepare('SELECT * FROM ai_backends WHERE id = ?').get(result.lastInsertRowid) as any;
  res.status(201).json({ backend: maskBackend(backend) });
});

// GET /:id — detail + expert count
router.get('/:id', (req, res) => {
  const backend = db.prepare('SELECT * FROM ai_backends WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  const expertCount = db.prepare('SELECT COUNT(*) as count FROM experts WHERE backend_id = ?')
    .get(req.params.id) as { count: number };

  res.json({ backend: maskBackend(backend), expert_count: expertCount.count });
});

// PUT /:id — update backend
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM ai_backends WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  const { name, type, base_url, api_key, org_id, is_active } = req.body;

  if (name !== undefined && !isWithinLength(name, 1, 100)) {
    res.status(400).json({ error: 'Name must be 1-100 characters' });
    return;
  }
  if (base_url && !isValidUrl(base_url)) {
    res.status(400).json({ error: 'Invalid base URL format' });
    return;
  }

  // api_key logic: omitted = keep, empty string = clear, value = update
  let resolvedApiKey = existing.api_key;
  if (api_key !== undefined) {
    resolvedApiKey = api_key === '' ? null : api_key;
  }

  db.prepare(`
    UPDATE ai_backends SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      base_url = COALESCE(?, base_url),
      api_key = ?,
      org_id = ?,
      is_active = COALESCE(?, is_active)
    WHERE id = ? AND user_id = ?
  `).run(
    name ?? null,
    type ?? null,
    base_url ?? null,
    resolvedApiKey,
    org_id !== undefined ? (org_id || null) : existing.org_id,
    is_active ?? null,
    req.params.id,
    req.user!.id
  );

  const backend = db.prepare('SELECT * FROM ai_backends WHERE id = ?').get(req.params.id) as any;
  res.json({ backend: maskBackend(backend) });
});

// DELETE /:id — block if in use
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM ai_backends WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  const expertRef = db.prepare('SELECT COUNT(*) as count FROM experts WHERE backend_id = ?')
    .get(req.params.id) as { count: number };
  const settingsRef = db.prepare('SELECT COUNT(*) as count FROM settings WHERE default_backend_id = ?')
    .get(req.params.id) as { count: number };

  if (expertRef.count > 0 || settingsRef.count > 0) {
    res.status(409).json({
      error: 'Backend is in use by experts or settings. Remove references first.',
      expert_count: expertRef.count,
      settings_count: settingsRef.count,
    });
    return;
  }

  db.prepare('DELETE FROM ai_backends WHERE id = ?').run(req.params.id);
  res.json({ message: 'Backend deleted' });
});

// POST /:id/test — test connection
router.post('/:id/test', async (req, res) => {
  const backend = db.prepare('SELECT * FROM ai_backends WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  try {
    const headers: Record<string, string> = {};
    if (backend.api_key) {
      headers['Authorization'] = `Bearer ${backend.api_key}`;
    }
    if (backend.org_id) {
      headers['OpenAI-Organization'] = backend.org_id;
    }

    const { data } = await axios.get(`${backend.base_url}/v1/models`, {
      headers,
      timeout: 5000,
    });

    res.json({ success: true, model_count: data?.data?.length ?? 0 });
  } catch (err: any) {
    const message = err.response?.data?.error?.message || err.message || 'Connection failed';
    res.json({ success: false, error: message });
  }
});

// GET /:id/models — fetch available models
router.get('/:id/models', async (req, res) => {
  const backend = db.prepare('SELECT * FROM ai_backends WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!backend) {
    res.status(404).json({ error: 'Backend not found' });
    return;
  }

  try {
    const headers: Record<string, string> = {};
    if (backend.api_key) {
      headers['Authorization'] = `Bearer ${backend.api_key}`;
    }
    if (backend.org_id) {
      headers['OpenAI-Organization'] = backend.org_id;
    }

    const { data } = await axios.get(`${backend.base_url}/v1/models`, {
      headers,
      timeout: 5000,
    });

    const models: string[] = (data?.data || []).map((m: any) => m.id).sort();
    res.json({ models });
  } catch (err: any) {
    const message = err.response?.data?.error?.message || err.message || 'Failed to fetch models';
    res.status(502).json({ error: message });
  }
});

export default router;
