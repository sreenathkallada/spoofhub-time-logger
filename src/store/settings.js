import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettings = create(
  persist(
    (set) => ({
      apiKey: '',
      userEmail: '',
      userId: null,
      userName: '',
      userInitials: '',
      userColor: '',
      identityVerified: false,
      defaultStatus: 'billable',
      daysOfHistory: 60,
      scope: 'mine+unassigned',
      projectFilter: '',
      set: (patch) => set(patch),
      signOut: () =>
        set({ apiKey: '', userEmail: '', userId: null, userName: '', userInitials: '', userColor: '', identityVerified: false }),
    }),
    { name: 'phtl.settings', version: 1 },
  ),
);

export const isSignedIn = (s) => Boolean(s.apiKey && s.userId);
