import { useState, type ChangeEvent } from 'react';
import { useExpertStore } from '../stores/expertStore';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md mx-4 w-full">
        <h3 className="text-lg font-medium text-text-primary mb-4">Import Expert</h3>

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

            <div className="mb-4">
              <label className="block text-sm text-text-secondary mb-2">If name already exists:</label>
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
