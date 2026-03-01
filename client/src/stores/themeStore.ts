import { create } from 'zustand';
import { api } from '../lib/api';

type Theme = 'dark' | 'light' | 'thunder-light';

const THEME_ORDER: Theme[] = ['dark', 'light', 'thunder-light'];

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  init: () => void;
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.remove('light', 'thunder-light');
  if (theme !== 'dark') {
    document.documentElement.classList.add(theme);
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
    const current = get().theme;
    const idx = THEME_ORDER.indexOf(current);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
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
