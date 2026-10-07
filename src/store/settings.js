import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettings = create(
  persist(
    (set) => ({
      baseUrl: '',   // e.g. https://yourcompany.proofhub.com/api/v3/ — entered at sign-in
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
        set({ baseUrl: '', apiKey: '', userEmail: '', userId: null, userName: '', userInitials: '', userColor: '', identityVerified: false }),
    }),
    { name: 'phtl.settings', version: 1 },
  ),
);

export const isSignedIn = (s) => Boolean(s.baseUrl && s.apiKey && s.userId);
