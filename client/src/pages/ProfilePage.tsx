import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useBackendStore } from '../stores/backendStore';
import { api } from '../lib/api';

export default function ProfilePage() {
  const { user, logout, changePassword, updateProfile, deleteAccount } = useAuthStore();
  const { backends, fetchBackends } = useBackendStore();
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [defaultBackendId, setDefaultBackendId] = useState<string>('');
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    fetchBackends();
    api<{ settings: any }>('/api/settings').then(({ settings }) => {
      setDefaultBackendId(settings.default_backend_id ? String(settings.default_backend_id) : '');
      setDefaultModel(settings.default_model || '');
    });
  }, [fetchBackends]);

  useEffect(() => {
    if (!defaultBackendId) {
      setModels([]);
      setDefaultModel('');
      return;
    }
    setModelsLoading(true);
    api<{ models: string[] }>(`/api/backends/${defaultBackendId}/models`)
      .then(({ models: m }) => setModels(m ?? []))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [defaultBackendId]);

  async function handleSaveSettings() {
    setSettingsLoading(true);
    setSettingsSaved(false);
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          default_backend_id: defaultBackendId ? Number(defaultBackendId) : null,
          default_model: defaultModel || null,
        }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess('Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-md mx-auto space-y-6">
        {/* User Info */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h1 className="text-2xl font-semibold text-text-primary mb-4">Profile</h1>

          {profileError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{profileError}</div>
          )}
          {profileSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">{profileSuccess}</div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-muted mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Role</label>
              <p className="text-text-primary capitalize">{user?.role}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              setProfileError('');
              setProfileSuccess('');
              setProfileSaving(true);
              try {
                await updateProfile(username, email);
                setProfileSuccess('Profile updated');
                setTimeout(() => setProfileSuccess(''), 2000);
              } catch (err: any) {
                setProfileError(err.message || 'Failed to update profile');
              } finally {
                setProfileSaving(false);
              }
            }}
            disabled={profileSaving}
            className="mt-4 w-full py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {profileSaving ? 'Saving...' : 'Save Profile'}
          </button>

          <button
            onClick={handleLogout}
            className="mt-3 w-full py-2 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/10 transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Default AI Backend */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Default AI Backend</h2>
          <p className="text-sm text-text-muted mb-3">
            Used when an expert has no backend assigned. Experts with a specific backend will use that instead.
          </p>
          <div className="flex gap-2">
            <select
              value={defaultBackendId}
              onChange={(e) => setDefaultBackendId(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="">System default (Ollama localhost)</option>
              {backends.filter((b) => b.is_active).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.type})
                </option>
              ))}
            </select>
            <button
              onClick={handleSaveSettings}
              disabled={settingsLoading}
              className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {settingsLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
          {defaultBackendId && (
            <div className="mt-3">
              <label className="block text-sm text-text-muted mb-1">Default Model</label>
              {modelsLoading ? (
                <p className="text-xs text-text-muted">Loading models...</p>
              ) : models.length > 0 ? (
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="">Auto (backend default)</option>
                  {models.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="Model name (optional)"
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                />
              )}
            </div>
          )}
          {settingsSaved && (
            <p className="mt-2 text-sm text-green-400">Settings saved.</p>
          )}
          {backends.length === 0 && (
            <p className="mt-3 text-sm text-text-muted">
              No backends configured.{' '}
              <Link to="/backends/new" className="text-primary hover:underline">Add one</Link>
            </p>
          )}
        </div>

        {/* Change Password */}
        <div className="bg-surface rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Change Password</h2>

          {pwError && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {pwError}
            </div>
          )}
          {pwSuccess && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">
              {pwSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm text-text-secondary mb-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Delete Account */}
        <div className="bg-surface rounded-xl border border-destructive/30 p-6">
          <h2 className="text-lg font-semibold text-destructive mb-2">Delete Account</h2>
          <p className="text-sm text-text-muted mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/10 transition-colors"
          >
            Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-text-primary mb-2">Confirm Account Deletion</h3>
            <p className="text-sm text-text-secondary mb-4">Enter your password to permanently delete your account.</p>
            {deleteError && (
              <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{deleteError}</div>
            )}
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="Your password"
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }}
                className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={deleteLoading || !deletePassword}
                onClick={async () => {
                  setDeleteError('');
                  setDeleteLoading(true);
                  try {
                    await deleteAccount(deletePassword);
                    navigate('/login');
                  } catch (err: any) {
                    setDeleteError(err.message || 'Failed to delete account');
                  } finally {
                    setDeleteLoading(false);
                  }
                }}
                className="px-4 py-2 rounded-lg bg-destructive text-white text-sm disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
