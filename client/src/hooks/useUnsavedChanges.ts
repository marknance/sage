import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';

/**
 * Warns user before navigating away with unsaved changes.
 * Compatible with BrowserRouter (does not require data router).
 */
export function useUnsavedChanges(isDirty: boolean) {
  const navigate = useNavigate();
  const location = useLocation();
  const [blocked, setBlocked] = useState(false);
  const pendingRef = useRef<string | null>(null);

  // Handle browser close / refresh
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Intercept in-app link clicks when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href === location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = href;
      setBlocked(true);
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [isDirty, location.pathname]);

  const proceed = useCallback(() => {
    const target = pendingRef.current;
    setBlocked(false);
    pendingRef.current = null;
    if (target) navigate(target);
  }, [navigate]);

  const reset = useCallback(() => {
    setBlocked(false);
    pendingRef.current = null;
  }, []);

  return {
    state: blocked ? 'blocked' as const : 'idle' as const,
    proceed: blocked ? proceed : undefined,
    reset: blocked ? reset : undefined,
  };
}
