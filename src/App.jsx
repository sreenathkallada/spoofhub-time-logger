import { useSettings, isSignedIn } from './store/settings.js';
import SetupScreen from './components/SetupScreen.jsx';
import MainScreen from './components/MainScreen.jsx';

export default function App() {
  const signedIn = useSettings(isSignedIn);
  return signedIn ? <MainScreen /> : <SetupScreen />;
}
