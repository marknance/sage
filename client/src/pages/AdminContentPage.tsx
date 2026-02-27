import { useEffect, useState } from 'react';
import { useAdminStore } from '../stores/adminStore';
import { toast } from '../stores/toastStore';

type Tab = 'conversations' | 'experts';

export default function AdminContentPage() {
  const {
    adminConversations, adminConversationsTotal,
    adminExperts, adminExpertsTotal,
    fetchAdminConversations, fetchAdminExperts,
    deleteAdminConversation, deleteAdminExpert,
  } = useAdminStore();
  const [tab, setTab] = useState<Tab>('conversations');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const limit = 20;

  useEffect(() => {
    setPage(0);
  }, [tab, search]);

  useEffect(() => {
    if (tab === 'conversations') {
      fetchAdminConversations({ search: search || undefined, limit, offset: page * limit });
    } else {
      fetchAdminExperts({ search: search || undefined, limit, offset: page * limit });
    }
  }, [tab, search, page, fetchAdminConversations, fetchAdminExperts]);

  const total = tab === 'conversations' ? adminConversationsTotal : adminExpertsTotal;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold text-text-primary mb-6">Content Management</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-4">
          {(['conversations', 'experts'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                tab === t ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder={`Search ${tab}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary mb-4"
        />

        {/* Table */}
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {tab === 'conversations' ? (
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
              {tab === 'conversations' ? (
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
                          if (!confirm(`Delete conversation "${c.title}"?`)) return;
                          try {
                            await deleteAdminConversation(c.id);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to delete');
                          }
                        }}
                        className="text-sm text-destructive hover:underline"
                      >
                        Delete
                      </button>
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
                          if (!confirm(`Delete expert "${e.name}"?`)) return;
                          try {
                            await deleteAdminExpert(e.id);
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to delete');
                          }
                        }}
                        className="text-sm text-destructive hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 text-sm"
            >
              Previous
            </button>
            <span className="text-sm text-text-secondary">Page {page + 1} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page + 1 >= totalPages}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
