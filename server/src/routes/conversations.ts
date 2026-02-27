import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../index.js';
import { authenticate } from '../middleware/auth.js';
import { chatCompletion, chatCompletionStream, buildSystemPrompt, resolveBackendConfig } from '../services/ollama.js';

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

const router = Router();
router.use(authenticate);

// GET / — list conversations
router.get('/', (req, res) => {
  const userId = req.user!.id;
  const conversations = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM conversation_experts ce WHERE ce.conversation_id = c.id) as expert_count,
      (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
    FROM conversations c
    WHERE c.user_id = ?
    ORDER BY c.updated_at DESC
  `).all(userId);
  res.json({ conversations });
});

// POST / — create conversation
router.post('/', (req, res) => {
  const userId = req.user!.id;
  const { title, type } = req.body;

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

  const messages = db.prepare(`
    SELECT m.*, e.name as expert_name
    FROM messages m
    LEFT JOIN experts e ON e.id = m.expert_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `).all(req.params.id);

  const documents = db.prepare('SELECT * FROM documents WHERE conversation_id = ? ORDER BY created_at DESC')
    .all(req.params.id);

  res.json({ conversation, experts, messages, documents });
});

// PUT /:id — update conversation
router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user!.id);
  if (!existing) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const { title, expert_debate_enabled, auto_suggest_experts } = req.body;

  db.prepare(`
    UPDATE conversations SET
      title = COALESCE(?, title),
      expert_debate_enabled = COALESCE(?, expert_debate_enabled),
      auto_suggest_experts = COALESCE(?, auto_suggest_experts),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?
  `).run(
    title ?? null,
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
      const messages = [
        { role: 'system' as const, content: 'You are a helpful AI assistant.' },
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
      const messages = [
        { role: 'system' as const, content: 'You are a helpful AI assistant.' },
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

  const systemPrompt = buildSystemPrompt(expert, enabledBehaviors, memories);

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

  const systemPrompt = buildSystemPrompt(expert, enabledBehaviors, memories);

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

  const result = db.prepare(`
    INSERT INTO documents (conversation_id, filename, file_type, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, req.file.originalname, req.file.mimetype, req.file.filename, req.file.size);

  const document = db.prepare('SELECT * FROM documents WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ document });
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
