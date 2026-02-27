import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useExpertStore } from '../stores/expertStore';
import { useBackendStore } from '../stores/backendStore';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';

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
  const isDirty = !!(name || domain || description || system_prompt || model_override);
  const blocker = useUnsavedChanges(isDirty);

  useEffect(() => {
    fetchBackends();
  }, [fetchBackends]);

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

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Info */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-5">Basic Info</h2>
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
                <label className="block text-sm text-text-secondary mb-1.5">Description</label>
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
                <label className="block text-sm text-text-secondary mb-1.5">System Prompt</label>
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
