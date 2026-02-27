import { useEffect, useState } from 'react';
import { useExpertStore } from '../stores/expertStore';
import { toast } from '../stores/toastStore';
import { useConfirmStore } from '../stores/confirmStore';

export default function CategoriesPage() {
  const { allCategories, fetchAllCategories, createCategory, deleteCategory, renameCategory } = useExpertStore();
  const [newName, setNewName] = useState('');
  const confirm = useConfirmStore((s) => s.confirm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    fetchAllCategories();
  }, [fetchAllCategories]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory(name);
      setNewName('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create category');
    }
  };

  const handleRename = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    try {
      await renameCategory(id, name);
      setEditingId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to rename category');
    }
  };

  const handleDelete = async (id: number, expertCount: number) => {
    const msg = expertCount > 0
      ? `This category has ${expertCount} expert(s) assigned. Delete anyway?`
      : 'Delete this category?';
    if (!await confirm({ title: 'Delete Category', message: msg })) return;
    try {
      await deleteCategory(id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete category');
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold text-text-primary mb-6">Categories</h1>

        {/* Create */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="New category name..."
            className="flex-1 px-3 py-2 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleCreate}
            disabled={!newName.trim()}
            className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            Create
          </button>
        </div>

        {/* List */}
        {allCategories.length === 0 ? (
          <p className="text-text-muted text-center py-12">No categories yet.</p>
        ) : (
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {allCategories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                {editingId === cat.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(cat.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    onBlur={() => handleRename(cat.id)}
                    className="flex-1 px-2 py-1 rounded bg-background border border-border text-text-primary text-sm focus:outline-none focus:border-primary mr-2"
                  />
                ) : (
                  <div
                    className="flex-1 cursor-pointer"
                    onClick={() => { setEditingId(cat.id); setEditName(cat.name); }}
                  >
                    <span className="text-text-primary">{cat.name}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      {cat.expert_count ?? 0} expert{(cat.expert_count ?? 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(cat.id, cat.expert_count ?? 0)}
                  className="text-sm text-destructive hover:underline ml-2"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
