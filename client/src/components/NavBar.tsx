import { useEffect, useState, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

const NAV_ITEMS = [
  { to: '/conversations', label: 'Conversations' },
  { to: '/experts', label: 'Experts' },
  { to: '/categories', label: 'Categories' },
  { to: '/backends', label: 'Backends' },
  { to: '/profile', label: 'Profile' },
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

  const allItems = [
    ...NAV_ITEMS,
    ...(user?.role === 'admin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ];

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
          <button
            onClick={toggle}
            className="px-2 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors text-sm"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
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
