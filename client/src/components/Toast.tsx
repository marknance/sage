import { useToastStore } from '../stores/toastStore';

const borderColors: Record<string, string> = {
  success: 'border-l-success',
  error: 'border-l-destructive',
  warning: 'border-l-warning',
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`bg-surface border border-border ${borderColors[t.type]} border-l-4 rounded-lg px-4 py-3 shadow-lg animate-slide-in-right flex items-start gap-2`}
        >
          <p className="text-sm text-text-primary flex-1">{t.message}</p>
          <button
            onClick={() => removeToast(t.id)}
            className="text-text-muted hover:text-text-primary text-sm shrink-0"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
