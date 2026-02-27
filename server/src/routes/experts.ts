import { Router } from 'express';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const DEFAULT_BEHAVIORS = [
  'cite_sources',
  'ask_clarifying_questions',
  'provide_examples',
  'use_analogies',
  'summarize_responses',
];

// GET / — list experts
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const { search, category, sort } = req.query;

  let query = `
    SELECT e.*, GROUP_CONCAT(ec.name) as category_names
    FROM experts e
    LEFT JOIN expert_category_map ecm ON ecm.expert_id = e.id
    LEFT JOIN expert_categories ec ON ec.id = ecm.category_id
    WHERE e.user_id = ?
  `;
  const params: any[] = [userId];

  if (search) {
    query += ` AND (e.name LIKE ? OR e.domain LIKE ? OR e.description LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (category) {
    query += ` AND ecm.category_id = ?`;
    params.push(category);
  }

  query += ` GROUP BY e.id`;

  if (sort === 'name') {
    query += ` ORDER BY e.name ASC`;
  } else if (sort === 'created') {
    query += ` ORDER BY e.created_at DESC`;
  } else {
    query += ` ORDER BY COALESCE(e.last_used_at, e.created_at) DESC`;
  }

  const experts = db.prepare(query).all(...params);
  res.json({ experts });
});

// POST / — create expert
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { name, domain, description, personality_tone, system_prompt, backend_id, model_override, memory_enabled } = req.body;

  if (!name || !domain) {
    res.status(400).json({ error: 'Name and domain are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO experts (user_id, name, domain, description, personality_tone, system_prompt, backend_id, model_override, memory_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(userId, name, domain, description || null, personality_tone || 'formal', system_prompt || null, backend_id || null, model_override || null, memory_enabled ?? 1);

  const expertId = result.lastInsertRowid;

  // Insert default behaviors
  const insertBehavior = db.prepare('INSERT INTO expert_behaviors (expert_id, behavior_key, enabled) VALUES (?, ?, 0)');
  for (const key of DEFAULT_BEHAVIORS) {
    insertBehavior.run(expertId, key);
  }

  const expert = db.prepare('SELECT * FROM experts WHERE id = ?').get(expertId);
  res.status(201).json({ expert });
});

// GET /:id — detail
router.get('/:id', (req, res) => {
  const expert = db.prepare('SELECT * FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!expert) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const behaviors = db.prepare('SELECT * FROM expert_behaviors WHERE expert_id = ?').all(req.params.id);
  const categories = db.prepare(`
    SELECT ec.* FROM expert_categories ec
    JOIN expert_category_map ecm ON ecm.category_id = ec.id
    WHERE ecm.expert_id = ?
  `).all(req.params.id);
  const memoryCount = db.prepare('SELECT COUNT(*) as count FROM expert_memories WHERE expert_id = ?').get(req.params.id) as { count: number };

  res.json({ expert, behaviors, categories, memoryCount: memoryCount.count });
});

// PUT /:id — update expert
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const { name, domain, description, personality_tone, system_prompt, backend_id, model_override, memory_enabled } = req.body;

  db.prepare(`
    UPDATE experts SET
      name = COALESCE(?, name),
      domain = COALESCE(?, domain),
      description = ?,
      personality_tone = COALESCE(?, personality_tone),
      system_prompt = ?,
      backend_id = ?,
      model_override = ?,
      memory_enabled = COALESCE(?, memory_enabled),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(name, domain, description, personality_tone, system_prompt, backend_id ?? null, model_override, memory_enabled, req.params.id, req.user!.id);

  const expert = db.prepare('SELECT * FROM experts WHERE id = ?').get(req.params.id);
  res.json({ expert });
});

// GET /:id/usage — check expert usage across conversations
router.get('/:id/usage', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const conversationCount = db.prepare(
    'SELECT COUNT(DISTINCT conversation_id) as count FROM conversation_experts WHERE expert_id = ?'
  ).get(req.params.id) as { count: number };
  const messageCount = db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE expert_id = ?'
  ).get(req.params.id) as { count: number };

  res.json({ conversation_count: conversationCount.count, message_count: messageCount.count });
});

// DELETE /:id — delete expert
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM experts WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }
  res.json({ message: 'Expert deleted' });
});

// PUT /:id/behaviors — bulk upsert
router.put('/:id/behaviors', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const { behaviors } = req.body as { behaviors: { behavior_key: string; enabled: number }[] };
  if (!Array.isArray(behaviors)) {
    res.status(400).json({ error: 'Behaviors must be an array' });
    return;
  }

  const upsert = db.prepare(`
    INSERT INTO expert_behaviors (expert_id, behavior_key, enabled)
    VALUES (?, ?, ?)
    ON CONFLICT(expert_id, behavior_key) DO UPDATE SET enabled = excluded.enabled
  `);

  const tx = db.transaction(() => {
    for (const b of behaviors) {
      upsert.run(req.params.id, b.behavior_key, b.enabled);
    }
  });
  tx();

  const updated = db.prepare('SELECT * FROM expert_behaviors WHERE expert_id = ?').all(req.params.id);
  res.json({ behaviors: updated });
});

// PUT /:id/categories — replace category assignments
router.put('/:id/categories', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const { categoryIds } = req.body as { categoryIds: number[] };
  if (!Array.isArray(categoryIds)) {
    res.status(400).json({ error: 'categoryIds must be an array' });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM expert_category_map WHERE expert_id = ?').run(req.params.id);
    const insert = db.prepare('INSERT INTO expert_category_map (expert_id, category_id) VALUES (?, ?)');
    for (const catId of categoryIds) {
      insert.run(req.params.id, catId);
    }
  });
  tx();

  const categories = db.prepare(`
    SELECT ec.* FROM expert_categories ec
    JOIN expert_category_map ecm ON ecm.category_id = ec.id
    WHERE ecm.expert_id = ?
  `).all(req.params.id);
  res.json({ categories });
});

// GET /:id/memories — list memories
router.get('/:id/memories', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const memories = db.prepare('SELECT * FROM expert_memories WHERE expert_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ memories });
});

// POST /:id/memories — add memory
router.post('/:id/memories', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const { memory_type, content } = req.body;
  if (!memory_type || !content) {
    res.status(400).json({ error: 'memory_type and content are required' });
    return;
  }

  const result = db.prepare('INSERT INTO expert_memories (expert_id, memory_type, content) VALUES (?, ?, ?)').run(req.params.id, memory_type, content);
  const memory = db.prepare('SELECT * FROM expert_memories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ memory });
});

// DELETE /:id/memories/:mid — delete single memory
router.delete('/:id/memories/:mid', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const result = db.prepare('DELETE FROM expert_memories WHERE id = ? AND expert_id = ?').run(req.params.mid, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Memory not found' });
    return;
  }
  res.json({ message: 'Memory deleted' });
});

// DELETE /:id/memories — clear all memories
router.delete('/:id/memories', (req, res) => {
  const existing = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  db.prepare('DELETE FROM expert_memories WHERE expert_id = ?').run(req.params.id);
  res.json({ message: 'All memories cleared' });
});

export default router;
