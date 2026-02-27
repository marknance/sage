import { Router } from 'express';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET / — list categories with expert count
router.get('/', (req, res) => {
  const categories = db.prepare(`
    SELECT ec.*, COUNT(ecm.expert_id) as expert_count
    FROM expert_categories ec
    LEFT JOIN expert_category_map ecm ON ecm.category_id = ec.id
    WHERE ec.user_id = ?
    GROUP BY ec.id
    ORDER BY ec.name ASC
  `).all(req.user!.id);
  res.json({ categories });
});

// POST / — create category
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const result = db.prepare('INSERT INTO expert_categories (user_id, name) VALUES (?, ?)').run(req.user!.id, name);
  const category = db.prepare('SELECT * FROM expert_categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ category });
});

// PUT /:id — rename category
router.put('/:id', (req, res) => {
  const { name } = req.body;
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  const result = db.prepare('UPDATE expert_categories SET name = ? WHERE id = ? AND user_id = ?').run(name, req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }

  const category = db.prepare('SELECT * FROM expert_categories WHERE id = ?').get(req.params.id);
  res.json({ category });
});

// DELETE /:id — delete category
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM expert_categories WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Category not found' });
    return;
  }
  res.json({ message: 'Category deleted' });
});

export default router;
