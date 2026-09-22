import { useMemo } from 'react';
import { makeApi } from '../api/endpoints.js';
import { useSettings } from '../store/settings.js';

/** API bound to the current key. The key is read lazily so a Settings change applies immediately. */
export function useApi() {
  return useMemo(() => makeApi(() => useSettings.getState().apiKey), []);
}
export const api = makeApi(() => useSettings.getState().apiKey);
