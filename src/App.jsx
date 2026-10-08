import { useSettings, isSignedIn } from './store/settings.js';
import SetupScreen from './components/SetupScreen.jsx';
import { useEffect } from 'react';
import MainScreen from './components/MainScreen.jsx';

export default function App() {
  const signedIn = useSettings(isSignedIn);
  const notice = useSettings((s) => s.signOutNotice);
  useEffect(() => { if (signedIn && notice) useSettings.getState().set({ signOutNotice: '' }); }, [signedIn, notice]);
  return signedIn ? <MainScreen /> : <SetupScreen notice={notice} />;
}
