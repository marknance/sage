import axios from 'axios';
import type { Database as DatabaseType } from 'better-sqlite3';
import { decrypt } from './encryption.js';
import logger from './logger.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma3:latest';
const MAX_CONTEXT_MESSAGES = 30;
const TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;

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
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export interface UsageInfo {
  prompt_tokens?: number;
  completion_tokens?: number;
  model?: string;
}

export interface StreamChunk {
  type: 'token' | 'usage';
  content?: string;
  usage?: UsageInfo;
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

function isRetryableError(err: any): boolean {
  if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') return true;
  const status = err.response?.status;
  return status !== undefined && status >= 500;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (!isRetryableError(err) || attempt === MAX_RETRIES - 1) throw err;
      const delay = Math.pow(2, attempt) * 1000;
      logger.warn({ attempt: attempt + 1, delay, err: err.message }, 'Retrying AI request');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

export async function* chatCompletionStream(
  options: ChatCompletionOptions & { signal?: AbortSignal }
): AsyncGenerator<StreamChunk, void, undefined> {
  const { model = DEFAULT_MODEL, messages, temperature = 0.7, backend, signal } = options;

  const systemMessages = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');
  const trimmed = nonSystem.slice(-MAX_CONTEXT_MESSAGES);
  const finalMessages = [...systemMessages, ...trimmed];

  const baseUrl = backend?.base_url || OLLAMA_BASE_URL;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (backend?.api_key) {
    headers['Authorization'] = `Bearer ${backend.api_key}`;
  }
  if (backend?.org_id) {
    headers['OpenAI-Organization'] = backend.org_id;
  }

  const { data: stream } = await withRetry(() => axios.post(
    `${baseUrl}/v1/chat/completions`,
    {
      model,
      messages: finalMessages,
      temperature,
      stream: true,
      stream_options: { include_usage: true },
    },
    {
      headers,
      responseType: 'stream',
      timeout: TIMEOUT_MS,
      signal,
    }
  ));

  let buffer = '';

  for await (const chunk of stream) {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;
      const payload = trimmedLine.slice(6);
      if (payload === '[DONE]') return;
      try {
        const parsed = JSON.parse(payload);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) yield { type: 'token', content };
        // Capture usage from final chunk
        if (parsed.usage) {
          yield {
            type: 'usage',
            usage: {
              prompt_tokens: parsed.usage.prompt_tokens,
              completion_tokens: parsed.usage.completion_tokens,
              model,
            },
          };
        }
      } catch {
        // skip malformed JSON lines
      }
    }
  }
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

  const { data } = await withRetry(() => axios.post<ChatCompletionResponse>(
    `${baseUrl}/v1/chat/completions`,
    {
      model,
      messages: finalMessages,
      temperature,
    },
    { timeout: TIMEOUT_MS, headers }
  ));

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
    api_key: decrypt(row.api_key),
    org_id: row.org_id,
  };
}
