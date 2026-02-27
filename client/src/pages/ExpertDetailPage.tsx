import { useEffect, useState, useRef, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useExpertStore, type Behavior } from '../stores/expertStore';
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

const MEMORY_TYPES = ['fact', 'preference', 'instruction', 'context'];

export default function ExpertDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentExpert,
    behaviors,
    categories,
    memories,
    allCategories,
    isLoading,
    fetchExpert,
    updateExpert,
    deleteExpert,
    updateBehaviors,
    updateCategories,
    fetchMemories,
    addMemory,
    deleteMemory,
    clearMemories,
    fetchAllCategories,
    checkExpertUsage,
    exportExpert,
    cloneExpert,
  } = useExpertStore();
  const { backends, fetchBackends, models, fetchModels } = useBackendStore();

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    domain: '',
    description: '',
    personality_tone: 'formal',
    system_prompt: '',
    backend_id: '' as string,
    model_override: '',
    memory_enabled: 1,
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteWarning, setDeleteWarning] = useState<{ conversation_count: number; message_count: number } | null>(null);
  const [memoryType, setMemoryType] = useState('fact');
  const [memoryContent, setMemoryContent] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [addCategoryId, setAddCategoryId] = useState('');

  const originalForm = useRef(editForm);
  const isDirty = editing && JSON.stringify(editForm) !== JSON.stringify(originalForm.current);
  const blocker = useUnsavedChanges(isDirty);
  const expertId = Number(id);

  useEffect(() => {
    if (id) {
      fetchExpert(expertId);
      fetchMemories(expertId);
      fetchAllCategories();
      fetchBackends();
    }
  }, [id, expertId, fetchExpert, fetchMemories, fetchAllCategories, fetchBackends]);

  useEffect(() => {
    if (editForm.backend_id) {
      fetchModels(Number(editForm.backend_id));
    }
  }, [editForm.backend_id, fetchModels]);

  useEffect(() => {
    if (currentExpert) {
      const form = {
        name: currentExpert.name,
        domain: currentExpert.domain,
        description: currentExpert.description || '',
        personality_tone: currentExpert.personality_tone,
        system_prompt: currentExpert.system_prompt || '',
        backend_id: currentExpert.backend_id ? String(currentExpert.backend_id) : '',
        model_override: currentExpert.model_override || '',
        memory_enabled: currentExpert.memory_enabled,
      };
      setEditForm(form);
      originalForm.current = form;
    }
  }, [currentExpert]);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!editForm.name.trim() || editForm.name.trim().length > 100) errs.name = 'Name is required (1-100 characters)';
    if (!editForm.domain.trim() || editForm.domain.trim().length > 200) errs.domain = 'Domain is required (1-200 characters)';
    if (editForm.description.length > 1000) errs.description = 'Description must be under 1000 characters';
    if (editForm.system_prompt.length > 10000) errs.system_prompt = 'System prompt must be under 10000 characters';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    await updateExpert(expertId, {
      ...editForm,
      description: editForm.description || null,
      system_prompt: editForm.system_prompt || null,
      backend_id: editForm.backend_id ? Number(editForm.backend_id) : null,
      model_override: editForm.model_override || null,
    } as any);
    setEditing(false);
  }

  async function handleDelete() {
    await deleteExpert(expertId);
    navigate('/experts');
  }

  async function handleBehaviorToggle(b: Behavior) {
    const updated = behaviors.map((bh) => ({
      behavior_key: bh.behavior_key,
      enabled: bh.id === b.id ? (b.enabled ? 0 : 1) : bh.enabled,
    }));
    await updateBehaviors(expertId, updated);
  }

  async function handleRemoveCategory(catId: number) {
    const newIds = categories.filter((c) => c.id !== catId).map((c) => c.id);
    await updateCategories(expertId, newIds);
  }

  async function handleAddCategory() {
    if (!addCategoryId) return;
    const newIds = [...categories.map((c) => c.id), Number(addCategoryId)];
    await updateCategories(expertId, newIds);
    setAddCategoryId('');
  }

  async function handleAddMemory(e: FormEvent) {
    e.preventDefault();
    if (!memoryContent.trim()) return;
    await addMemory(expertId, memoryType, memoryContent.trim());
    setMemoryContent('');
  }

  if (isLoading || !currentExpert) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-text-secondary">Loading...</p>
      </div>
    );
  }

  const assignedCategoryIds = new Set(categories.map((c) => c.id));
  const availableCategories = allCategories.filter((c) => !assignedCategoryIds.has(c.id));

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <Link to="/experts" className="text-text-muted hover:text-text-primary transition-colors">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary">{currentExpert.name}</h1>
        </div>

        {/* Expert Info Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">Expert Info</h2>
            <div className="flex gap-2">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-3 py-1 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 rounded-lg bg-primary text-white text-sm hover:opacity-90 transition-opacity"
                  >
                    Save
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      const cloned = await cloneExpert(expertId);
                      navigate(`/experts/${cloned.id}`);
                    }}
                    className="px-3 py-1 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    Clone
                  </button>
                  <button
                    onClick={() => exportExpert(expertId)}
                    className="px-3 py-1 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    Export
                  </button>
                  <button
                    onClick={() => setEditing(true)}
                    className="px-3 py-1 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const usage = await checkExpertUsage(expertId);
                        setDeleteWarning(usage.conversation_count > 0 || usage.message_count > 0 ? usage : null);
                      } catch {
                        setDeleteWarning(null);
                      }
                      setShowDeleteConfirm(true);
                    }}
                    className="px-3 py-1 rounded-lg border border-destructive text-destructive text-sm hover:bg-destructive/10 transition-colors"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>

          {showDeleteConfirm && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              {deleteWarning && (
                <p className="text-sm text-warning mb-2">
                  This expert is used in {deleteWarning.conversation_count} conversation{deleteWarning.conversation_count !== 1 ? 's' : ''} with {deleteWarning.message_count} message{deleteWarning.message_count !== 1 ? 's' : ''}.
                </p>
              )}
              <p className="text-sm text-text-primary mb-2">Delete this expert? This cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 rounded-lg bg-destructive text-white text-sm"
                >
                  Confirm Delete
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteWarning(null); }}
                  className="px-3 py-1 rounded-lg border border-border text-text-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {editing ? (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${fieldErrors.name ? 'border-destructive' : 'border-border'}`}
                />
                {fieldErrors.name && <p className="text-xs text-destructive mt-1">{fieldErrors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Domain</label>
                <input
                  type="text"
                  value={editForm.domain}
                  onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${fieldErrors.domain ? 'border-destructive' : 'border-border'}`}
                />
                {fieldErrors.domain && <p className="text-xs text-destructive mt-1">{fieldErrors.domain}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">Tone</label>
                <select
                  value={editForm.personality_tone}
                  onChange={(e) => setEditForm((f) => ({ ...f, personality_tone: e.target.value }))}
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
                  value={editForm.system_prompt}
                  onChange={(e) => setEditForm((f) => ({ ...f, system_prompt: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary resize-none"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1.5">AI Backend</label>
                <select
                  value={editForm.backend_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, backend_id: e.target.value, model_override: '' }))}
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
                {editForm.backend_id && models.length > 0 ? (
                  <select
                    value={editForm.model_override}
                    onChange={(e) => setEditForm((f) => ({ ...f, model_override: e.target.value }))}
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
                    value={editForm.model_override}
                    onChange={(e) => setEditForm((f) => ({ ...f, model_override: e.target.value }))}
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
                  aria-checked={!!editForm.memory_enabled}
                  onClick={() => setEditForm((f) => ({ ...f, memory_enabled: f.memory_enabled ? 0 : 1 }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    editForm.memory_enabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      editForm.memory_enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            </div>
          ) : (
            <dl className="space-y-4">
              <div>
                <dt className="text-sm text-text-muted">Domain</dt>
                <dd className="text-text-primary">{currentExpert.domain}</dd>
              </div>
              {currentExpert.description && (
                <div>
                  <dt className="text-sm text-text-muted">Description</dt>
                  <dd className="text-text-primary">{currentExpert.description}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-text-muted">Tone</dt>
                <dd className="text-text-primary capitalize">{currentExpert.personality_tone}</dd>
              </div>
              {currentExpert.system_prompt && (
                <div>
                  <dt className="text-sm text-text-muted">System Prompt</dt>
                  <dd className="text-text-primary text-sm whitespace-pre-wrap">{currentExpert.system_prompt}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-text-muted">AI Backend</dt>
                <dd className="text-text-primary">
                  {currentExpert.backend_id
                    ? backends.find((b) => b.id === currentExpert.backend_id)?.name || `Backend #${currentExpert.backend_id}`
                    : 'Default (system fallback)'}
                </dd>
              </div>
              {currentExpert.model_override && (
                <div>
                  <dt className="text-sm text-text-muted">Model Override</dt>
                  <dd className="text-text-primary">{currentExpert.model_override}</dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-text-muted">Memory</dt>
                <dd className="text-text-primary">{currentExpert.memory_enabled ? 'Enabled' : 'Disabled'}</dd>
              </div>
            </dl>
          )}
        </div>

        {/* Behaviors Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-lg font-medium text-text-primary mb-2">Behaviors</h2>
          <p className="text-sm text-text-muted mb-4">
            <span className={behaviors.filter((b) => b.enabled).length > 0 ? 'text-green-500' : 'text-text-muted'}>
              {behaviors.filter((b) => b.enabled).length}
            </span>{' '}
            of {behaviors.length} behaviors enabled
          </p>
          <div className="space-y-4">
            {behaviors.map((b) => (
              <label key={b.id} className="flex items-center justify-between cursor-pointer">
                <span className="text-text-primary">{BEHAVIOR_LABELS[b.behavior_key] || b.behavior_key}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={!!b.enabled}
                  onClick={() => handleBehaviorToggle(b)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    b.enabled ? 'bg-primary' : 'bg-border'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      b.enabled ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </label>
            ))}
          </div>
        </div>

        {/* Categories Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-lg font-medium text-text-primary mb-5">Categories</h2>
          {categories.length > 0 ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                >
                  {c.name}
                  <button
                    onClick={() => handleRemoveCategory(c.id)}
                    className="ml-1 text-primary/60 hover:text-primary"
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted mb-4">No categories assigned.</p>
          )}
          {availableCategories.length > 0 && (
            <div className="flex gap-2">
              <select
                value={addCategoryId}
                onChange={(e) => setAddCategoryId(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="">Select category...</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddCategory}
                disabled={!addCategoryId}
                className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                Add
              </button>
            </div>
          )}
        </div>

        {/* Memories Card */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-text-primary">Memories</h2>
            {memories.length > 0 && (
              <button
                onClick={() => clearMemories(expertId)}
                className="text-sm text-destructive hover:underline"
              >
                Clear All
              </button>
            )}
          </div>

          <form onSubmit={handleAddMemory} className="flex gap-2 mb-4">
            <select
              value={memoryType}
              onChange={(e) => setMemoryType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={memoryContent}
              onChange={(e) => setMemoryContent(e.target.value)}
              placeholder="Memory content..."
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={!memoryContent.trim()}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Add
            </button>
          </form>

          {memories.length === 0 ? (
            <p className="text-sm text-text-muted">No memories yet.</p>
          ) : (
            <div className="space-y-2">
              {memories.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg bg-background border border-border"
                >
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-primary/10 text-primary mb-1">
                      {m.memory_type}
                    </span>
                    <p className="text-sm text-text-primary">{m.content}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {new Date(m.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMemory(expertId, m.id)}
                    className="text-text-muted hover:text-destructive text-sm flex-shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unsaved changes dialog */}
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
