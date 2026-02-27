import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../lib/api';
import { useConversationStore } from '../stores/conversationStore';

export default function ConversationsPage() {
  const { conversations, total, limit, offset, isLoading, fetchConversations, createConversation, togglePin } = useConversationStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [page, setPage] = useState(0);
  const [newType, setNewType] = useState('standard');

  useEffect(() => {
    api<{ settings: any }>('/api/settings').then(({ settings }) => {
      if (settings.default_conversation_type) setNewType(settings.default_conversation_type);
    }).catch(() => {});
  }, []);
  const [filterType, setFilterType] = useState('');
  const [pinnedOnly, setPinnedOnly] = useState(false);

  useEffect(() => {
    setPage(0); // reset page on filter change
  }, [search, sort, filterType, pinnedOnly]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchConversations({ search: search || undefined, sort, type: filterType || undefined, pinned: pinnedOnly ? '1' : undefined, offset: page * 24 });
    }, search ? 300 : 0);
    return () => clearTimeout(debounceRef.current);
  }, [search, sort, filterType, pinnedOnly, page, fetchConversations]);

  const handleNew = async () => {
    const conv = await createConversation(undefined, newType);
    navigate(`/conversations/${conv.id}`);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Conversations</h1>
          <div className="flex gap-3 items-center">
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-sm focus:outline-none focus:border-primary"
            >
              <option value="standard">Standard</option>
              <option value="research">Research</option>
              <option value="brainstorm">Brainstorm</option>
              <option value="debug">Debug</option>
            </select>
            <button
              onClick={handleNew}
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              New Conversation
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="recent">Recently Updated</option>
            <option value="title">Title</option>
            <option value="created">Newest</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">All Types</option>
            <option value="standard">Standard</option>
            <option value="research">Research</option>
            <option value="brainstorm">Brainstorm</option>
            <option value="debug">Debug</option>
          </select>
          <label className="flex items-center gap-2 px-3 py-2 cursor-pointer text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={pinnedOnly}
              onChange={(e) => setPinnedOnly(e.target.checked)}
              className="accent-primary"
            />
            Pinned only
          </label>
        </div>

        {/* Content */}
        {isLoading ? (
          <p className="text-text-secondary text-center py-12">Loading...</p>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-4">No conversations yet. Start your first one!</p>
            <button
              onClick={handleNew}
              className="inline-block px-6 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              New Conversation
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`bg-surface rounded-xl border p-5 hover:border-primary/50 transition-colors relative ${
                  conv.is_pinned ? 'border-primary/30' : 'border-border'
                }`}
              >
                <button
                  onClick={(e) => { e.preventDefault(); togglePin(conv.id); }}
                  className={`absolute top-2 right-2 text-sm z-10 p-1 rounded hover:bg-background transition-colors ${
                    conv.is_pinned ? 'text-primary' : 'text-text-muted opacity-0 group-hover:opacity-100'
                  }`}
                  title={conv.is_pinned ? 'Unpin' : 'Pin'}
                  style={conv.is_pinned ? {} : { opacity: 0.4 }}
                >
                  {conv.is_pinned ? '\uD83D\uDCCC' : '\uD83D\uDCCC'}
                </button>
                <Link
                  to={`/conversations/${conv.id}`}
                  className="block"
                >
                <div className="flex items-start justify-between mb-2 pr-6">
                  <h3 className="text-lg font-medium text-text-primary line-clamp-1">{conv.title}</h3>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs shrink-0">
                    {conv.type}
                  </span>
                </div>
                {conv.last_message && (
                  <p className="text-sm text-text-muted mb-3 line-clamp-2">{conv.last_message}</p>
                )}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{conv.expert_count || 0} expert{conv.expert_count !== 1 ? 's' : ''} &middot; {conv.message_count || 0} msg{conv.message_count !== 1 ? 's' : ''}</span>
                  <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-center gap-4 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-text-secondary">
              Page {page + 1} of {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={offset + limit >= total}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
