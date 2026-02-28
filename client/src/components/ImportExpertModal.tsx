import { useState, useEffect, type ChangeEvent } from 'react';
import { useExpertStore, type Expert } from '../stores/expertStore';
import { api } from '../lib/api';
import { toast } from '../stores/toastStore';

interface Props {
  onClose: () => void;
  onImported: (expertId: number) => void;
}

export default function ImportExpertModal({ onClose, onImported }: Props) {
  const { importExpert } = useExpertStore();
  const [fileData, setFileData] = useState<any>(null);
  const [fileName, setFileName] = useState('');
  const [strategy, setStrategy] = useState<'skip' | 'rename' | 'overwrite'>('rename');
  const [loading, setLoading] = useState(false);
  const [existingMatch, setExistingMatch] = useState<Expert | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!fileData?.name) {
      setExistingMatch(null);
      return;
    }
    setIsChecking(true);
    api<{ experts: Expert[] }>(`/api/experts?search=${encodeURIComponent(fileData.name)}`)
      .then(({ experts }) => {
        const match = experts.find((e) => e.name.toLowerCase() === fileData.name.toLowerCase());
        setExistingMatch(match || null);
      })
      .catch(() => setExistingMatch(null))
      .finally(() => setIsChecking(false));
  }, [fileData?.name]);

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!parsed.sage_export_version || !parsed.name) {
          toast.error('Invalid export file format');
          setFileData(null);
          return;
        }
        setFileData(parsed);
      } catch {
        toast.error('Failed to parse JSON file');
        setFileData(null);
      }
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!fileData) return;
    setLoading(true);
    try {
      const expert = await importExpert(fileData, strategy);
      onImported(expert.id);
    } catch (err: any) {
      toast.error(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        className="bg-surface border border-border rounded-xl p-6 max-w-md mx-4 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="import-title" className="text-lg font-medium text-text-primary mb-4">Import Expert</h3>

        <div className="mb-4">
          <input
            type="file"
            accept=".json"
            onChange={handleFile}
            className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          {fileName && <p className="text-xs text-text-muted mt-1">{fileName}</p>}
        </div>

        {fileData && (
          <>
            <div className="mb-4 p-3 rounded-lg bg-background border border-border">
              <p className="text-sm text-text-primary font-medium">{fileData.name}</p>
              <p className="text-xs text-text-muted">{fileData.domain}</p>
              {fileData.description && (
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{fileData.description}</p>
              )}
              <div className="flex gap-3 mt-2 text-xs text-text-muted">
                {fileData.behaviors && <span>{fileData.behaviors.length} behaviors</span>}
                {fileData.categories && <span>{fileData.categories.length} categories</span>}
                {fileData.memories && <span>{fileData.memories.length} memories</span>}
              </div>
            </div>

            {isChecking ? (
              <p className="text-xs text-text-muted mb-4">Checking for conflicts...</p>
            ) : existingMatch ? (
              <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-500 font-medium mb-2">
                  An expert named &ldquo;{existingMatch.name}&rdquo; already exists
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted">
                      <th className="text-left py-1"></th>
                      <th className="text-left py-1">Existing</th>
                      <th className="text-left py-1">Importing</th>
                    </tr>
                  </thead>
                  <tbody className="text-text-secondary">
                    <tr>
                      <td className="py-1 text-text-muted">Domain</td>
                      <td className="py-1">{existingMatch.domain}</td>
                      <td className="py-1">{fileData.domain}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">Description</td>
                      <td className="py-1 truncate max-w-[120px]">{existingMatch.description || '-'}</td>
                      <td className="py-1 truncate max-w-[120px]">{fileData.description || '-'}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">Behaviors</td>
                      <td className="py-1">-</td>
                      <td className="py-1">{fileData.behaviors?.length || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">Categories</td>
                      <td className="py-1">{existingMatch.category_names ? existingMatch.category_names.split(',').length : 0}</td>
                      <td className="py-1">{fileData.categories?.length || 0}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-text-muted">Memories</td>
                      <td className="py-1">-</td>
                      <td className="py-1">{fileData.memories?.length || 0}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-sm text-green-500">No conflicts — will create new expert</p>
              </div>
            )}

            {existingMatch && (
              <div className="mb-4">
                <label className="block text-sm text-text-secondary mb-2">Conflict resolution:</label>
                <div className="space-y-2">
                  {[
                    { value: 'rename' as const, label: 'Rename', desc: 'Import as "Name (imported)"' },
                    { value: 'overwrite' as const, label: 'Overwrite', desc: 'Replace existing expert' },
                    { value: 'skip' as const, label: 'Skip', desc: 'Do not import' },
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="strategy"
                        value={opt.value}
                        checked={strategy === opt.value}
                        onChange={() => setStrategy(opt.value)}
                        className="mt-1 accent-primary"
                      />
                      <div>
                        <p className="text-sm text-text-primary">{opt.label}</p>
                        <p className="text-xs text-text-muted">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border text-text-secondary text-sm hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!fileData || loading}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}
