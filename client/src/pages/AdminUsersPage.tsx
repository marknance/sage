import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router';
import { useAdminStore } from '../stores/adminStore';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';

export default function AdminUsersPage() {
  const { users, isLoading, fetchUsers, updateUserRole, deleteUser, resetUserPassword } = useAdminStore();
  const currentUser = useAuthStore((s) => s.user);
  const confirm = useConfirmStore((s) => s.confirm);
  const [tempPasswordModal, setTempPasswordModal] = useState<{ username: string; password: string } | null>(null);
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchUsers({ search: search || undefined });
    }, search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [search, fetchUsers]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">User Management</h1>
          <Link
            to="/admin"
            className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          />
        </div>

        {isLoading ? (
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
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-sm text-text-primary">{user.username}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        disabled={user.id === currentUser?.id}
                        className="px-2 py-1 rounded bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-primary disabled:opacity-50"
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {user.id !== currentUser?.id && (
                        <div className="flex gap-3 justify-end">
                          <button
                            onClick={async () => {
                              try {
                                const pw = await resetUserPassword(user.id);
                                setTempPasswordModal({ username: user.username, password: pw });
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
                              if (await confirm({ title: 'Delete User', message: `Delete user "${user.username}"? This cannot be undone.` })) {
                                deleteUser(user.id);
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

      {tempPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-medium text-text-primary mb-2">Password Reset</h3>
            <p className="text-sm text-text-secondary mb-3">
              Temporary password for <strong>{tempPasswordModal.username}</strong>:
            </p>
            <code className="block p-3 rounded-lg bg-background text-text-primary text-sm font-mono mb-4 select-all">
              {tempPasswordModal.password}
            </code>
            <p className="text-xs text-text-muted mb-4">The user will be required to change their password on next login.</p>
            <button
              onClick={() => setTempPasswordModal(null)}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
