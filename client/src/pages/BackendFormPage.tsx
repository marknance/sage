import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useBackendStore } from '../stores/backendStore';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { toast } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';

const TYPE_OPTIONS = ['ollama', 'openai', 'anthropic', 'lmstudio', 'custom'];

const TYPE_DEFAULTS: Record<string, string> = {
  ollama: 'http://localhost:11434',
  lmstudio: 'http://localhost:1234',
  openai: 'https://api.openai.com',
  anthropic: 'https://api.anthropic.com',
  custom: '',
};

export default function BackendFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { currentBackend, fetchBackend, createBackend, updateBackend, deleteBackend, testBackend, testResult, clearTestResult } = useBackendStore();
  const confirm = useConfirmStore((s) => s.confirm);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState('');
  const [type, setType] = useState('ollama');
  const [base_url, setBaseUrl] = useState(TYPE_DEFAULTS.ollama);
  const [api_key, setApiKey] = useState('');
  const [org_id, setOrgId] = useState('');
  const [is_active, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const initialValues = useRef({ name: '', type: 'ollama', base_url: TYPE_DEFAULTS.ollama, api_key: '', org_id: '', is_active: true });
  const isDirty = name !== initialValues.current.name || type !== initialValues.current.type || base_url !== initialValues.current.base_url || api_key !== initialValues.current.api_key || org_id !== initialValues.current.org_id || is_active !== initialValues.current.is_active;
  const blocker = useUnsavedChanges(isDirty);

  useEffect(() => {
    clearTestResult();
    if (isEdit) {
      fetchBackend(Number(id));
    }
  }, [id, isEdit, fetchBackend, clearTestResult]);

  useEffect(() => {
    if (isEdit && currentBackend) {
      setName(currentBackend.name);
      setType(currentBackend.type);
      setBaseUrl(currentBackend.base_url || '');
      setOrgId(currentBackend.org_id || '');
      setIsActive(!!currentBackend.is_active);
      setApiKey('');
      initialValues.current = { name: currentBackend.name, type: currentBackend.type, base_url: currentBackend.base_url || '', api_key: '', org_id: currentBackend.org_id || '', is_active: !!currentBackend.is_active };
    }
  }, [isEdit, currentBackend]);

  function handleTypeChange(newType: string) {
    setType(newType);
    if (!isEdit) {
      setBaseUrl(TYPE_DEFAULTS[newType] || '');
    }
  }

  async function handleTest() {
    if (!isEdit) return;
    setTesting(true);
    clearTestResult();
    try {
      await testBackend(Number(id));
    } catch (err: any) {
      // testResult will reflect the error
    } finally {
      setTesting(false);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length > 100) errs.name = 'Name is required (1-100 characters)';
    if (base_url.trim()) {
      try {
        const u = new URL(base_url.trim());
        if (u.protocol !== 'http:' && u.protocol !== 'https:') errs.base_url = 'URL must start with http:// or https://';
      } catch {
        errs.base_url = 'Invalid URL format';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      if (isEdit) {
        const data: any = {
          name: name.trim(),
          type,
          base_url: base_url.trim(),
          org_id: org_id.trim() || null,
          is_active: is_active ? 1 : 0,
        };
        // Only send api_key if user typed something or explicitly cleared it
        if (api_key !== '') {
          data.api_key = api_key;
        }
        await updateBackend(Number(id), data);
      } else {
        await createBackend({
          name: name.trim(),
          type,
          base_url: base_url.trim() || undefined,
          api_key: api_key || undefined,
          org_id: org_id.trim() || undefined,
          is_active: is_active ? 1 : 0,
        } as any);
      }
      navigate('/backends');
    } catch (err: any) {
      setError(err.message || 'Failed to save backend');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/backends" className="text-text-muted hover:text-text-primary transition-colors">
            &larr; Back
          </Link>
          <h1 className="text-2xl font-semibold text-text-primary">
            {isEdit ? 'Edit Backend' : 'New Backend'}
          </h1>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-4">Connection</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Local Ollama"
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${errors.name ? 'border-destructive' : 'border-border'}`}
                />
                {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Base URL</label>
                <input
                  type="text"
                  value={base_url}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com"
                  className={`w-full px-3 py-2 rounded-lg bg-background border text-text-primary focus:outline-none focus:border-primary ${errors.base_url ? 'border-destructive' : 'border-border'}`}
                />
                {errors.base_url && <p className="text-xs text-destructive mt-1">{errors.base_url}</p>}
              </div>
            </div>
          </div>

          {/* Authentication */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-4">Authentication</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">
                  API Key {isEdit && currentBackend?.has_api_key && '(saved — leave blank to keep)'}
                </label>
                <input
                  type="password"
                  value={api_key}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={isEdit && currentBackend?.has_api_key ? '••••••••' : 'sk-...'}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
              {type === 'openai' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Organization ID</label>
                  <input
                    type="text"
                    value={org_id}
                    onChange={(e) => setOrgId(e.target.value)}
                    placeholder="org-..."
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-medium text-text-primary mb-4">Settings</h2>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-text-primary">Active</span>
              <button
                type="button"
                role="switch"
                aria-checked={is_active}
                onClick={() => setIsActive((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  is_active ? 'bg-primary' : 'bg-border'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                    is_active ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </label>
          </div>

          {/* Test Connection (edit only) */}
          {isEdit && (
            <div className="bg-surface rounded-xl border border-border p-6">
              <h2 className="text-lg font-medium text-text-primary mb-4">Test Connection</h2>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="px-4 py-2 rounded-lg border border-border text-text-primary hover:bg-background transition-colors disabled:opacity-50"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-destructive/10 text-destructive'
                }`}>
                  {testResult.success
                    ? `Connected successfully — ${testResult.model_count} model(s) available`
                    : `Connection failed: ${testResult.error}`
                  }
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Backend'}
          </button>

          {isEdit && (
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!await confirm({ title: 'Delete Backend', message: 'Delete this backend? Experts using it will fall back to the default.' })) return;
                setDeleting(true);
                try {
                  await deleteBackend(Number(id));
                  navigate('/backends');
                } catch (err: any) {
                  if (err.status === 409) {
                    toast.error(err.message || 'Backend is in use and cannot be deleted');
                  } else {
                    toast.error(err.message || 'Failed to delete backend');
                  }
                } finally {
                  setDeleting(false);
                }
              }}
              className="w-full py-3 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/10 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete Backend'}
            </button>
          )}
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
