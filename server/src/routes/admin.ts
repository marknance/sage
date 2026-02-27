import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { db } from '../index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

// GET /users — list all users
router.get('/users', (req, res) => {
  const { search } = req.query;

  let query = 'SELECT id, username, email, role, created_at, updated_at FROM users';
  const params: any[] = [];

  if (search && typeof search === 'string') {
    query += ' WHERE (username LIKE ? OR email LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  query += ' ORDER BY created_at DESC';
  const users = db.prepare(query).all(...params);
  res.json({ users });
});

// PUT /users/:id/role — change user role
router.put('/users/:id/role', (req, res) => {
  const { role } = req.body;
  if (!role || !['user', 'admin'].includes(role)) {
    res.status(400).json({ error: 'Role must be "user" or "admin"' });
    return;
  }

  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(role, req.params.id);

  const updated = db.prepare('SELECT id, username, email, role, created_at, updated_at FROM users WHERE id = ?')
    .get(req.params.id);
  res.json({ user: updated });
});

// DELETE /users/:id — delete user (prevent self-delete)
router.delete('/users/:id', (req, res) => {
  if (Number(req.params.id) === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete your own account' });
    return;
  }

  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ message: 'User deleted' });
});

// PUT /users/:id/password — admin reset user password
router.put('/users/:id/password', async (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const tempPassword = crypto.randomBytes(6).toString('base64url');
  const hash = await bcrypt.hash(tempPassword, 10);

  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(hash, req.params.id);

  res.json({ tempPassword });
});

// GET /conversations — admin list all conversations
router.get('/conversations', (req, res) => {
  const { search } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let where = '1=1';
  const params: any[] = [];
  if (search && typeof search === 'string') {
    where += ' AND c.title LIKE ?';
    params.push(`%${search}%`);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM conversations c WHERE ${where}`).get(...params) as { total: number };

  const conversations = db.prepare(`
    SELECT c.id, c.title, c.type, c.created_at,
      u.username,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    JOIN users u ON u.id = c.user_id
    WHERE ${where}
    ORDER BY c.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ conversations, total: countResult.total });
});

// GET /experts — admin list all experts
router.get('/experts', (req, res) => {
  const { search } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let where = '1=1';
  const params: any[] = [];
  if (search && typeof search === 'string') {
    where += ' AND (e.name LIKE ? OR e.domain LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const countResult = db.prepare(`SELECT COUNT(*) as total FROM experts e WHERE ${where}`).get(...params) as { total: number };

  const experts = db.prepare(`
    SELECT e.id, e.name, e.domain, e.created_at,
      u.username
    FROM experts e
    JOIN users u ON u.id = e.user_id
    WHERE ${where}
    ORDER BY e.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({ experts, total: countResult.total });
});

// DELETE /conversations/:id — admin delete any conversation
router.delete('/conversations/:id', (req, res) => {
  const result = db.prepare('DELETE FROM conversations WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json({ message: 'Conversation deleted' });
});

// DELETE /experts/:id — admin delete any expert
router.delete('/experts/:id', (req, res) => {
  const result = db.prepare('DELETE FROM experts WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }
  res.json({ message: 'Expert deleted' });
});

// GET /stats — system statistics
router.get('/stats', (_req, res) => {
  const users = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  const conversations = db.prepare('SELECT COUNT(*) as count FROM conversations').get() as { count: number };
  const messages = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
  const experts = db.prepare('SELECT COUNT(*) as count FROM experts').get() as { count: number };
  const backends = db.prepare('SELECT COUNT(*) as count FROM ai_backends').get() as { count: number };

  // Get DB file size
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };

  res.json({
    users: users.count,
    conversations: conversations.count,
    messages: messages.count,
    experts: experts.count,
    backends: backends.count,
    db_size: dbSize.size,
  });
});

export default router;
