import { create } from 'zustand';

interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  resolve: ((value: boolean) => void) | null;
  confirm: (opts: { title: string; message: string; confirmLabel?: string }) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'Delete',
  resolve: null,

  confirm: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel || 'Delete',
        resolve,
      });
    });
  },

  handleConfirm: () => {
    get().resolve?.(true);
    set({ open: false, resolve: null });
  },

  handleCancel: () => {
    get().resolve?.(false);
    set({ open: false, resolve: null });
  },
}));
