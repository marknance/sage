import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { marked } from 'marked';
import { useDropzone } from 'react-dropzone';
import { api } from '../lib/api';
import { useConversationStore, type Message } from '../stores/conversationStore';
import { useExpertStore, type Expert } from '../stores/expertStore';
import { useBackendStore } from '../stores/backendStore';
import { useThemeStore } from '../stores/themeStore';
import { toast } from '../stores/toastStore';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import bash from 'highlight.js/lib/languages/bash';
import markdown from 'highlight.js/lib/languages/markdown';
import 'highlight.js/styles/github-dark.css';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('markdown', markdown);

function getLanguageFromExt(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python',
    json: 'json',
    xml: 'xml', html: 'html', htm: 'html', svg: 'xml',
    css: 'css', scss: 'css',
    sql: 'sql',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    md: 'markdown',
    log: 'bash',
  };
  return ext ? (map[ext] || null) : null;
}

// Cache for message heights and parsed HTML
const heightCache = new Map<number, number>();
const htmlCache = new Map<string, string>();

function parseMarkdown(content: string): string {
  const cached = htmlCache.get(content);
  if (cached) return cached;
  const html = marked.parse(content || '') as string;
  htmlCache.set(content, html);
  return html;
}

const LazyMessage = memo(function LazyMessage({
  msg,
  isStreaming,
  isDark,
  onEdit,
  onDelete,
  onRetry,
}: {
  msg: Message;
  isStreaming: boolean;
  isDark: boolean;
  onEdit?: (msgId: number, content: string) => void;
  onDelete?: (msgId: number) => void;
  onRetry?: (content: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const isStreamingMsg = isStreaming && msg.id < 0 && msg.role === 'assistant';
  const isReal = msg.id > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el || isStreamingMsg) {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (!entry.isIntersecting && el.offsetHeight > 0) {
          heightCache.set(msg.id, el.offsetHeight);
        }
      },
      { rootMargin: '200px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [msg.id, isStreamingMsg]);

  const cachedHeight = heightCache.get(msg.id);

  if (!isVisible && cachedHeight) {
    return (
      <div
        ref={ref}
        style={{ height: cachedHeight }}
        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[75%] rounded-xl px-4 py-3 relative ${
          msg.role === 'user'
            ? 'bg-primary/20 text-text-primary'
            : 'bg-surface border border-border text-text-primary'
        }`}
      >
        {msg.role === 'assistant' && msg.expert_name && (
          <p className="text-xs font-medium text-primary mb-1">{msg.expert_name}</p>
        )}
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full px-2 py-1 rounded bg-background border border-border text-text-primary text-sm resize-none focus:outline-none focus:border-primary"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIsEditing(false)} className="text-xs text-text-muted hover:text-text-primary">Cancel</button>
              <button
                onClick={() => { onEdit?.(msg.id, editContent); setIsEditing(false); }}
                className="text-xs text-primary hover:underline"
              >
                Save
              </button>
            </div>
          </div>
        ) : isVisible ? (
          <div
            className={`prose prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 ${isDark ? 'prose-invert' : ''}`}
            dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.content) }}
          />
        ) : (
          <div className="text-sm text-text-muted">...</div>
        )}
        {isStreamingMsg && (
          <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-text-muted">
            {new Date(msg.created_at).toLocaleTimeString()}
          </p>
          {isReal && !isEditing && (
            <div className="hidden group-hover:flex gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="text-xs text-text-muted hover:text-primary"
              >
                Copy
              </button>
              {msg.role === 'user' && (
                <button
                  onClick={() => { setEditContent(msg.content); setIsEditing(true); }}
                  className="text-xs text-text-muted hover:text-primary"
                >
                  Edit
                </button>
              )}
              {msg.role === 'assistant' && onRetry && (
                <button onClick={() => onRetry(msg.content)} className="text-xs text-text-muted hover:text-primary">Retry</button>
              )}
              <button onClick={() => onDelete?.(msg.id)} className="text-xs text-text-muted hover:text-red-400">Del</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default function ConversationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const convId = Number(id);

  const {
    currentConversation,
    messages,
    hasMoreMessages,
    experts: assignedExperts,
    documents,
    suggestedExperts,
    isLoading,
    isSending,
    isStreaming,
    fetchConversation,
    fetchOlderMessages,
    updateConversation,
    deleteConversation,
    sendMessageStream,
    assignExpert,
    removeExpert,
    updateExpertOverride,
    editMessage,
    deleteMessage,
    uploadDocument,
    deleteDocument,
  } = useConversationStore();

  const { experts: allExperts, fetchExperts } = useExpertStore();
  const { backends, fetchBackends } = useBackendStore();
  const isDark = useThemeStore((s) => s.theme) === 'dark';

  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [modelsMap, setModelsMap] = useState<Record<string, string[]>>({});
  const [previewDoc, setPreviewDoc] = useState<{ filename: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);

  const fetchModelsForBackend = useCallback(async (backendId: number) => {
    const key = String(backendId);
    if (modelsMap[key]) return;
    try {
      const { models } = await api<{ models: string[] }>(`/api/backends/${backendId}/models`);
      setModelsMap((prev) => ({ ...prev, [key]: models ?? [] }));
    } catch {
      setModelsMap((prev) => ({ ...prev, [key]: [] }));
    }
  }, [modelsMap]);

  useEffect(() => {
    fetchConversation(convId);
    fetchExperts();
    fetchBackends();
  }, [convId, fetchConversation, fetchExperts, fetchBackends]);

  useEffect(() => {
    for (const expert of assignedExperts) {
      if (expert.backend_override_id) {
        fetchModelsForBackend(expert.backend_override_id);
      }
    }
  }, [assignedExperts, fetchModelsForBackend]);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 100;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    await sendMessageStream(convId, text);
  };

  const handleRetry = useCallback(async (assistantMsgId: number) => {
    // Find the user message before this assistant message
    const idx = messages.findIndex((m) => m.id === assistantMsgId);
    const prevUserMsg = messages.slice(0, idx).reverse().find((m) => m.role === 'user');
    if (!prevUserMsg) return;
    await deleteMessage(convId, assistantMsgId);
    await sendMessageStream(convId, prevUserMsg.content);
  }, [messages, convId, deleteMessage, sendMessageStream]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    await deleteConversation(convId);
    navigate('/conversations');
  };

  const handleTitleSave = async () => {
    if (titleDraft.trim()) {
      await updateConversation(convId, { title: titleDraft.trim() } as any);
    }
    setEditingTitle(false);
  };

  const onDrop = useCallback(async (files: File[]) => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`"${file.name}" exceeds 10MB limit`);
        continue;
      }
      try {
        await uploadDocument(convId, file);
      } catch (err: any) {
        toast.error(err.message || `Failed to upload "${file.name}"`);
      }
    }
  }, [convId, uploadDocument]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Available experts (not yet assigned)
  const availableExperts = allExperts.filter(
    (e) => !assignedExperts.some((a) => a.id === e.id)
  );

  if (isLoading && !currentConversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  if (!currentConversation) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-text-muted">Conversation not found.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
              className="text-lg font-semibold text-text-primary bg-background px-2 py-1 rounded border border-border focus:outline-none focus:border-primary"
            />
          ) : (
            <h1
              className="text-lg font-semibold text-text-primary cursor-pointer hover:text-primary transition-colors"
              onClick={() => { setTitleDraft(currentConversation.title); setEditingTitle(true); }}
            >
              {currentConversation.title}
            </h1>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              const fmt = e.target.value;
              if (!fmt) return;
              e.target.value = '';
              const url = `/api/conversations/${convId}/export${fmt === 'md' ? '?format=md' : ''}`;
              fetch(url, { credentials: 'include' })
                .then((r) => r.blob())
                .then((blob) => {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = `${currentConversation!.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${fmt === 'md' ? 'md' : 'json'}`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                });
            }}
            className="px-3 py-1.5 rounded-lg border border-border text-text-secondary text-sm bg-surface focus:outline-none"
          >
            <option value="">Export...</option>
            <option value="json">JSON</option>
            <option value="md">Markdown</option>
          </select>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="px-3 py-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary text-sm transition-colors"
          >
            {sidebarOpen ? 'Hide Panel' : 'Show Panel'}
          </button>
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Suggested experts banner */}
          {suggestedExperts.length > 0 && (
            <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-primary font-medium">Suggested experts:</span>
              {suggestedExperts.map((e) => (
                <button
                  key={e.id}
                  onClick={() => assignExpert(convId, e.id)}
                  className="px-2 py-1 rounded-full bg-primary/20 text-primary text-xs hover:bg-primary/30 transition-colors"
                >
                  + {e.name}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {hasMoreMessages && messages.length > 0 && (
              <div className="text-center">
                <button
                  onClick={async () => {
                    const el = messagesContainerRef.current;
                    const prevHeight = el?.scrollHeight || 0;
                    await fetchOlderMessages(convId, messages[0].id);
                    // Preserve scroll position after prepending
                    requestAnimationFrame(() => {
                      if (el) el.scrollTop = el.scrollHeight - prevHeight;
                    });
                  }}
                  className="px-4 py-1.5 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Load earlier messages
                </button>
              </div>
            )}
            {messages.length === 0 && (
              <div className="text-center py-16 text-text-muted">
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            {messages.map((msg) => (
              <LazyMessage
                key={msg.id}
                msg={msg}
                isStreaming={isStreaming}
                isDark={isDark}
                onEdit={(msgId, content) => editMessage(convId, msgId, content)}
                onDelete={(msgId) => deleteMessage(convId, msgId)}
                onRetry={() => handleRetry(msg.id)}
              />
            ))}
            {isSending && !isStreaming && (
              <div className="flex justify-start">
                <div className="bg-surface border border-border rounded-xl px-4 py-3">
                  <p className="text-text-muted text-sm animate-pulse">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-border bg-surface shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Type a message... (Shift+Enter for new line)"
                rows={1}
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-text-primary resize-none focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-80 border-l border-border bg-surface overflow-y-auto shrink-0 p-5 space-y-8">
            {/* Settings */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Settings</h3>
              <div className="mb-3">
                <span className="text-sm text-text-primary block mb-1">Type</span>
                <select
                  value={currentConversation.type}
                  onChange={(e) => updateConversation(convId, { type: e.target.value } as any)}
                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-primary"
                >
                  <option value="standard">Standard</option>
                  <option value="research">Research</option>
                  <option value="brainstorm">Brainstorm</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
              <label className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-primary">Debate Mode</span>
                <input
                  type="checkbox"
                  checked={!!currentConversation.expert_debate_enabled}
                  onChange={(e) => updateConversation(convId, { expert_debate_enabled: e.target.checked ? 1 : 0 } as any)}
                  className="accent-primary"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-text-primary">Auto-Suggest</span>
                <input
                  type="checkbox"
                  checked={!!currentConversation.auto_suggest_experts}
                  onChange={(e) => updateConversation(convId, { auto_suggest_experts: e.target.checked ? 1 : 0 } as any)}
                  className="accent-primary"
                />
              </label>
            </div>

            {/* Assigned Experts */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Experts ({assignedExperts.length})
              </h3>
              {assignedExperts.length === 0 ? (
                <p className="text-xs text-text-muted mb-2">No experts assigned. Using default AI.</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {assignedExperts.map((expert) => (
                    <div key={expert.id} className="bg-background rounded-lg px-3 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-sm text-text-primary font-medium">{expert.name}</p>
                          <p className="text-xs text-text-muted">{expert.domain}</p>
                        </div>
                        <button
                          onClick={() => removeExpert(convId, expert.id)}
                          className="text-text-muted hover:text-red-400 text-xs transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                      <select
                        value={expert.backend_override_id ?? ''}
                        onChange={(e) => updateExpertOverride(convId, expert.id, {
                          backend_override_id: e.target.value ? Number(e.target.value) : null,
                          model_override: null,
                        })}
                        className="w-full mt-2 px-2 py-1.5 rounded bg-surface border border-border text-text-secondary text-xs focus:outline-none focus:border-primary"
                      >
                        <option value="">Backend: default</option>
                        {backends.filter((b) => b.is_active).map((b) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                        ))}
                      </select>
                      {expert.backend_override_id && (modelsMap[String(expert.backend_override_id)]?.length ?? 0) > 0 ? (
                        <select
                          value={expert.conv_model_override ?? ''}
                          onChange={(e) => updateExpertOverride(convId, expert.id, {
                            model_override: e.target.value || null,
                          })}
                          className="w-full mt-2 px-2 py-1.5 rounded bg-surface border border-border text-text-secondary text-xs focus:outline-none focus:border-primary"
                        >
                          <option value="">Default model</option>
                          {modelsMap[String(expert.backend_override_id)]!.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      ) : expert.backend_override_id ? (
                        <input
                          type="text"
                          value={expert.conv_model_override ?? ''}
                          onChange={(e) => updateExpertOverride(convId, expert.id, {
                            model_override: e.target.value || null,
                          })}
                          placeholder="Model override"
                          className="w-full mt-2 px-2 py-1.5 rounded bg-surface border border-border text-text-secondary text-xs focus:outline-none focus:border-primary"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {availableExperts.length > 0 && (
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      assignExpert(convId, Number(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Assign expert...</option>
                  {availableExperts.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} — {e.domain}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Documents */}
            <div>
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
                Documents ({documents.length})
              </h3>
              {documents.length > 0 && (
                <div className="space-y-2 mb-4">
                  {documents.map((doc) => (
                    <div key={doc.id} className="bg-background rounded-lg px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{doc.filename}</p>
                          <p className="text-xs text-text-muted">
                            {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <a
                            href={`/api/conversations/${convId}/documents/${doc.id}/download`}
                            className="text-text-muted hover:text-primary text-xs transition-colors"
                            title="Download"
                          >
                            DL
                          </a>
                          {doc.extracted_text && (
                            <button
                              onClick={() => setPreviewDoc({ filename: doc.filename, text: doc.extracted_text! })}
                              className="text-text-muted hover:text-primary text-xs transition-colors"
                              title="Preview"
                            >
                              View
                            </button>
                          )}
                          <button
                            onClick={() => deleteDocument(convId, doc.id)}
                            className="text-text-muted hover:text-red-400 text-xs transition-colors"
                          >
                            Del
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                }`}
              >
                <input {...getInputProps()} />
                <p className="text-xs text-text-muted">
                  {isDragActive ? 'Drop file here...' : 'Drop file or click to upload'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPreviewDoc(null)}>
          <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-text-primary truncate">{previewDoc.filename}</h3>
              <button onClick={() => setPreviewDoc(null)} className="text-text-muted hover:text-text-primary text-sm">Close</button>
            </div>
            {previewDoc.filename.endsWith('.md') ? (
              <div
                className="flex-1 overflow-auto text-sm text-text-secondary bg-background rounded-lg p-4 prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: marked.parse(previewDoc.text || '') as string }}
              />
            ) : getLanguageFromExt(previewDoc.filename) && getLanguageFromExt(previewDoc.filename) !== 'markdown' ? (
              <pre className="flex-1 overflow-auto text-sm bg-background rounded-lg p-4">
                <code
                  className={`hljs language-${getLanguageFromExt(previewDoc.filename)}`}
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(previewDoc.text || '', { language: getLanguageFromExt(previewDoc.filename)! }).value,
                  }}
                />
              </pre>
            ) : (
              <pre className="flex-1 overflow-auto text-sm text-text-secondary bg-background rounded-lg p-4 whitespace-pre-wrap">{previewDoc.text}</pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
