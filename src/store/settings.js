import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettings = create(
  persist(
    (set) => ({
      baseUrl: '',   // e.g. https://projects.yourcompany.com/api/v3/ — entered at sign-in
      apiKey: '',
      userEmail: '',
      userId: null,
      userName: '',
      userInitials: '',
      userColor: '',
      identityVerified: false,
      signOutNotice: '',
      defaultStatus: 'billable',
      daysOfHistory: 60,
      scope: 'mine+unassigned',
      projectFilter: '',
      dailyTargetMins: 480,
      defaultTab: 'tasks', // 'tasks' | 'week'
      set: (patch) => set(patch),
      signOut: () =>
        set({ baseUrl: '', apiKey: '', userEmail: '', userId: null, userName: '', userInitials: '', userColor: '', identityVerified: false }),
    }),
    {
      name: 'phtl.settings',
      version: 2,
      migrate: (state) => ({ ...state, scope: state?.scope === 'all' ? 'mine+unassigned' : state?.scope }),
    },
  ),
);

export const isSignedIn = (s) => Boolean(s.baseUrl && s.apiKey && s.userId);
