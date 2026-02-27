import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
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
  const user = useAuthStore((s) => s.user);
  const { theme, toggle, init } = useThemeStore();
  const [health, setHealth] = useState<'ok' | 'error' | 'checking'>('checking');

  useEffect(() => { init(); }, [init]);

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

  return (
    <nav className="h-14 bg-surface border-b border-border flex items-center px-4 shrink-0">
      <Link to="/" className="text-lg font-semibold text-text-primary mr-8 flex items-center gap-2">
        Sage
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            health === 'ok' ? 'bg-green-500' : health === 'error' ? 'bg-red-500' : 'bg-gray-400 animate-pulse'
          }`}
          title={health === 'ok' ? 'Server connected' : health === 'error' ? 'Server connection lost' : 'Checking server...'}
        />
      </Link>
      <div className="flex gap-1">
        {NAV_ITEMS.map((item) => {
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
        {user?.role === 'admin' && (
          <Link
            to="/admin"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              location.pathname.startsWith('/admin')
                ? 'bg-primary/10 text-primary'
                : 'text-text-secondary hover:text-text-primary hover:bg-background'
            }`}
          >
            Admin
          </Link>
        )}
      </div>
      <div className="ml-auto">
        <button
          onClick={toggle}
          className="px-2 py-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors text-sm"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
        </button>
      </div>
    </nav>
  );
}
