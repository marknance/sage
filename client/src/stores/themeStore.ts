import { create } from 'zustand';
import { api } from '../lib/api';

type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  init: () => void;
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.classList.add('light');
  } else {
    document.documentElement.classList.remove('light');
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem('sage-theme') as Theme) || 'dark',

  init: () => {
    const stored = localStorage.getItem('sage-theme') as Theme | null;
    if (stored) {
      applyTheme(stored);
      set({ theme: stored });
    }
    // Sync from server settings
    api<{ settings: { theme?: string } }>('/api/settings').then(({ settings }) => {
      if (settings.theme && !stored) {
        const t = settings.theme as Theme;
        applyTheme(t);
        localStorage.setItem('sage-theme', t);
        set({ theme: t });
      }
    }).catch(() => {});
  },

  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('sage-theme', next);
    set({ theme: next });
    // Persist to server
    api('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  },
}));
