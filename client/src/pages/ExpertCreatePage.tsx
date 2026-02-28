import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useExpertStore } from '../stores/expertStore';
import { useBackendStore } from '../stores/backendStore';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { useToastStore } from '../stores/toastStore';
import { api } from '../lib/api';

const TONE_OPTIONS = ['formal', 'casual', 'technical', 'friendly', 'concise'];

const BEHAVIOR_LABELS: Record<string, string> = {
  cite_sources: 'Cite Sources',
  ask_clarifying_questions: 'Ask Clarifying Questions',
  provide_examples: 'Provide Examples',
  use_analogies: 'Use Analogies',
  summarize_responses: 'Summarize Responses',
};

const BEHAVIOR_KEYS = Object.keys(BEHAVIOR_LABELS);

export default function ExpertCreatePage() {
  const navigate = useNavigate();
  const { createExpert, updateBehaviors } = useExpertStore();
  const { backends, fetchBackends, models, fetchModels } = useBackendStore();

  const [name, setName] = useState('');
  const [backend_id, setBackendId] = useState<string>('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [personality_tone, setTone] = useState('formal');
  const [system_prompt, setSystemPrompt] = useState('');
  const [model_override, setModelOverride] = useState('');
  const [memory_enabled, setMemoryEnabled] = useState(true);
  const [behaviorState, setBehaviorState] = useState<Record<string, boolean>>(
    Object.fromEntries(BEHAVIOR_KEYS.map((k) => [k, false]))
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [assisting, setAssisting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  const isDirty = !!(name || domain || description || system_prompt || model_override);
  const blocker = useUnsavedChanges(isDirty);

  useEffect(() => {
    fetchBackends();
    api<{ templates: any[] }>('/api/experts/templates').then((d) => setTemplates(d.templates)).catch(() => {});
  }, [fetchBackends]);

  interface GenerateResponse {
    name: string;
    description: string;
    system_prompt: string;
    tone: string;
    behaviors: Record<string, boolean>;
  }

  async function handleGenerate() {
    if (!domain.trim()) {
      addToast('warning', 'Enter a domain first so AI knows what to generate.');
      return;
    }
    setGenerating(true);
    try {
      const data = await api<GenerateResponse>('/api/experts/generate', {
        method: 'POST',
        body: JSON.stringify({ mode: 'full', domain: domain.trim(), tone: personality_tone }),
      });
      setName(data.name);
      setDescription(data.description);
      setSystemPrompt(data.system_prompt);
      if (data.tone && TONE_OPTIONS.includes(data.tone)) setTone(data.tone);
      if (data.behaviors) {
        setBehaviorState((prev) => {
          const next = { ...prev };
          for (const key of BEHAVIOR_KEYS) {
            if (key in data.behaviors) next[key] = data.behaviors[key];
          }
          return next;
        });
      }
      addToast('success', 'Expert generated! Review and edit the fields below.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to generate expert');
    } finally {
      setGenerating(false);
    }
  }

  async function handleAssist() {
    if (!domain.trim()) {
      addToast('warning', 'Enter a domain first so AI knows what to assist with.');
      return;
    }
    setAssisting(true);
    try {
      const data = await api<GenerateResponse>('/api/experts/generate', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'assist',
          domain: domain.trim(),
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          tone: personality_tone,
        }),
      });
      if (!name.trim() && data.name) setName(data.name);
      if (data.description) setDescription(data.description);
      if (data.system_prompt) setSystemPrompt(data.system_prompt);
      if (data.tone && TONE_OPTIONS.includes(data.tone)) setTone(data.tone);
      if (data.behaviors) {
        setBehaviorState((prev) => {
          const next = { ...prev };
          for (const key of BEHAVIOR_KEYS) {
            if (key in data.behaviors) next[key] = data.behaviors[key];
          }
          return next;
        });
      }
      addToast('success', 'Fields refined by AI. Review the changes.');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to assist');
    } finally {
      setAssisting(false);
    }
  }

  function applyTemplate(t: any) {
    setName(t.name);
    setDomain(t.domain);
    setDescription(t.description);
    setSystemPrompt(t.system_prompt);
    if (t.tone && TONE_OPTIONS.includes(t.tone)) setTone(t.tone);
    if (t.behaviors) {
      setBehaviorState((prev) => {
        const next = { ...prev };
        for (const key of BEHAVIOR_KEYS) {
          if (key in t.behaviors) next[key] = t.behaviors[key];
        }
        return next;
      });
    }
    setTemplatesOpen(false);
    addToast('success', `Template "${t.name}" applied. Edit fields as needed.`);
  }

  useEffect(() => {
    if (backend_id) {
      fetchModels(Number(backend_id));
    }
  }, [backend_id, fetchModels]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 100) errs.name = 'Name is required (1-100 characters)';
    if (!domain.trim() || domain.trim().length > 200) errs.domain = 'Domain is required (1-200 characters)';
    if (description.length > 1000) errs.description = 'Description must be under 1000 characters';
    if (system_prompt.length > 10000) errs.system_prompt = 'System prompt must be under 10000 characters';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const expert = await createExpert({
        name: name.trim(),
        domain: domain.trim(),
        description: description.trim() || null,
        personality_tone,
        system_prompt: system_prompt.trim() || null,
        backend_id: backend_id ? Number(backend_id) : null,
        model_override: model_override.trim() || null,
        memory_enabled: memory_enabled ? 1 : 0,
      });

      // Update behaviors
      const behaviors = BEHAVIOR_KEYS.map((key) => ({
        behavior_key: key,
        enabled: behaviorState[key] ? 1 : 0,
      }));
      await updateBehaviors(expert.id, behaviors);

      navigate(`/experts/${expert.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create expert');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/experts" className="text-text-muted hover:text-text-primary transition-colors">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary">New Expert</h1>
        </div>

        {templates.length > 0 && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setTemplatesOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className={`w-4 h-4 transition-transform ${templatesOpen ? 'rotate-90' : ''}`} viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" /></svg>
              Start from Template
            </button>
            {templatesOpen && (
              <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="flex-shrink-0 w-48 p-3 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
                  >
                    <p className="text-sm font-medium text-text-primary truncate">{t.name}</p>
                    <p className="text-xs text-text-muted mt-1">{t.domain}</p>
                    <p className="text-xs text-text-secondary mt-1 line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-medium text-text-primary">Basic Info</h2>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating || assisting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 disabled:opacity-50 transition-colors"
              >
                {generating ? (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v5m4-1-4 4-4-4m0 8h8m-4 0v5" /><path d="M9 2l1.5 3L9 8l1.5-1.5L12 8l1.5-1.5L15 8l-1.5-3L15 2l-1.5 1.5L12 2l-1.5 1.5z" /></svg>
                )}
                {generating ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Python Expert"
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${fieldErrors.name ? 'border-destructive' : 'border-border'}`}
                />
                {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Domain *</label>
                <input
                  type="text"
                  required
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="e.g., Python programming"
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${fieldErrors.domain ? 'border-destructive' : 'border-border'}`}
                />
                {fieldErrors.domain && <p className="text-xs text-destructive mt-1">{fieldErrors.domain}</p>}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-sm text-text-secondary">Description</label>
                  <button
                    type="button"
                    onClick={handleAssist}
                    disabled={assisting || generating}
                    title="AI Assist"
                    className="text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                  >
                    {assisting ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2L12 6L10 10L12 8L14 10L12 6L14 2L12 4L10 2ZM2 10L4 14L2 18L4 16L6 18L4 14L6 10L4 12L2 10ZM16 10L18 14L16 18L18 16L20 18L18 14L20 10L18 12L16 10Z" /></svg>
                    )}
                  </button>
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief description of this expert's purpose..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* Personality */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-5">Personality</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Tone</label>
                <select
                  value={personality_tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                >
                  {TONE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <label className="text-sm text-text-secondary">System Prompt</label>
                  <button
                    type="button"
                    onClick={handleAssist}
                    disabled={assisting || generating}
                    title="AI Assist"
                    className="text-primary hover:text-primary/80 disabled:opacity-50 transition-colors"
                  >
                    {assisting ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeLinecap="round" /></svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M10 2L12 6L10 10L12 8L14 10L12 6L14 2L12 4L10 2ZM2 10L4 14L2 18L4 16L6 18L4 14L6 10L4 12L2 10ZM16 10L18 14L16 18L18 16L20 18L18 14L20 10L18 12L16 10Z" /></svg>
                    )}
                  </button>
                </div>
                <textarea
                  value={system_prompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  placeholder="Custom instructions for this expert..."
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>
          </div>

          {/* Behaviors */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-5">Behaviors</h2>
            <div className="space-y-4">
              {BEHAVIOR_KEYS.map((key) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-text-primary">{BEHAVIOR_LABELS[key]}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={behaviorState[key]}
                    onClick={() =>
                      setBehaviorState((s) => ({ ...s, [key]: !s[key] }))
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      behaviorState[key] ? 'bg-primary' : 'bg-border'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        behaviorState[key] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </div>

          {/* Advanced */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-5">Advanced</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">AI Backend</label>
                <select
                  value={backend_id}
                  onChange={(e) => { setBackendId(e.target.value); setModelOverride(''); }}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">Default (system fallback)</option>
                  {backends.filter((b) => b.is_active).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Model Override</label>
                {backend_id && models.length > 0 ? (
                  <select
                    value={model_override}
                    onChange={(e) => setModelOverride(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                  >
                    <option value="">Default model</option>
                    {models.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={model_override}
                    onChange={(e) => setModelOverride(e.target.value)}
                    placeholder="Leave blank for default"
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                  />
                )}
              </div>
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-text-primary">Memory Enabled</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={memory_enabled}
                  onClick={() => setMemoryEnabled((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    memory_enabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      memory_enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating...' : 'Create Expert'}
          </button>
        </form>

        {blocker.state === 'blocked' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-surface border border-border rounded-xl p-6 max-w-sm mx-4">
              <h3 className="text-lg font-medium text-text-primary mb-2">Leave without saving?</h3>
              <p className="text-sm text-text-secondary mb-4">You have unsaved changes that will be lost.</p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => blocker.reset?.()}
                  className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                >
                  Stay
                </button>
                <button
                  onClick={() => blocker.proceed?.()}
                  className="px-4 py-2 rounded-lg bg-destructive text-white text-sm"
                >
                  Leave
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
