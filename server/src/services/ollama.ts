import axios from 'axios';
import type { Database as DatabaseType } from 'better-sqlite3';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma3:latest';
const MAX_CONTEXT_MESSAGES = 30;
const TIMEOUT_MS = 120_000;

export interface BackendConfig {
  base_url: string;
  api_key?: string | null;
  org_id?: string | null;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  backend?: BackendConfig;
}

interface ChatCompletionResponse {
  choices: { message: { role: string; content: string } }[];
}

export function buildSystemPrompt(
  expert: { system_prompt?: string | null; personality_tone?: string; name: string; domain: string },
  enabledBehaviors: string[],
  memories: string[]
): string {
  const parts: string[] = [];

  if (expert.system_prompt) {
    parts.push(expert.system_prompt);
  } else {
    parts.push(`You are ${expert.name}, an expert in ${expert.domain}.`);
  }

  if (expert.personality_tone && expert.personality_tone !== 'formal') {
    parts.push(`Respond in a ${expert.personality_tone} tone.`);
  }

  if (enabledBehaviors.length > 0) {
    const behaviorMap: Record<string, string> = {
      cite_sources: 'Cite sources when possible.',
      ask_clarifying_questions: 'Ask clarifying questions when the request is ambiguous.',
      provide_examples: 'Provide concrete examples to illustrate points.',
      use_analogies: 'Use analogies to explain complex concepts.',
      summarize_responses: 'End responses with a brief summary.',
    };
    const instructions = enabledBehaviors
      .map((b) => behaviorMap[b])
      .filter(Boolean);
    if (instructions.length > 0) {
      parts.push('Behavioral instructions: ' + instructions.join(' '));
    }
  }

  if (memories.length > 0) {
    parts.push('Relevant memories from past conversations:\n- ' + memories.join('\n- '));
  }

  return parts.join('\n\n');
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<string> {
  const { model = DEFAULT_MODEL, messages, temperature = 0.7, backend } = options;

  // Limit context window
  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const trimmed = nonSystem.slice(-MAX_CONTEXT_MESSAGES);
  const finalMessages = [...systemMessages, ...trimmed];

  const baseUrl = backend?.base_url || OLLAMA_BASE_URL;
  const headers: Record<string, string> = {};
  if (backend?.api_key) {
    headers['Authorization'] = `Bearer ${backend.api_key}`;
  }
  if (backend?.org_id) {
    headers['OpenAI-Organization'] = backend.org_id;
  }

  const { data } = await axios.post<ChatCompletionResponse>(
    `${baseUrl}/v1/chat/completions`,
    {
      model,
      messages: finalMessages,
      temperature,
    },
    { timeout: TIMEOUT_MS, headers }
  );

  return data.choices[0]?.message?.content ?? '';
}

export function resolveBackendConfig(
  expertBackendId: number | null | undefined,
  userDefaultBackendId: number | null | undefined,
  database: DatabaseType
): BackendConfig | undefined {
  const backendId = expertBackendId || userDefaultBackendId;
  if (!backendId) return undefined;

  const row = database.prepare('SELECT base_url, api_key, org_id FROM ai_backends WHERE id = ? AND is_active = 1')
    .get(backendId) as { base_url: string; api_key: string | null; org_id: string | null } | undefined;

  if (!row || !row.base_url) return undefined;

  return {
    base_url: row.base_url,
    api_key: row.api_key,
    org_id: row.org_id,
  };
}
