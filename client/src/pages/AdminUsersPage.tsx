import { useEffect } from 'react';
import { Link } from 'react-router';
import { useAdminStore } from '../stores/adminStore';
import { useAuthStore } from '../stores/authStore';

export default function AdminUsersPage() {
  const { users, isLoading, fetchUsers, updateUserRole, deleteUser } = useAdminStore();
  const currentUser = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/conversations" className="text-text-muted hover:text-text-primary transition-colors">
              &larr; Back
            </Link>
            <h1 className="text-2xl font-semibold text-text-primary">User Management</h1>
          </div>
          <Link
            to="/admin"
            className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
          >
            Dashboard
          </Link>
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
                        <button
                          onClick={() => {
                            if (confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
                              deleteUser(user.id);
                            }
                          }}
                          className="text-sm text-destructive hover:underline"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
