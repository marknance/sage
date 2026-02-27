import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { marked } from 'marked';
import { useDropzone } from 'react-dropzone';
import { api } from '../lib/api';
import { useConversationStore } from '../stores/conversationStore';
import { useExpertStore, type Expert } from '../stores/expertStore';
import { useBackendStore } from '../stores/backendStore';

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
    uploadDocument,
    deleteDocument,
  } = useConversationStore();

  const { experts: allExperts, fetchExperts } = useExpertStore();
  const { backends, fetchBackends } = useBackendStore();

  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [modelsMap, setModelsMap] = useState<Record<string, string[]>>({});
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
    await sendMessageStream(convId, text);
  };

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
    for (const file of files) {
      await uploadDocument(convId, file);
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
    <div className="h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/conversations" className="text-text-muted hover:text-text-primary transition-colors">
            &larr; Back
          </Link>
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
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-primary/20 text-text-primary'
                      : 'bg-surface border border-border text-text-primary'
                  }`}
                >
                  {msg.role === 'assistant' && msg.expert_name && (
                    <p className="text-xs font-medium text-primary mb-1">{msg.expert_name}</p>
                  )}
                  <div
                    className="prose prose-invert prose-sm max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') as string }}
                  />
                  {isStreaming && msg.id < 0 && msg.role === 'assistant' && (
                    <span className="inline-block w-2 h-4 bg-primary/70 animate-pulse ml-0.5 align-text-bottom rounded-sm" />
                  )}
                  <p className="text-xs text-text-muted mt-2">
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                    <div key={doc.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">{doc.filename}</p>
                        <p className="text-xs text-text-muted">
                          {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteDocument(convId, doc.id)}
                        className="text-text-muted hover:text-red-400 text-xs transition-colors shrink-0 ml-2"
                      >
                        Delete
                      </button>
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
    </div>
  );
}
