import { Router } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../index.js';
import { signToken, COOKIE_OPTIONS, authenticate } from '../middleware/auth.js';
import { isValidEmail, isWithinLength } from '../lib/validate.js';

const router = Router();

// POST /register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400).json({ error: 'Username, email, and password are required' });
    return;
  }

  if (!isWithinLength(username, 2, 50)) {
    res.status(400).json({ error: 'Username must be 2-50 characters' });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Invalid email format' });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters' });
    return;
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already in use' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)'
  ).run(username, email, passwordHash, 'user');

  const user = {
    id: result.lastInsertRowid as number,
    username,
    email,
    role: 'user',
  };

  res.cookie('token', signToken(user.id, user.role), COOKIE_OPTIONS);
  res.status(201).json({ user });
});

// POST /login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = db.prepare(
    'SELECT id, username, email, password_hash, role, must_change_password FROM users WHERE email = ?'
  ).get(email) as { id: number; username: string; email: string; password_hash: string; role: string; must_change_password: number } | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  res.cookie('token', signToken(user.id, user.role), COOKIE_OPTIONS);
  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      must_change_password: !!user.must_change_password,
    },
  });
});

// POST /logout
router.post('/logout', (_req, res) => {
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Logged out' });
});

// GET /me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /profile — update username/email
router.put('/profile', authenticate, async (req, res) => {
  const { username, email } = req.body;

  if (username !== undefined) {
    if (!isWithinLength(username, 2, 50)) {
      res.status(400).json({ error: 'Username must be 2-50 characters' });
      return;
    }
  }

  if (email !== undefined) {
    if (!isValidEmail(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user!.id);
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }
  }

  db.prepare(`
    UPDATE users SET
      username = COALESCE(?, username),
      email = COALESCE(?, email),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(username ?? null, email ?? null, req.user!.id);

  const user = db.prepare('SELECT id, username, email, role, created_at FROM users WHERE id = ?').get(req.user!.id);
  res.json({ user });
});

// DELETE /account — delete own account
router.delete('/account', authenticate, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Password is required to delete account' });
    return;
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string };
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Password is incorrect' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(req.user!.id);
  res.clearCookie('token', COOKIE_OPTIONS);
  res.json({ message: 'Account deleted' });
});

// PUT /password
router.put('/password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current password and new password are required' });
    return;
  }

  if (newPassword.length < 8) {
    res.status(400).json({ error: 'New password must be at least 8 characters' });
    return;
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as { password_hash: string };
  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user!.id);

  res.json({ message: 'Password updated' });
});

export default router;
