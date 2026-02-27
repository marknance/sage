import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { chatCompletion, chatCompletionStream, buildSystemPrompt, resolveBackendConfig } from '../services/ollama.js';
import { isWithinLength } from '../lib/validate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}-${file.originalname}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

const TYPE_PROMPTS: Record<string, string> = {
  research: 'Focus on accuracy, cite sources, and provide well-researched answers. ',
  brainstorm: 'Be creative and generate multiple ideas. Explore unconventional approaches. ',
  debug: 'Help debug the issue step by step. Ask for error messages and reproduce steps. ',
};

const router = Router();
router.use(authenticate);

// GET / — list conversations
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const { search, sort, type, pinned } = req.query;

  let query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM conversation_experts ce WHERE ce.conversation_id = c.id) as expert_count,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
      (SELECT m2.content FROM messages m2 WHERE m2.conversation_id = c.id ORDER BY m2.created_at DESC LIMIT 1) as last_message
    FROM conversations c
    WHERE c.user_id = ?
  `;
  const params: any[] = [userId];

  if (search && typeof search === 'string') {
    const term = `%${search}%`;
    query += ` AND (c.title LIKE ? OR EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.content LIKE ?))`;
    params.push(term, term);
  }

  if (type && typeof type === 'string') {
    query += ' AND c.type = ?';
    params.push(type);
  }

  if (pinned === '1') {
    query += ' AND c.is_pinned = 1';
  }

  if (sort === 'title') {
    query += ` ORDER BY c.is_pinned DESC, c.title ASC`;
  } else if (sort === 'created') {
    query += ` ORDER BY c.is_pinned DESC, c.created_at DESC`;
  } else {
    query += ` ORDER BY c.is_pinned DESC, c.updated_at DESC`;
  }

  // Count total before pagination
  const countQuery = query.replace(/SELECT c\.\*[\s\S]*?FROM conversations c/, 'SELECT COUNT(*) as total FROM conversations c');
  const countResult = db.prepare(countQuery.replace(/ORDER BY.*$/, '')).get(...params) as { total: number };
  const total = countResult.total;

  const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  query += ` LIMIT ? OFFSET ?`;

  const conversations = db.prepare(query).all(...params, limit, offset);
  res.json({ conversations, total, limit, offset });
});

// POST / — create conversation
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { title, type } = req.body;

  if (title && !isWithinLength(title, 1, 200)) {
    res.status(400).json({ error: 'Title must be 1-200 characters' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO conversations (user_id, title, type)
    VALUES (?, ?, ?)
  `).run(userId, title || 'New Conversation', type || 'standard');

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ conversation });
});

// GET /:id — detail
router.get('/:id', (req, res) => {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const experts = db.prepare(`
    SELECT e.*, ce.id as assignment_id, ce.backend_override_id, ce.model_override as conv_model_override
    FROM conversation_experts ce
    JOIN experts e ON e.id = ce.expert_id
    WHERE ce.conversation_id = ?
  `).all(req.params.id);

  // Cursor-based message pagination: get newest `limit` messages, optionally before a message ID
  const msgLimit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const before = req.query.before ? Number(req.query.before) : null;

  let msgQuery = `
    SELECT m.*, e.name as expert_name
    FROM messages m
    LEFT JOIN experts e ON e.id = m.expert_id
    WHERE m.conversation_id = ?
  `;
  const msgParams: any[] = [req.params.id];
  if (before) {
    msgQuery += ` AND m.id < ?`;
    msgParams.push(before);
  }
  msgQuery += ` ORDER BY m.id DESC LIMIT ?`;
  msgParams.push(msgLimit + 1); // fetch one extra to detect hasMore

  const rawMessages = db.prepare(msgQuery).all(...msgParams) as any[];
  const hasMore = rawMessages.length > msgLimit;
  if (hasMore) rawMessages.pop();
  const messages = rawMessages.reverse(); // restore ASC order

  const documents = db.prepare('SELECT * FROM documents WHERE conversation_id = ? ORDER BY created_at DESC')
    .all(req.params.id);

  res.json({ conversation, experts, messages, documents, hasMore });
});

// GET /:id/export — export conversation
router.get('/:id/export', (req, res) => {
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = db.prepare(`
    SELECT m.*, e.name as expert_name
    FROM messages m
    LEFT JOIN experts e ON e.id = m.expert_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id) as any[];

  const documents = db.prepare('SELECT id, filename, file_type, file_size, created_at FROM documents WHERE conversation_id = ?')
    .all(req.params.id);

  const experts = db.prepare(`
    SELECT e.name, e.domain
    FROM conversation_experts ce
    JOIN experts e ON e.id = ce.expert_id
    WHERE ce.conversation_id = ?
  `).all(req.params.id);

  const format = req.query.format;

  if (format === 'md') {
    let md = `# ${conversation.title}\n\n`;
    md += `**Type:** ${conversation.type} | **Created:** ${conversation.created_at}\n\n`;
    if ((experts as any[]).length > 0) {
      md += `**Experts:** ${(experts as any[]).map((e: any) => e.name).join(', ')}\n\n`;
    }
    md += `---\n\n`;
    for (const msg of messages) {
      const speaker = msg.role === 'user' ? 'You' : (msg.expert_name || 'Assistant');
      const time = new Date(msg.created_at).toLocaleString();
      md += `### ${speaker} — ${time}\n\n${msg.content}\n\n`;
    }
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${conversation.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.md"`);
    res.send(md);
  } else {
    res.json({
      title: conversation.title,
      type: conversation.type,
      created_at: conversation.created_at,
      messages,
      documents,
      experts,
    });
  }
});

// PUT /:id — update conversation
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { title, type, expert_debate_enabled, auto_suggest_experts } = req.body;

  db.prepare(`
    UPDATE conversations SET
      title = COALESCE(?, title),
      type = COALESCE(?, type),
      expert_debate_enabled = COALESCE(?, expert_debate_enabled),
      auto_suggest_experts = COALESCE(?, auto_suggest_experts),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    title ?? null,
    type ?? null,
    expert_debate_enabled ?? null,
    auto_suggest_experts ?? null,
    req.params.id,
    req.user!.id
  );

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  res.json({ conversation });
});

// DELETE /:id — delete conversation
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?')
    .run(req.params.id, req.user!.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  res.json({ message: 'Conversation deleted' });
});

// POST /bulk-delete — delete multiple conversations
router.post('/bulk-delete', (req, res) => {
  const userId = req.user!.id;
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids must be a non-empty array' });
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(
    `DELETE FROM conversations WHERE id IN (${placeholders}) AND user_id = ?`
  ).run(...ids, userId);

  res.json({ deleted: result.changes });
});

// PATCH /:id/pin — toggle pinned status
router.patch('/:id/pin', (req, res) => {
  const conversation = db.prepare('SELECT id, is_pinned FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id) as any;
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const newValue = conversation.is_pinned ? 0 : 1;
  db.prepare('UPDATE conversations SET is_pinned = ? WHERE id = ?').run(newValue, req.params.id);
  const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
  res.json({ conversation: updated });
});

// POST /:id/experts — assign expert
router.post('/:id/experts', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { expert_id } = req.body;
  if (!expert_id) {
    res.status(400).json({ error: 'expert_id is required' });
    return;
  }

  // Verify expert belongs to user
  const expert = db.prepare('SELECT id FROM experts WHERE id = ? AND user_id = ?')
    .get(expert_id, req.user!.id);
  if (!expert) {
    res.status(404).json({ error: 'Expert not found' });
    return;
  }

  // Check if already assigned
  const existing = db.prepare('SELECT id FROM conversation_experts WHERE conversation_id = ? AND expert_id = ?')
    .get(req.params.id, expert_id);
  if (existing) {
    res.status(409).json({ error: 'Expert already assigned' });
    return;
  }

  db.prepare('INSERT INTO conversation_experts (conversation_id, expert_id) VALUES (?, ?)')
    .run(req.params.id, expert_id);

  const experts = db.prepare(`
    SELECT e.*, ce.id as assignment_id, ce.backend_override_id, ce.model_override as conv_model_override
    FROM conversation_experts ce
    JOIN experts e ON e.id = ce.expert_id
    WHERE ce.conversation_id = ?
  `).all(req.params.id);

  res.status(201).json({ experts });
});

// DELETE /:id/experts/:expertId — remove expert
router.delete('/:id/experts/:expertId', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const result = db.prepare('DELETE FROM conversation_experts WHERE conversation_id = ? AND expert_id = ?')
    .run(req.params.id, req.params.expertId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Expert not assigned' });
    return;
  }

  const experts = db.prepare(`
    SELECT e.*, ce.id as assignment_id, ce.backend_override_id, ce.model_override as conv_model_override
    FROM conversation_experts ce
    JOIN experts e ON e.id = ce.expert_id
    WHERE ce.conversation_id = ?
  `).all(req.params.id);

  res.json({ experts });
});

// PUT /:id/experts/:expertId — update conversation-expert overrides
router.put('/:id/experts/:expertId', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const existing = db.prepare('SELECT id FROM conversation_experts WHERE conversation_id = ? AND expert_id = ?')
    .get(req.params.id, req.params.expertId) as any;
  if (!existing) {
    res.status(404).json({ error: 'Expert not assigned' });
    return;
  }

  const { backend_override_id, model_override } = req.body;

  db.prepare(`
    UPDATE conversation_experts SET
      backend_override_id = ?,
      model_override = ?
    WHERE id = ?
  `).run(
    backend_override_id !== undefined ? (backend_override_id || null) : null,
    model_override !== undefined ? (model_override || null) : null,
    existing.id
  );

  const experts = db.prepare(`
    SELECT e.*, ce.id as assignment_id, ce.backend_override_id, ce.model_override as conv_model_override
    FROM conversation_experts ce
    JOIN experts e ON e.id = ce.expert_id
    WHERE ce.conversation_id = ?
  `).all(req.params.id);

  res.json({ experts });
});

// GET /:id/messages — list messages
router.get('/:id/messages', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = db.prepare(`
    SELECT m.*, e.name as expert_name
    FROM messages m
    LEFT JOIN experts e ON e.id = m.expert_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);

  res.json({ messages });
});

// PUT /:id/messages/:msgId — edit message (user messages only)
router.put('/:id/messages/:msgId', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND conversation_id = ?')
    .get(req.params.msgId, req.params.id) as any;
  if (!msg) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }
  if (msg.role !== 'user') {
    res.status(403).json({ error: 'Only user messages can be edited' });
    return;
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    res.status(400).json({ error: 'content is required' });
    return;
  }

  db.prepare('UPDATE messages SET content = ? WHERE id = ?').run(content, req.params.msgId);
  const updated = db.prepare('SELECT m.*, e.name as expert_name FROM messages m LEFT JOIN experts e ON e.id = m.expert_id WHERE m.id = ?')
    .get(req.params.msgId);
  res.json({ message: updated });
});

// DELETE /:id/messages/:msgId — delete message
router.delete('/:id/messages/:msgId', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const result = db.prepare('DELETE FROM messages WHERE id = ? AND conversation_id = ?')
    .run(req.params.msgId, req.params.id);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  res.json({ message: 'Message deleted' });
});

// POST /:id/messages/stream — SSE streaming response
router.post('/:id/messages/stream', async (req, res) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Abort controller for cancellation on client disconnect
  const abortController = new AbortController();
  let disconnected = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      disconnected = true;
      abortController.abort();
    }
  });

  try {
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as any;
    if (!conversation) {
      sendEvent('error', { message: 'Conversation not found' });
      sendEvent('done', {});
      res.end();
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      sendEvent('error', { message: 'content is required' });
      sendEvent('done', {});
      res.end();
      return;
    }

    // Save user message
    const userResult = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
      .run(req.params.id, 'user', content);
    const userMsg = db.prepare('SELECT * FROM messages WHERE id = ?').get(userResult.lastInsertRowid);
    sendEvent('user_message', userMsg);

    // Get assigned experts with conversation-level overrides
    const assignedExperts = db.prepare(`
      SELECT e.*, ce.backend_override_id, ce.model_override as conv_model_override
      FROM conversation_experts ce
      JOIN experts e ON e.id = ce.expert_id
      WHERE ce.conversation_id = ?
    `).all(req.params.id) as any[];

    if (assignedExperts.length === 0) {
      // No experts — default assistant
      sendEvent('expert_start', { expert_id: null, expert_name: null, message_index: 0 });

      const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
        .all(req.params.id) as { role: string; content: string }[];
      const docContext = getDocumentContext(req.params.id);
      const messages = [
        { role: 'system' as const, content: getTypePrefix(conversation.type) + 'You are a helpful AI assistant.' + docContext },
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      const userSettings = db.prepare('SELECT default_backend_id FROM settings WHERE user_id = ?')
        .get(req.user!.id) as { default_backend_id: number | null } | undefined;
      const defaultBackend = resolveBackendConfig(null, userSettings?.default_backend_id, db);

      let fullContent = '';
      for await (const token of chatCompletionStream({ messages, backend: defaultBackend, signal: abortController.signal })) {
        if (disconnected) break;
        fullContent += token;
        sendEvent('token', { content: token });
      }

      if (!disconnected) {
        const result = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
          .run(req.params.id, 'assistant', fullContent);
        const saved = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
        sendEvent('expert_end', saved);

        if (conversation.auto_suggest_experts) {
          const suggested = findSuggestedExperts(req.user!.id, content, assignedExperts);
          if (suggested.length > 0) sendEvent('suggested_experts', { experts: suggested });
        }
      }
    } else if (!conversation.expert_debate_enabled) {
      // Single expert
      const expert = assignedExperts[0];
      sendEvent('expert_start', { expert_id: expert.id, expert_name: expert.name, message_index: 0 });

      const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
        .all(req.params.id) as { role: string; content: string }[];

      let fullContent = '';
      for await (const token of getExpertResponseStream(expert, history, req.params.id, req.user!.id, abortController.signal)) {
        if (disconnected) break;
        fullContent += token;
        sendEvent('token', { content: token });
      }

      if (!disconnected) {
        const result = db.prepare('INSERT INTO messages (conversation_id, expert_id, role, content) VALUES (?, ?, ?, ?)')
          .run(req.params.id, expert.id, 'assistant', fullContent);
        const saved = db.prepare('SELECT m.*, e.name as expert_name FROM messages m LEFT JOIN experts e ON e.id = m.expert_id WHERE m.id = ?')
          .get(result.lastInsertRowid);
        sendEvent('expert_end', saved);
        db.prepare('UPDATE experts SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(expert.id);
      }
    } else {
      // Debate mode — each expert responds sequentially
      for (let i = 0; i < assignedExperts.length; i++) {
        if (disconnected) break;
        const expert = assignedExperts[i];
        sendEvent('expert_start', { expert_id: expert.id, expert_name: expert.name, message_index: i });

        const currentHistory = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
          .all(req.params.id) as { role: string; content: string }[];

        let fullContent = '';
        for await (const token of getExpertResponseStream(expert, currentHistory, req.params.id, req.user!.id, abortController.signal)) {
          if (disconnected) break;
          fullContent += token;
          sendEvent('token', { content: token });
        }

        if (!disconnected) {
          const result = db.prepare('INSERT INTO messages (conversation_id, expert_id, role, content) VALUES (?, ?, ?, ?)')
            .run(req.params.id, expert.id, 'assistant', fullContent);
          const saved = db.prepare('SELECT m.*, e.name as expert_name FROM messages m LEFT JOIN experts e ON e.id = m.expert_id WHERE m.id = ?')
            .get(result.lastInsertRowid);
          sendEvent('expert_end', saved);
          db.prepare('UPDATE experts SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(expert.id);
        }
      }
    }

    if (!disconnected) {
      db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
      sendEvent('done', {});

      // Async memory extraction for memory-enabled experts
      for (const expert of assignedExperts) {
        if (expert.memory_enabled) {
          extractMemories(expert, Number(req.params.id), req.user!.id).catch((err) =>
            console.error('Memory extraction failed:', err.message)
          );
        }
      }
    }
    res.end();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // Client disconnected — expected, no action needed
      res.end();
      return;
    }
    console.error('Stream error:', err.message);
    try {
      sendEvent('error', { message: 'Failed to get AI response. Is the backend running?' });
      sendEvent('done', {});
    } catch {
      // Response may already be closed
    }
    res.end();
  }
});

// POST /:id/messages — send message + get AI response
router.post('/:id/messages', async (req, res) => {
  try {
    const conversation = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user!.id) as any;
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const { content } = req.body;
    if (!content || typeof content !== 'string') {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Save user message
    db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
      .run(req.params.id, 'user', content);

    // Get assigned experts with conversation-level overrides
    const assignedExperts = db.prepare(`
      SELECT e.*, ce.backend_override_id, ce.model_override as conv_model_override
      FROM conversation_experts ce
      JOIN experts e ON e.id = ce.expert_id
      WHERE ce.conversation_id = ?
    `).all(req.params.id) as any[];

    // Get conversation history for context
    const history = db.prepare(`
      SELECT role, content FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `).all(req.params.id) as { role: string; content: string }[];

    const responseMessages: any[] = [];
    let suggestedExperts: any[] = [];

    if (assignedExperts.length === 0) {
      // No experts — default assistant response
      const docContext = getDocumentContext(req.params.id);
      const messages = [
        { role: 'system' as const, content: getTypePrefix(conversation.type) + 'You are a helpful AI assistant.' + docContext },
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];

      // Resolve default backend for no-expert responses
      const userSettings = db.prepare('SELECT default_backend_id FROM settings WHERE user_id = ?')
        .get(req.user!.id) as { default_backend_id: number | null } | undefined;
      const defaultBackend = resolveBackendConfig(null, userSettings?.default_backend_id, db);

      const reply = await chatCompletion({ messages, backend: defaultBackend });

      const result = db.prepare('INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)')
        .run(req.params.id, 'assistant', reply);
      const saved = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      responseMessages.push(saved);

      // Auto-suggest if enabled
      if (conversation.auto_suggest_experts) {
        suggestedExperts = findSuggestedExperts(req.user!.id, content, assignedExperts);
      }
    } else if (!conversation.expert_debate_enabled) {
      // Single expert responds (first assigned)
      const expert = assignedExperts[0];
      const reply = await getExpertResponse(expert, history, req.params.id, req.user!.id);

      const result = db.prepare('INSERT INTO messages (conversation_id, expert_id, role, content) VALUES (?, ?, ?, ?)')
        .run(req.params.id, expert.id, 'assistant', reply);
      const saved = db.prepare('SELECT m.*, e.name as expert_name FROM messages m LEFT JOIN experts e ON e.id = m.expert_id WHERE m.id = ?')
        .get(result.lastInsertRowid);
      responseMessages.push(saved);

      // Update last_used_at
      db.prepare('UPDATE experts SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(expert.id);
    } else {
      // Debate mode — each expert responds sequentially
      for (const expert of assignedExperts) {
        // Re-fetch history to include previous expert responses in this round
        const currentHistory = db.prepare(`
          SELECT role, content FROM messages
          WHERE conversation_id = ?
          ORDER BY created_at ASC
        `).all(req.params.id) as { role: string; content: string }[];

        const reply = await getExpertResponse(expert, currentHistory, req.params.id, req.user!.id);

        const result = db.prepare('INSERT INTO messages (conversation_id, expert_id, role, content) VALUES (?, ?, ?, ?)')
          .run(req.params.id, expert.id, 'assistant', reply);
        const saved = db.prepare('SELECT m.*, e.name as expert_name FROM messages m LEFT JOIN experts e ON e.id = m.expert_id WHERE m.id = ?')
          .get(result.lastInsertRowid);
        responseMessages.push(saved);

        db.prepare('UPDATE experts SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?').run(expert.id);
      }
    }

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);

    res.json({ messages: responseMessages, suggestedExperts });
  } catch (err: any) {
    console.error('Message error:', err.message);
    res.status(500).json({ error: 'Failed to get AI response. Is Ollama running?' });
  }
});

async function getExpertResponse(
  expert: any,
  history: { role: string; content: string }[],
  conversationId: string,
  userId: number
): Promise<string> {
  const behaviors = db.prepare('SELECT behavior_key FROM expert_behaviors WHERE expert_id = ? AND enabled = 1')
    .all(expert.id) as { behavior_key: string }[];
  const enabledBehaviors = behaviors.map((b) => b.behavior_key);

  const memoriesRows = expert.memory_enabled
    ? db.prepare('SELECT content FROM expert_memories WHERE expert_id = ? ORDER BY created_at DESC LIMIT 10')
        .all(expert.id) as { content: string }[]
    : [];
  const memories = memoriesRows.map((m) => m.content);

  const systemPrompt = buildSystemPrompt(expert, enabledBehaviors, memories) + getDocumentContext(conversationId);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  // Resolve backend: conversation override → expert → user default → env fallback
  const userSettings = db.prepare('SELECT default_backend_id FROM settings WHERE user_id = ?')
    .get(userId) as { default_backend_id: number | null } | undefined;
  const backendId = expert.backend_override_id || expert.backend_id;
  const backend = resolveBackendConfig(backendId, userSettings?.default_backend_id, db);

  // Model priority: conversation override → expert setting → default
  const model = expert.conv_model_override || expert.model_override || undefined;

  return chatCompletion({ messages, model, backend });
}

function getExpertResponseStream(
  expert: any,
  history: { role: string; content: string }[],
  conversationId: string,
  userId: number,
  signal: AbortSignal
): AsyncGenerator<string, void, undefined> {
  const behaviors = db.prepare('SELECT behavior_key FROM expert_behaviors WHERE expert_id = ? AND enabled = 1')
    .all(expert.id) as { behavior_key: string }[];
  const enabledBehaviors = behaviors.map((b) => b.behavior_key);

  const memoriesRows = expert.memory_enabled
    ? db.prepare('SELECT content FROM expert_memories WHERE expert_id = ? ORDER BY created_at DESC LIMIT 10')
        .all(expert.id) as { content: string }[]
    : [];
  const memories = memoriesRows.map((m) => m.content);

  const systemPrompt = buildSystemPrompt(expert, enabledBehaviors, memories) + getDocumentContext(conversationId);

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const userSettings = db.prepare('SELECT default_backend_id FROM settings WHERE user_id = ?')
    .get(userId) as { default_backend_id: number | null } | undefined;
  const backendId = expert.backend_override_id || expert.backend_id;
  const backend = resolveBackendConfig(backendId, userSettings?.default_backend_id, db);
  const model = expert.conv_model_override || expert.model_override || undefined;

  return chatCompletionStream({ messages, model, backend, signal });
}

function getTypePrefix(type: string): string {
  return TYPE_PROMPTS[type] || '';
}

function getDocumentContext(conversationId: string): string {
  const docs = db.prepare(
    'SELECT filename, extracted_text FROM documents WHERE conversation_id = ? AND extracted_text IS NOT NULL'
  ).all(conversationId) as { filename: string; extracted_text: string }[];
  if (docs.length === 0) return '';
  const parts = docs.map((d) => `[Document: ${d.filename}]\n${d.extracted_text}`);
  return '\n\nReference documents:\n' + parts.join('\n\n');
}

async function extractMemories(expert: any, conversationId: number, userId: number): Promise<void> {
  // Get the last few messages from the conversation
  const recentMessages = db.prepare(`
    SELECT role, content FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at DESC
    LIMIT 6
  `).all(conversationId) as { role: string; content: string }[];

  if (recentMessages.length < 2) return;

  const reversed = recentMessages.reverse();
  const conversationText = reversed.map((m) => `${m.role}: ${m.content}`).join('\n\n');

  const extractionPrompt = `Analyze this conversation and extract key facts, preferences, or important information that should be remembered about the user for future conversations. Return ONLY a JSON array of short fact strings. If no memorable facts, return [].

Conversation:
${conversationText}

Return JSON array only:`;

  const userSettings = db.prepare('SELECT default_backend_id FROM settings WHERE user_id = ?')
    .get(userId) as { default_backend_id: number | null } | undefined;
  const backendId = expert.backend_override_id || expert.backend_id;
  const backend = resolveBackendConfig(backendId, userSettings?.default_backend_id, db);

  try {
    const response = await chatCompletion({
      messages: [{ role: 'user', content: extractionPrompt }],
      backend,
    });

    // Parse the JSON array from the response
    const jsonMatch = response.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return;

    const facts = JSON.parse(jsonMatch[0]) as string[];
    if (!Array.isArray(facts) || facts.length === 0) return;

    const insertStmt = db.prepare(
      'INSERT INTO expert_memories (expert_id, memory_type, content, source_conversation_id) VALUES (?, ?, ?, ?)'
    );

    for (const fact of facts.slice(0, 5)) {
      if (typeof fact === 'string' && fact.trim().length > 0) {
        insertStmt.run(expert.id, 'extracted', fact.trim(), conversationId);
      }
    }
  } catch (err) {
    // Extraction is best-effort, don't fail the conversation
    throw err;
  }
}

function findSuggestedExperts(userId: number, messageContent: string, excludeExperts: any[]): any[] {
  const excludeIds = excludeExperts.map((e) => e.id);
  const allExperts = db.prepare('SELECT * FROM experts WHERE user_id = ?').all(userId) as any[];

  const lowerContent = messageContent.toLowerCase();
  return allExperts.filter((e) => {
    if (excludeIds.includes(e.id)) return false;
    const domain = (e.domain || '').toLowerCase();
    const keywords = domain.split(/[\s,;/]+/);
    return keywords.some((kw: string) => kw.length > 2 && lowerContent.includes(kw));
  });
}

// POST /:id/documents — upload file
router.post('/:id/documents', upload.single('file'), (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  // Extract text for supported file types
  const textExtensions = ['.txt', '.md', '.csv', '.json', '.xml', '.html', '.log'];
  const ext = path.extname(req.file.originalname).toLowerCase();
  let extractedText: string | null = null;
  if (textExtensions.includes(ext)) {
    try {
      const filePath = path.join(uploadsDir, req.file.filename);
      const raw = fs.readFileSync(filePath, 'utf-8');
      extractedText = raw.slice(0, 10_000);
    } catch {
      // Extraction failed — leave null
    }
  }

  const result = db.prepare(`
    INSERT INTO documents (conversation_id, filename, file_type, file_path, file_size, extracted_text)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.params.id, req.file.originalname, req.file.mimetype, req.file.filename, req.file.size, extractedText);

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ document });
});

// GET /:id/documents/:docId/download — download document
router.get('/:id/documents/:docId/download', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND conversation_id = ?')
    .get(req.params.docId, req.params.id) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  const filePath = path.join(uploadsDir, doc.file_path);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found on disk' });
    return;
  }

  res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
  res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
  fs.createReadStream(filePath).pipe(res);
});

// DELETE /:id/documents/:docId — delete document
router.delete('/:id/documents/:docId', (req, res) => {
  const conversation = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ? AND conversation_id = ?')
    .get(req.params.docId, req.params.id) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  // Remove file from disk
  const filePath = path.join(uploadsDir, doc.file_path);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may already be deleted
  }

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.docId);
  res.json({ message: 'Document deleted' });
});

export default router;
