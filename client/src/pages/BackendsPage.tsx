import { useEffect } from 'react';
import { Link } from 'react-router';
import { useBackendStore } from '../stores/backendStore';

const TYPE_COLORS: Record<string, string> = {
  ollama: 'bg-green-500/10 text-green-400',
  openai: 'bg-blue-500/10 text-blue-400',
  anthropic: 'bg-orange-500/10 text-orange-400',
  lmstudio: 'bg-purple-500/10 text-purple-400',
  custom: 'bg-gray-500/10 text-gray-400',
};

export default function BackendsPage() {
  const { backends, isLoading, fetchBackends } = useBackendStore();

  useEffect(() => {
    fetchBackends();
  }, [fetchBackends]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">AI Backends</h1>
          <div className="flex gap-3">
            <Link
              to="/conversations"
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Conversations
            </Link>
            <Link
              to="/experts"
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Experts
            </Link>
            <Link
              to="/profile"
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Profile
            </Link>
            <Link
              to="/backends/new"
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Add Backend
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <p className="text-text-secondary text-center py-12">Loading...</p>
        ) : backends.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-2">No AI backends configured yet.</p>
            <p className="text-text-muted mb-4 text-sm">Add a backend to connect your experts to AI providers like Ollama, OpenAI, or Anthropic.</p>
            <Link
              to="/backends/new"
              className="inline-block px-6 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Add Backend
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {backends.map((backend) => (
              <Link
                key={backend.id}
                to={`/backends/${backend.id}`}
                className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-medium text-text-primary">{backend.name}</h3>
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${backend.is_active ? 'bg-green-400' : 'bg-gray-500'}`} />
                </div>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${TYPE_COLORS[backend.type] || TYPE_COLORS.custom}`}>
                  {backend.type}
                </span>
                {backend.base_url && (
                  <p className="text-sm text-text-muted truncate">{backend.base_url}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-xs text-text-muted">
                  {backend.has_api_key && <span>API Key set</span>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
