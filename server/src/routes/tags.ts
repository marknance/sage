import { Router } from 'express';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { isWithinLength } from '../lib/validate.js';

const router = Router();
router.use(authenticate);

// GET / — list user's tags
router.get('/', (req, res) => {
  const tags = db.prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name ASC').all(req.user!.id);
  res.json({ tags });
});

// POST / — create tag
router.post('/', (req, res) => {
  const { name, color } = req.body;
  if (!name || !isWithinLength(name, 1, 50)) {
    res.status(400).json({ error: 'Tag name must be 1-50 characters' });
    return;
  }

  const existing = db.prepare('SELECT id FROM tags WHERE user_id = ? AND name = ?').get(req.user!.id, name);
  if (existing) {
    res.status(409).json({ error: 'Tag already exists' });
    return;
  }

  const result = db.prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)').run(req.user!.id, name, color || '#6366f1');
  const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ tag });
});

// DELETE /:id — delete tag
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }
  res.json({ message: 'Tag deleted' });
});

// POST /conversations/:id/tags — add tag to conversation
router.post('/conversations/:id/tags', (req, res) => {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { tagId } = req.body;
  if (!tagId) {
    res.status(400).json({ error: 'tagId is required' });
    return;
  }

  const tag = db.prepare('SELECT id FROM tags WHERE id = ? AND user_id = ?').get(tagId, req.user!.id);
  if (!tag) {
    res.status(404).json({ error: 'Tag not found' });
    return;
  }

  try {
    db.prepare('INSERT INTO conversation_tags (conversation_id, tag_id) VALUES (?, ?)').run(req.params.id, tagId);
  } catch {
    // Already exists — ignore
  }

  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN conversation_tags ct ON ct.tag_id = t.id
    WHERE ct.conversation_id = ?
  `).all(req.params.id);
  res.json({ tags });
});

// DELETE /conversations/:id/tags/:tagId — remove tag from conversation
router.delete('/conversations/:id/tags/:tagId', (req, res) => {
  const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.id);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  db.prepare('DELETE FROM conversation_tags WHERE conversation_id = ? AND tag_id = ?').run(req.params.id, req.params.tagId);

  const tags = db.prepare(`
    SELECT t.* FROM tags t
    JOIN conversation_tags ct ON ct.tag_id = t.id
    WHERE ct.conversation_id = ?
  `).all(req.params.id);
  res.json({ tags });
});

export default router;
