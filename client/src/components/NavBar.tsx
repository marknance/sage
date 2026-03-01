import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

const NAV_ITEMS = [
  { to: '/conversations', label: 'Conversations' },
  { to: '/experts', label: 'Experts' },
  { to: '/categories', label: 'Categories' },
  { to: '/backends', label: 'Backends' },
];

export default function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { theme, toggle, init } = useThemeStore();
  const [health, setHealth] = useState<'ok' | 'error' | 'checking'>('checking');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { init(); }, [init]);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (location.pathname !== '/conversations') {
        navigate('/conversations');
      }
      setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search conversations"]');
        input?.focus();
        input?.select();
      }, 100);
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'E') {
      e.preventDefault();
      navigate('/experts');
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      navigate('/experts/new');
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      navigate('/conversations');
    }
    if (e.key === 'Escape') {
      const modal = document.querySelector('.fixed.inset-0.z-50');
      if (modal) {
        const closeBtn = modal.querySelector<HTMLButtonElement>('button');
        if (closeBtn?.textContent?.includes('Cancel') || closeBtn?.textContent?.includes('Close') || closeBtn?.textContent?.includes('Done')) {
          closeBtn.click();
        }
      }
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const check = () => {
      fetch('/api/health')
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((d) => setHealth(d.status === 'ok' ? 'ok' : 'error'))
        .catch(() => setHealth('error'));
    };
    check();
    const id = setInterval(check, 30000);
    return () => clearInterval(id);
  }, []);

  const allItems = NAV_ITEMS;

  return (
    <nav className="bg-surface border-b border-border shrink-0 relative">
      <div className="h-14 flex items-center px-4">
        <Link to="/" className="text-lg font-semibold text-text-primary mr-8 flex items-center gap-2">
          Sage
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              health === 'ok' ? 'bg-green-500' : health === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'
            }`}
            title={health === 'ok' ? 'Server connected' : health === 'error' ? 'Server connection lost' : 'Checking server...'}
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex gap-1">
          {allItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => {
              if (location.pathname !== '/conversations') navigate('/conversations');
              setTimeout(() => {
                const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search conversations"]');
                input?.focus();
                input?.select();
              }, 100);
            }}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border text-text-muted text-xs hover:text-text-secondary hover:border-border transition-colors"
            title="Search conversations (Ctrl+K)"
          >
            Search
            <kbd className="px-1 py-0.5 rounded bg-background border border-border text-[10px]">
              {navigator.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}K
            </kbd>
          </button>
          <Link
            to="/settings"
            className={`px-2 py-1.5 rounded-lg transition-colors ${
              location.pathname.startsWith('/settings')
                ? 'text-primary bg-primary/10'
                : 'text-text-secondary hover:text-text-primary hover:bg-background'
            }`}
            title="Settings"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path d="M16.18 12.32a1.25 1.25 0 00.25 1.38l.05.04a1.52 1.52 0 01-1.07 2.59 1.52 1.52 0 01-1.08-.44l-.04-.05a1.25 1.25 0 00-1.38-.25 1.25 1.25 0 00-.76 1.15v.14a1.52 1.52 0 01-3.03 0v-.07a1.25 1.25 0 00-.82-1.15 1.25 1.25 0 00-1.38.25l-.04.05a1.52 1.52 0 01-2.15-2.15l.05-.04a1.25 1.25 0 00.25-1.38 1.25 1.25 0 00-1.15-.76h-.14a1.52 1.52 0 010-3.03h.07a1.25 1.25 0 001.15-.82 1.25 1.25 0 00-.25-1.38l-.05-.04a1.52 1.52 0 012.15-2.15l.04.05a1.25 1.25 0 001.38.25h.06a1.25 1.25 0 00.76-1.15v-.14a1.52 1.52 0 013.03 0v.07a1.25 1.25 0 00.76 1.15 1.25 1.25 0 001.38-.25l.04-.05a1.52 1.52 0 012.15 2.15l-.05.04a1.25 1.25 0 00-.25 1.38v.06a1.25 1.25 0 001.15.76h.14a1.52 1.52 0 010 3.03h-.07a1.25 1.25 0 00-1.15.76z" />
            </svg>
          </Link>
          <button
            onClick={toggle}
            className="px-2 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors text-sm"
            title={theme === 'dark' ? 'Switch to light mode' : theme === 'light' ? 'Switch to Thunder Light' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '\u2600\uFE0F' : theme === 'light' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9" />
                <polyline points="13 11 9 17 15 17 11 23" />
              </svg>
            ) : '\uD83C\uDF19'}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden px-2 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
            aria-label="Toggle navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {mobileOpen ? (
                <>
                  <line x1="4" y1="4" x2="16" y2="16" />
                  <line x1="16" y1="4" x2="4" y2="16" />
                </>
              ) : (
                <>
                  <line x1="3" y1="5" x2="17" y2="5" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="15" x2="17" y2="15" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-2 flex flex-col gap-1">
          {allItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
