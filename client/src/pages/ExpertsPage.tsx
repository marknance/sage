import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { useExpertStore } from '../stores/expertStore';
import { useConversationStore } from '../stores/conversationStore';
import { useConfirmStore } from '../stores/confirmStore';
import ImportExpertModal from '../components/ImportExpertModal';
import { SkeletonGrid } from '../components/Skeleton';

export default function ExpertsPage() {
  const { experts, total, limit, offset, isLoading, fetchExperts, fetchAllCategories, allCategories, deleteExpert, exportExpert } = useExpertStore();
  const { createConversation, assignExpert } = useConversationStore();
  const confirm = useConfirmStore((s) => s.confirm);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('recent');
  const [showImport, setShowImport] = useState(false);
  const [page, setPage] = useState(0);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPage(0);
  }, [search, category, sort]);

  useEffect(() => {
    fetchExperts({ search: search || undefined, category: category || undefined, sort, offset: page * 24 });
    fetchAllCategories();
  }, [search, category, sort, page, fetchExperts, fetchAllCategories]);

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">Experts</h1>
          <div className="flex gap-3">
            <button
              onClick={() => setShowImport(true)}
              className="px-4 py-2 rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
            >
              Import Expert
            </button>
            <Link
              to="/experts/new"
              className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              New Expert
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search experts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="">All Categories</option>
            {allCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          >
            <option value="recent">Recently Used</option>
            <option value="name">Name</option>
            <option value="created">Newest</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonGrid />
        ) : experts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-text-muted mb-4">No experts yet. Create your first one!</p>
            <Link
              to="/experts/new"
              className="inline-block px-6 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
            >
              Create Expert
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experts.map((expert) => (
              <div
                key={expert.id}
                className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors relative"
              >
                {/* Quick actions menu */}
                <div className="absolute top-3 right-3 z-10" ref={menuOpen === expert.id ? menuRef : undefined}>
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(menuOpen === expert.id ? null : expert.id); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-background transition-colors text-lg"
                  >
                    &middot;&middot;&middot;
                  </button>
                  {menuOpen === expert.id && (
                    <div className="absolute right-0 mt-1 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-20">
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setMenuOpen(null);
                          const conv = await createConversation(undefined, 'standard');
                          await assignExpert(conv.id, expert.id);
                          navigate(`/conversations/${conv.id}`);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                      >
                        Start Conversation
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(null); navigate(`/experts/${expert.id}`); }}
                        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(null); exportExpert(expert.id); }}
                        className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background transition-colors"
                      >
                        Export
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setMenuOpen(null);
                          const ok = await confirm({ title: 'Delete Expert', message: `Delete "${expert.name}"? This cannot be undone.` });
                          if (ok) {
                            await deleteExpert(expert.id);
                            fetchExperts({ search: search || undefined, category: category || undefined, sort, offset: page * 24 });
                          }
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-background transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
                <Link to={`/experts/${expert.id}`} className="block">
                <h3 className="text-lg font-medium text-text-primary mb-1 pr-8">{expert.name}</h3>
                <p className="text-sm text-primary mb-2">{expert.domain}</p>
                {expert.description && (
                  <p className="text-sm text-text-muted mb-3 line-clamp-2">{expert.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-text-muted">
                  <span className="capitalize">{expert.personality_tone}</span>
                  {expert.last_used_at && (
                    <span>Used {new Date(expert.last_used_at).toLocaleDateString()}</span>
                  )}
                </div>
                {expert.category_names && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {expert.category_names.split(',').map((catName) => {
                      const cat = allCategories.find((c) => c.name === catName.trim());
                      return (
                        <span
                          key={catName}
                          onClick={(e) => {
                            if (cat) {
                              e.preventDefault();
                              setCategory(String(cat.id));
                            }
                          }}
                          className={`px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs ${cat ? 'cursor-pointer hover:bg-primary/20' : ''}`}
                        >
                          {catName}
                        </span>
                      );
                    })}
                  </div>
                )}
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

      {showImport && (
        <ImportExpertModal
          onClose={() => setShowImport(false)}
          onImported={(id) => {
            setShowImport(false);
            navigate(`/experts/${id}`);
          }}
        />
      )}
    </div>
  );
}
