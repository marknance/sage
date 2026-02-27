import { Router } from 'express';
import { db } from '../index.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(requireRole('admin'));

// GET /users — list all users
router.get('/users', (_req, res) => {
  const users = db.prepare(
    'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC'
  ).all();
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
