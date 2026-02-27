import { Router } from 'express';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET / — get user settings (auto-create if missing)
router.get('/', (req, res) => {
  const userId = req.user!.id;

  let settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as any;
  if (!settings) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
    settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  }

  res.json({ settings });
});

// PUT / — update user settings
router.put('/', (req, res) => {
  const userId = req.user!.id;
  const { theme, default_backend_id, default_model } = req.body;

  // Ensure row exists
  const existing = db.prepare('SELECT id FROM settings WHERE user_id = ?').get(userId);
  if (!existing) {
    db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(userId);
  }

  db.prepare(`
    UPDATE settings SET
      theme = COALESCE(?, theme),
      default_backend_id = ?,
      default_model = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(
    theme ?? null,
    default_backend_id !== undefined ? (default_backend_id || null) : null,
    default_model !== undefined ? (default_model || null) : null,
    userId
  );

  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  res.json({ settings });
});

export default router;
