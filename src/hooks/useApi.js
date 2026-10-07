import { useMemo } from 'react';
import { makeApi } from '../api/endpoints.js';
import { useSettings } from '../store/settings.js';

/** API bound to the current key. The key is read lazily so a Settings change applies immediately. */
const getKey = () => useSettings.getState().apiKey;
const getBase = () => useSettings.getState().baseUrl;
export function useApi() {
  return useMemo(() => makeApi(getKey, getBase), []);
}
export const api = makeApi(getKey, getBase);
