import { Router } from 'express';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { isWithinLength } from '../lib/validate.js';
import { resolveBackendConfig, chatCompletion } from '../services/ollama.js';

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

  // Count total before pagination
  const countQuery = query.replace(/SELECT e\.\*[\s\S]*?FROM experts e/, 'SELECT COUNT(DISTINCT e.id) as total FROM experts e');
  const countResult = db.prepare(countQuery.replace(/GROUP BY.*$/, '').replace(/ORDER BY.*$/, '')).get(...params) as { total: number };
  const total = countResult.total;

  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  query += ` LIMIT ? OFFSET ?`;

  const experts = db.prepare(query).all(...params, limit, offset);
  res.json({ experts, total, limit, offset });
});

// POST /generate — AI-assisted expert generation
router.post('/generate', async (req, res) => {
  const userId = req.user!.id;
  const { mode, domain, name, description, tone } = req.body as {
    mode: 'assist' | 'full';
    domain: string;
    name?: string;
    description?: string;
    tone?: string;
  };

  if (!domain || !domain.trim()) {
    res.status(400).json({ error: 'Domain is required' });
    return;
  }

  if (mode !== 'assist' && mode !== 'full') {
    res.status(400).json({ error: 'Mode must be "assist" or "full"' });
    return;
  }

  // Get user's default backend
  const userSettings = db.prepare('SELECT default_backend_id, default_model FROM settings WHERE user_id = ?')
    .get(userId) as { default_backend_id: number | null; default_model: string | null } | undefined;

  const backend = resolveBackendConfig(null, userSettings?.default_backend_id, db);
  if (!backend) {
    res.status(400).json({ error: 'No AI backend configured. Please set a default backend in Settings.' });
    return;
  }

  const model = userSettings?.default_model || undefined;

  const behaviorList = DEFAULT_BEHAVIORS.map((b) => `"${b}"`).join(', ');

  let userPrompt: string;
  if (mode === 'full') {
    userPrompt = `Generate a complete expert configuration for the domain: "${domain.trim()}"${tone ? `. Preferred tone: ${tone}` : ''}.`;
  } else {
    const parts = [`Refine/complete an expert configuration for the domain: "${domain.trim()}".`];
    if (name) parts.push(`Current name: "${name}"`);
    if (description) parts.push(`Current description: "${description}"`);
    if (tone) parts.push(`Current tone: "${tone}"`);
    parts.push('Fill in or improve any missing/weak fields.');
    userPrompt = parts.join(' ');
  }

  const systemPrompt = `You are an expert configuration generator. Given a domain or topic, generate a JSON object for an AI expert assistant.

Return ONLY valid JSON with these fields:
- "name": string (short, descriptive name for the expert, e.g. "Python Mentor")
- "description": string (1-2 sentence description of what this expert does)
- "system_prompt": string (detailed instructions for how the expert should behave, its expertise areas, and how it should respond — 2-4 paragraphs)
- "tone": one of "formal", "casual", "technical", "friendly", "concise"
- "behaviors": object with boolean values for these keys: ${behaviorList}

Make the system_prompt detailed and specific to the domain. It should define the expert's personality, knowledge areas, and response style.

Return ONLY the JSON object, no markdown fences or extra text.`;

  try {
    const raw = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      backend,
    });

    // Strip markdown fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const parsed = JSON.parse(cleaned);

    res.json({
      name: parsed.name || '',
      description: parsed.description || '',
      system_prompt: parsed.system_prompt || '',
      tone: parsed.tone || 'formal',
      behaviors: parsed.behaviors || {},
    });
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      res.status(502).json({ error: 'AI returned invalid JSON. Please try again.' });
      return;
    }
    res.status(502).json({ error: err.message || 'Failed to generate expert configuration' });
  }
});

// GET /templates — pre-built expert templates
router.get('/templates', (_req, res) => {
  const templates = [
    {
      name: 'Code Reviewer',
      domain: 'Software Engineering',
      description: 'Reviews code for bugs, best practices, and maintainability.',
      system_prompt: 'You are an experienced code reviewer. Analyze code for bugs, security vulnerabilities, performance issues, and adherence to best practices. Provide specific, actionable feedback with explanations. Suggest improvements with code examples when possible. Be thorough but constructive.',
      tone: 'technical',
      behaviors: { cite_sources: false, ask_clarifying_questions: true, provide_examples: true, use_analogies: false, summarize_responses: true },
    },
    {
      name: 'Writing Coach',
      domain: 'Writing & Communication',
      description: 'Helps improve writing clarity, style, and structure.',
      system_prompt: 'You are a skilled writing coach. Help users improve their writing by focusing on clarity, conciseness, tone, and structure. Offer specific suggestions rather than vague feedback. When editing, explain why changes improve the text. Adapt your advice to the intended audience and purpose of the writing.',
      tone: 'friendly',
      behaviors: { cite_sources: false, ask_clarifying_questions: true, provide_examples: true, use_analogies: true, summarize_responses: false },
    },
    {
      name: 'Data Analyst',
      domain: 'Data Analysis & Statistics',
      description: 'Analyzes data, explains statistical concepts, and helps with visualization.',
      system_prompt: 'You are a data analyst with expertise in statistics, data visualization, and data-driven decision making. Help users understand their data, choose appropriate analysis methods, and interpret results. Explain statistical concepts clearly and suggest visualization approaches. Be precise with numbers and transparent about limitations.',
      tone: 'technical',
      behaviors: { cite_sources: true, ask_clarifying_questions: true, provide_examples: true, use_analogies: true, summarize_responses: true },
    },
    {
      name: 'Research Assistant',
      domain: 'Research & Analysis',
      description: 'Assists with research tasks, literature review, and synthesis.',
      system_prompt: 'You are a thorough research assistant. Help users explore topics, synthesize information, and develop well-supported arguments. Always distinguish between established facts and emerging ideas. Provide balanced perspectives and cite relevant sources when possible. Help organize findings into clear, structured summaries.',
      tone: 'formal',
      behaviors: { cite_sources: true, ask_clarifying_questions: true, provide_examples: true, use_analogies: false, summarize_responses: true },
    },
    {
      name: 'Language Tutor',
      domain: 'Language Learning',
      description: 'Teaches languages through conversation, grammar, and vocabulary practice.',
      system_prompt: 'You are a patient and encouraging language tutor. Help users learn through a mix of explanation, examples, and practice exercises. Correct mistakes gently and explain the rules behind corrections. Use the target language progressively more as the user advances. Incorporate cultural context when relevant.',
      tone: 'friendly',
      behaviors: { cite_sources: false, ask_clarifying_questions: true, provide_examples: true, use_analogies: true, summarize_responses: false },
    },
    {
      name: 'Math Tutor',
      domain: 'Mathematics',
      description: 'Explains math concepts and guides through problem solving step by step.',
      system_prompt: 'You are a patient math tutor. Break down complex problems into manageable steps. Explain the reasoning behind each step rather than just showing the answer. Use visual representations and real-world analogies when helpful. Encourage students to attempt problems themselves and guide them when stuck.',
      tone: 'friendly',
      behaviors: { cite_sources: false, ask_clarifying_questions: true, provide_examples: true, use_analogies: true, summarize_responses: true },
    },
    {
      name: 'DevOps Engineer',
      domain: 'DevOps & Infrastructure',
      description: 'Assists with CI/CD, containers, cloud infrastructure, and automation.',
      system_prompt: 'You are a senior DevOps engineer with expertise in CI/CD pipelines, containerization, cloud platforms (AWS, GCP, Azure), and infrastructure as code. Help users design reliable, scalable infrastructure. Prioritize security and cost optimization. Provide practical configurations and scripts with clear explanations.',
      tone: 'technical',
      behaviors: { cite_sources: true, ask_clarifying_questions: true, provide_examples: true, use_analogies: false, summarize_responses: true },
    },
    {
      name: 'Creative Writer',
      domain: 'Creative Writing & Storytelling',
      description: 'Helps craft stories, dialogues, and creative content.',
      system_prompt: 'You are a creative writing partner. Help users develop compelling narratives, vivid characters, and engaging dialogue. Offer techniques for overcoming writer\'s block and improving craft. When asked to write, create original content that matches the requested style and tone. Provide constructive feedback that encourages experimentation.',
      tone: 'casual',
      behaviors: { cite_sources: false, ask_clarifying_questions: true, provide_examples: true, use_analogies: true, summarize_responses: false },
    },
  ];
  res.json({ templates });
});

// POST / — create expert
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { name, domain, description, personality_tone, system_prompt, backend_id, model_override, memory_enabled } = req.body;

  if (!name || !domain) {
    res.status(400).json({ error: 'Name and domain are required' });
    return;
  }
  if (!isWithinLength(name, 1, 100)) {
    res.status(400).json({ error: 'Name must be 1-100 characters' });
    return;
  }
  if (!isWithinLength(domain, 1, 200)) {
    res.status(400).json({ error: 'Domain must be 1-200 characters' });
    return;
  }
  if (description && !isWithinLength(description, 0, 1000)) {
    res.status(400).json({ error: 'Description must be under 1000 characters' });
    return;
  }
  if (system_prompt && !isWithinLength(system_prompt, 0, 10000)) {
    res.status(400).json({ error: 'System prompt must be under 10000 characters' });
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

  if (name !== undefined && !isWithinLength(name, 1, 100)) {
    res.status(400).json({ error: 'Name must be 1-100 characters' });
    return;
  }
  if (domain !== undefined && !isWithinLength(domain, 1, 200)) {
    res.status(400).json({ error: 'Domain must be 1-200 characters' });
    return;
  }
  if (description && !isWithinLength(description, 0, 1000)) {
    res.status(400).json({ error: 'Description must be under 1000 characters' });
    return;
  }
  if (system_prompt && !isWithinLength(system_prompt, 0, 10000)) {
    res.status(400).json({ error: 'System prompt must be under 10000 characters' });
    return;
  }

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

// POST /:id/clone — duplicate an expert
router.post('/:id/clone', (req, res) => {
  const expert = db.prepare('SELECT * FROM experts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!expert) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const tx = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO experts (user_id, name, domain, description, personality_tone, system_prompt, backend_id, model_override, memory_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user!.id, `${expert.name} (copy)`, expert.domain, expert.description,
      expert.personality_tone, expert.system_prompt, expert.backend_id, expert.model_override, expert.memory_enabled
    );
    const newId = result.lastInsertRowid;

    // Clone behaviors
    const behaviors = db.prepare('SELECT behavior_key, enabled FROM expert_behaviors WHERE expert_id = ?').all(req.params.id) as any[];
    const insertBehavior = db.prepare('INSERT INTO expert_behaviors (expert_id, behavior_key, enabled) VALUES (?, ?, ?)');
    for (const b of behaviors) {
      insertBehavior.run(newId, b.behavior_key, b.enabled);
    }

    // Clone category assignments
    const cats = db.prepare('SELECT category_id FROM expert_category_map WHERE expert_id = ?').all(req.params.id) as any[];
    const insertCat = db.prepare('INSERT INTO expert_category_map (expert_id, category_id) VALUES (?, ?)');
    for (const c of cats) {
      insertCat.run(newId, c.category_id);
    }

    return newId;
  });

  const newId = tx();
  const cloned = db.prepare('SELECT * FROM experts WHERE id = ?').get(newId);
  res.status(201).json({ expert: cloned });
});

// POST /:id/suggest-categories — AI-suggested categories
router.post('/:id/suggest-categories', async (req, res) => {
  const expert = db.prepare('SELECT * FROM experts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!expert) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const userSettings = db.prepare('SELECT default_backend_id, default_model FROM settings WHERE user_id = ?')
    .get(req.user!.id) as { default_backend_id: number | null; default_model: string | null } | undefined;

  const backend = resolveBackendConfig(null, userSettings?.default_backend_id, db);
  if (!backend) {
    res.status(400).json({ error: 'No AI backend configured. Please set a default backend in Settings.' });
    return;
  }

  const model = userSettings?.default_model || undefined;

  const existingCats = db.prepare(
    'SELECT name FROM expert_categories WHERE user_id = ?'
  ).all(req.user!.id) as { name: string }[];
  const existingNames = existingCats.map((c) => c.name);

  const prompt = `Given an AI expert with:
- Name: "${expert.name}"
- Domain: "${expert.domain}"
- Description: "${expert.description || 'N/A'}"

And the user's existing categories: ${existingNames.length > 0 ? existingNames.join(', ') : '(none yet)'}

Suggest 3-5 short category names that would be good fits for organizing this expert. Prefer reusing existing categories when they fit. Return ONLY a JSON array of strings, no extra text.`;

  try {
    const raw = await chatCompletion({
      model,
      messages: [
        { role: 'system', content: 'You suggest category labels for organizing AI experts. Return only a JSON array of short category name strings.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      backend,
    });

    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const suggestions = JSON.parse(cleaned);
    if (!Array.isArray(suggestions)) throw new SyntaxError('Expected array');
    res.json({ suggestions: suggestions.map(String).slice(0, 5) });
  } catch (err: any) {
    if (err instanceof SyntaxError) {
      res.status(502).json({ error: 'AI returned invalid JSON. Please try again.' });
      return;
    }
    res.status(502).json({ error: err.message || 'Failed to suggest categories' });
  }
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

  const firstUsed = db.prepare(
    'SELECT MIN(m.created_at) as first_used_at FROM messages m WHERE m.expert_id = ?'
  ).get(req.params.id) as { first_used_at: string | null };
  const lastUsed = db.prepare(
    'SELECT MAX(m.created_at) as last_used_at FROM messages m WHERE m.expert_id = ?'
  ).get(req.params.id) as { last_used_at: string | null };

  const recentConversations = db.prepare(`
    SELECT c.id, c.title,
      (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
      (SELECT MAX(created_at) FROM messages WHERE conversation_id = c.id) as last_message_at
    FROM conversations c
    JOIN conversation_experts ce ON ce.conversation_id = c.id
    WHERE ce.expert_id = ?
    ORDER BY last_message_at DESC
    LIMIT 5
  `).all(req.params.id) as { id: number; title: string; message_count: number; last_message_at: string }[];

  res.json({
    conversation_count: conversationCount.count,
    message_count: messageCount.count,
    first_used_at: firstUsed.first_used_at,
    last_used_at: lastUsed.last_used_at,
    recent_conversations: recentConversations,
  });
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

// GET /:id/export — export expert as JSON
router.get('/:id/export', (req, res) => {
  const expert = db.prepare('SELECT * FROM experts WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!expert) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  const behaviors = db.prepare('SELECT behavior_key, enabled FROM expert_behaviors WHERE expert_id = ?')
    .all(req.params.id) as { behavior_key: string; enabled: number }[];
  const categories = db.prepare(`
    SELECT ec.name FROM expert_categories ec
    JOIN expert_category_map ecm ON ecm.category_id = ec.id
    WHERE ecm.expert_id = ?
  `).all(req.params.id) as { name: string }[];
  const memories = db.prepare('SELECT memory_type, content FROM expert_memories WHERE expert_id = ?')
    .all(req.params.id) as { memory_type: string; content: string }[];

  res.json({
    sage_export_version: 1,
    name: expert.name,
    domain: expert.domain,
    description: expert.description,
    personality_tone: expert.personality_tone,
    system_prompt: expert.system_prompt,
    model_override: expert.model_override,
    memory_enabled: expert.memory_enabled,
    behaviors,
    categories: categories.map((c) => c.name),
    memories,
  });
});

// POST /import — import expert from JSON
router.post('/import', (req, res) => {
  const userId = req.user!.id;
  const { data, strategy } = req.body as { data: any; strategy: 'skip' | 'rename' | 'overwrite' };

  if (!data || !data.name || !data.domain) {
    res.status(400).json({ error: 'Invalid export data: name and domain required' });
    return;
  }

  // Check for existing expert with same name
  const existing = db.prepare('SELECT id FROM experts WHERE name = ? AND user_id = ?')
    .get(data.name, userId) as { id: number } | undefined;

  if (existing && strategy === 'skip') {
    res.json({ message: 'Skipped — expert already exists', expert_id: existing.id });
    return;
  }

  const tx = db.transaction(() => {
    let expertId: number;

    if (existing && strategy === 'overwrite') {
      // Update existing
      db.prepare(`
        UPDATE experts SET domain = ?, description = ?, personality_tone = ?,
          system_prompt = ?, model_override = ?, memory_enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(data.domain, data.description || null, data.personality_tone || 'formal',
        data.system_prompt || null, data.model_override || null, data.memory_enabled ?? 1, existing.id);
      expertId = existing.id;
      // Clear old behaviors and memories for overwrite
      db.prepare('DELETE FROM expert_behaviors WHERE expert_id = ?').run(expertId);
      db.prepare('DELETE FROM expert_memories WHERE expert_id = ?').run(expertId);
    } else {
      // Create new (rename if needed)
      const name = existing ? `${data.name} (imported)` : data.name;
      const result = db.prepare(`
        INSERT INTO experts (user_id, name, domain, description, personality_tone, system_prompt, model_override, memory_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, name, data.domain, data.description || null, data.personality_tone || 'formal',
        data.system_prompt || null, data.model_override || null, data.memory_enabled ?? 1);
      expertId = result.lastInsertRowid as number;
    }

    // Import behaviors
    if (Array.isArray(data.behaviors)) {
      const upsert = db.prepare(`
        INSERT INTO expert_behaviors (expert_id, behavior_key, enabled)
        VALUES (?, ?, ?) ON CONFLICT(expert_id, behavior_key) DO UPDATE SET enabled = excluded.enabled
      `);
      for (const b of data.behaviors) {
        upsert.run(expertId, b.behavior_key, b.enabled ?? 0);
      }
    }

    // Import category assignments (create categories if they don't exist)
    if (Array.isArray(data.categories)) {
      for (const catName of data.categories) {
        let cat = db.prepare('SELECT id FROM expert_categories WHERE name = ? AND user_id = ?')
          .get(catName, userId) as { id: number } | undefined;
        if (!cat) {
          const r = db.prepare('INSERT INTO expert_categories (user_id, name) VALUES (?, ?)').run(userId, catName);
          cat = { id: r.lastInsertRowid as number };
        }
        db.prepare('INSERT OR IGNORE INTO expert_category_map (expert_id, category_id) VALUES (?, ?)').run(expertId, cat.id);
      }
    }

    // Import memories
    if (Array.isArray(data.memories)) {
      const ins = db.prepare('INSERT INTO expert_memories (expert_id, memory_type, content) VALUES (?, ?, ?)');
      for (const m of data.memories) {
        ins.run(expertId, m.memory_type, m.content);
      }
    }

    return expertId;
  });

  const expertId = tx();
  const expert = db.prepare('SELECT * FROM experts WHERE id = ?').get(expertId);
  res.status(201).json({ expert });
});

export default router;
