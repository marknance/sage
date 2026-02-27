import { Link, useLocation } from 'react-router';
import { useAuthStore } from '../stores/authStore';

const NAV_ITEMS = [
  { to: '/conversations', label: 'Conversations' },
  { to: '/experts', label: 'Experts' },
  { to: '/backends', label: 'Backends' },
  { to: '/profile', label: 'Profile' },
];

export default function NavBar() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  return (
    <nav className="h-14 bg-surface border-b border-border flex items-center px-4 shrink-0">
      <Link to="/" className="text-lg font-semibold text-text-primary mr-8">Sage</Link>
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
    </nav>
  );
}
