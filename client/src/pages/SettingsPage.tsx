import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useBackendStore } from '../stores/backendStore';
import { useAdminStore } from '../stores/adminStore';
import { useConfirmStore } from '../stores/confirmStore';
import { toast } from '../stores/toastStore';
import { api } from '../lib/api';

type Tab = 'profile' | 'defaults' | 'users' | 'content' | 'stats';
type ContentSubTab = 'conversations' | 'experts';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SettingsPage() {
  const { user, logout, changePassword, updateProfile, deleteAccount } = useAuthStore();
  const { backends, fetchBackends } = useBackendStore();
  const {
    stats, fetchStats,
    users, isLoading: usersLoading, fetchUsers, updateUserRole, deleteUser, resetUserPassword,
    adminConversations, adminConversationsTotal,
    adminExperts, adminExpertsTotal,
    fetchAdminConversations, fetchAdminExperts,
    deleteAdminConversation, deleteAdminExpert,
  } = useAdminStore();
  const confirm = useConfirmStore((s) => s.confirm);
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<Tab>('profile');

  // Profile state
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Defaults state
  const [defaultBackendId, setDefaultBackendId] = useState<string>('');
  const [defaultModel, setDefaultModel] = useState<string>('');
  const [defaultConvType, setDefaultConvType] = useState<string>('standard');
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // Users state
  const [userSearch, setUserSearch] = useState('');
  const [tempPasswordModal, setTempPasswordModal] = useState<{ username: string; password: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Content state
  const [contentTab, setContentTab] = useState<ContentSubTab>('conversations');
  const [contentSearch, setContentSearch] = useState('');
  const [contentPage, setContentPage] = useState(0);
  const contentLimit = 20;

  // Load settings on mount
  useEffect(() => {
    fetchBackends();
    api<{ settings: any }>('/api/settings').then(({ settings }) => {
      setDefaultBackendId(settings.default_backend_id ? String(settings.default_backend_id) : '');
      setDefaultModel(settings.default_model || '');
      setDefaultConvType(settings.default_conversation_type || 'standard');
    });
  }, [fetchBackends]);

  // Load models when backend changes
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

  // Load admin data when admin tabs are active
  useEffect(() => {
    if (activeTab === 'stats' && isAdmin) fetchStats();
  }, [activeTab, isAdmin, fetchStats]);

  useEffect(() => {
    if (activeTab !== 'users' || !isAdmin) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers({ search: userSearch || undefined });
    }, userSearch ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [activeTab, userSearch, isAdmin, fetchUsers]);

  useEffect(() => {
    setContentPage(0);
  }, [contentTab, contentSearch]);

  useEffect(() => {
    if (activeTab !== 'content' || !isAdmin) return;
    if (contentTab === 'conversations') {
      fetchAdminConversations({ search: contentSearch || undefined, limit: contentLimit, offset: contentPage * contentLimit });
    } else {
      fetchAdminExperts({ search: contentSearch || undefined, limit: contentLimit, offset: contentPage * contentLimit });
    }
  }, [activeTab, contentTab, contentSearch, contentPage, isAdmin, fetchAdminConversations, fetchAdminExperts]);

  async function handleSaveSettings() {
    setSettingsLoading(true);
    setSettingsSaved(false);
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          default_backend_id: defaultBackendId ? Number(defaultBackendId) : null,
          default_model: defaultModel || null,
          default_conversation_type: defaultConvType,
        }),
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } finally {
      setSettingsLoading(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPassword.length < 8) { setPwError('New password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    setPwLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPwSuccess('Password updated successfully');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  }

  const tabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'defaults', label: 'Defaults' },
    ...(isAdmin ? [
      { key: 'users' as Tab, label: 'Users', adminOnly: true },
      { key: 'content' as Tab, label: 'Content', adminOnly: true },
      { key: 'stats' as Tab, label: 'Stats', adminOnly: true },
    ] : []),
  ];

  const contentTotal = contentTab === 'conversations' ? adminConversationsTotal : adminExpertsTotal;
  const contentTotalPages = Math.ceil(contentTotal / contentLimit);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-border pb-px overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === t.key
                  ? 'bg-primary/10 text-primary border-b-2 border-primary'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Account Info</h2>
              {profileError && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{profileError}</div>}
              {profileSuccess && <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">{profileSuccess}</div>}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-text-muted mb-1">Username</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-muted mb-1">Role</label>
                  <p className="text-text-primary capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setProfileError(''); setProfileSuccess(''); setProfileSaving(true);
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
            </div>

            {/* Change Password */}
            <div className="bg-surface rounded-xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Change Password</h2>
              {pwError && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{pwError}</div>}
              {pwSuccess && <div className="mb-4 p-3 rounded-lg bg-success/10 text-success text-sm">{pwSuccess}</div>}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Current Password</label>
                  <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">New Password</label>
                  <input type="password" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm text-text-secondary mb-1">Confirm New Password</label>
                  <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                </div>
                <button type="submit" disabled={pwLoading} className="w-full py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {pwLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>

            {/* Sign Out & Delete */}
            <div className="flex gap-3">
              <button
                onClick={async () => { await logout(); navigate('/login'); }}
                className="flex-1 py-2 rounded-lg border border-border text-text-secondary font-medium hover:text-text-primary hover:bg-surface transition-colors"
              >
                Sign Out
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="px-4 py-2 rounded-lg border border-destructive text-destructive font-medium hover:bg-destructive/10 transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        )}

        {/* Defaults Tab */}
        {activeTab === 'defaults' && (
          <div className="bg-surface rounded-xl border border-border p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Default AI Backend</h2>
            <p className="text-sm text-text-muted mb-3">Used when an expert has no backend assigned.</p>
            <div className="flex gap-2">
              <select value={defaultBackendId} onChange={(e) => setDefaultBackendId(e.target.value)} className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary">
                <option value="">System default (Ollama localhost)</option>
                {backends.filter((b) => b.is_active).map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.type})</option>
                ))}
              </select>
              <button onClick={handleSaveSettings} disabled={settingsLoading} className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {settingsLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
            {defaultBackendId && (
              <div className="mt-3">
                <label className="block text-sm text-text-muted mb-1">Default Model</label>
                {modelsLoading ? (
                  <p className="text-xs text-text-muted">Loading models...</p>
                ) : models.length > 0 ? (
                  <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary">
                    <option value="">Auto (backend default)</option>
                    {models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input type="text" value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} placeholder="Model name (optional)" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary" />
                )}
              </div>
            )}
            <div className="mt-3">
              <label className="block text-sm text-text-muted mb-1">Default Conversation Type</label>
              <select value={defaultConvType} onChange={(e) => setDefaultConvType(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary">
                <option value="standard">Standard</option>
                <option value="research">Research</option>
                <option value="brainstorm">Brainstorm</option>
                <option value="debug">Debug</option>
              </select>
            </div>
            {settingsSaved && <p className="mt-2 text-sm text-green-400">Settings saved.</p>}
            {backends.length === 0 && (
              <p className="mt-3 text-sm text-text-muted">
                No backends configured. <Link to="/backends/new" className="text-primary hover:underline">Add one</Link>
              </p>
            )}
          </div>
        )}

        {/* Users Tab (admin) */}
        {activeTab === 'users' && isAdmin && (
          <div>
            <div className="mb-4">
              <input type="text" placeholder="Search users by name or email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="w-full max-w-sm px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary" />
            </div>
            {usersLoading ? (
              <p className="text-text-secondary text-center py-12">Loading...</p>
            ) : (
              <div className="bg-surface rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Username</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Email</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Role</th>
                      <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Created</th>
                      <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm text-text-primary">{u.username}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{u.email}</td>
                        <td className="px-4 py-3">
                          <select value={u.role} onChange={(e) => updateUserRole(u.id, e.target.value)} disabled={u.id === user?.id} className="px-2 py-1 rounded bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-50">
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-sm text-text-muted">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          {u.id !== user?.id && (
                            <div className="flex gap-3 justify-end">
                              <button
                                onClick={async () => {
                                  try {
                                    const pw = await resetUserPassword(u.id);
                                    setTempPasswordModal({ username: u.username, password: pw });
                                  } catch (err: any) {
                                    toast.error(err.message || 'Failed to reset password');
                                  }
                                }}
                                className="text-sm text-primary hover:underline"
                              >
                                Reset PW
                              </button>
                              <button
                                onClick={async () => {
                                  if (await confirm({ title: 'Delete User', message: `Delete user "${u.username}"? This cannot be undone.` })) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="text-sm text-destructive hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Content Tab (admin) */}
        {activeTab === 'content' && isAdmin && (
          <div>
            <div className="flex gap-1 mb-4">
              {(['conversations', 'experts'] as ContentSubTab[]).map((t) => (
                <button key={t} onClick={() => setContentTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${contentTab === t ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'}`}>
                  {t}
                </button>
              ))}
            </div>
            <input type="text" placeholder={`Search ${contentTab}...`} value={contentSearch} onChange={(e) => setContentSearch(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary mb-4" />
            <div className="bg-surface rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {contentTab === 'conversations' ? (
                      <>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Title</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Messages</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Created</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">Actions</th>
                      </>
                    ) : (
                      <>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Name</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Domain</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-text-secondary">Created</th>
                        <th className="text-right px-4 py-3 text-sm font-medium text-text-secondary">Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {contentTab === 'conversations' ? (
                    adminConversations.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No conversations found.</td></tr>
                    ) : adminConversations.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm text-text-primary">{c.title}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{c.username}</td>
                        <td className="px-4 py-3 text-sm text-text-muted">{c.message_count}</td>
                        <td className="px-4 py-3 text-sm text-text-muted">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!await confirm({ title: 'Delete Conversation', message: `Delete conversation "${c.title}"?` })) return;
                              try { await deleteAdminConversation(c.id); } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
                            }}
                            className="text-sm text-destructive hover:underline"
                          >Delete</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    adminExperts.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-text-muted">No experts found.</td></tr>
                    ) : adminExperts.map((e) => (
                      <tr key={e.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-sm text-text-primary">{e.name}</td>
                        <td className="px-4 py-3 text-sm text-text-secondary">{e.username}</td>
                        <td className="px-4 py-3 text-sm text-text-muted">{e.domain}</td>
                        <td className="px-4 py-3 text-sm text-text-muted">{new Date(e.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={async () => {
                              if (!await confirm({ title: 'Delete Expert', message: `Delete expert "${e.name}"?` })) return;
                              try { await deleteAdminExpert(e.id); } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
                            }}
                            className="text-sm text-destructive hover:underline"
                          >Delete</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {contentTotalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-4">
                <button onClick={() => setContentPage((p) => Math.max(0, p - 1))} disabled={contentPage === 0} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 text-sm">Previous</button>
                <span className="text-sm text-text-secondary">Page {contentPage + 1} of {contentTotalPages}</span>
                <button onClick={() => setContentPage((p) => p + 1)} disabled={contentPage + 1 >= contentTotalPages} className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 text-sm">Next</button>
              </div>
            )}
          </div>
        )}

        {/* Stats Tab (admin) */}
        {activeTab === 'stats' && isAdmin && (
          <div>
            {!stats ? (
              <p className="text-text-secondary text-center py-12">Loading...</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'Users', value: stats.users },
                  { label: 'Conversations', value: stats.conversations },
                  { label: 'Messages', value: stats.messages },
                  { label: 'Experts', value: stats.experts },
                  { label: 'Backends', value: stats.backends },
                  { label: 'DB Size', value: formatBytes(stats.db_size) },
                ].map((card) => (
                  <div key={card.label} className="bg-surface rounded-xl border border-border p-6">
                    <p className="text-sm text-text-muted mb-1">{card.label}</p>
                    <p className="text-3xl font-semibold text-text-primary">{card.value}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-text-primary mb-2">Confirm Account Deletion</h3>
            <p className="text-sm text-text-secondary mb-4">Enter your password to permanently delete your account.</p>
            {deleteError && <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{deleteError}</div>}
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Your password" className="w-full px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary mb-4" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteError(''); }} className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors">Cancel</button>
              <button
                disabled={deleteLoading || !deletePassword}
                onClick={async () => {
                  setDeleteError(''); setDeleteLoading(true);
                  try { await deleteAccount(deletePassword); navigate('/login'); } catch (err: any) { setDeleteError(err.message || 'Failed to delete account'); } finally { setDeleteLoading(false); }
                }}
                className="px-4 py-2 rounded-lg bg-destructive text-white text-sm disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temp Password Modal */}
      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-text-primary mb-2">Password Reset</h3>
            <p className="text-sm text-text-secondary mb-3">Temporary password for <strong>{tempPasswordModal.username}</strong>:</p>
            <code className="block p-3 rounded-lg bg-background text-text-primary text-sm font-mono mb-4 select-all">{tempPasswordModal.password}</code>
            <p className="text-xs text-text-muted mb-4">The user will be required to change their password on next login.</p>
            <button onClick={() => setTempPasswordModal(null)} className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
