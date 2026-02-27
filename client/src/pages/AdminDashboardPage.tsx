import { useEffect } from 'react';
import { Link } from 'react-router';
import { useAdminStore } from '../stores/adminStore';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDashboardPage() {
  const { stats, fetchStats } = useAdminStore();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cards = stats
    ? [
        { label: 'Users', value: stats.users },
        { label: 'Conversations', value: stats.conversations },
        { label: 'Messages', value: stats.messages },
        { label: 'Experts', value: stats.experts },
        { label: 'Backends', value: stats.backends },
        { label: 'DB Size', value: formatBytes(stats.db_size) },
      ]
    : [];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Admin Dashboard</h1>
          <div className="flex gap-2">
            <Link
              to="/admin/content"
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Content
            </Link>
            <Link
              to="/admin/users"
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Manage Users
            </Link>
          </div>
        </div>

        {!stats ? (
          <p className="text-text-secondary text-center py-12">Loading...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div
                key={card.label}
                className="bg-surface rounded-xl border border-border p-6"
              >
                <p className="text-sm text-text-muted mb-1">{card.label}</p>
                <p className="text-3xl font-semibold text-text-primary">{card.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
