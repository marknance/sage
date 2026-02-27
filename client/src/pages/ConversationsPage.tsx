import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useConversationStore } from '../stores/conversationStore';

export default function ConversationsPage() {
  const { conversations, isLoading, fetchConversations, createConversation } = useConversationStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleNew = async () => {
    const conv = await createConversation();
    navigate(`/conversations/${conv.id}`);
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Conversations</h1>
          <div className="flex gap-3">
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
            <button
              onClick={handleNew}
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              New Conversation
            </button>
          </div>
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
              <Link
                key={conv.id}
                to={`/conversations/${conv.id}`}
                className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-lg font-medium text-text-primary line-clamp-1">{conv.title}</h3>
                  <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs shrink-0">
                    {conv.type}
                  </span>
                </div>
                {conv.last_message && (
                  <p className="text-sm text-text-muted mb-3 line-clamp-2">{conv.last_message}</p>
                )}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span>{conv.expert_count || 0} expert{conv.expert_count !== 1 ? 's' : ''}</span>
                  <span>{new Date(conv.updated_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
