import { useState } from 'react';
import { Eye, EyeOff, Clock } from 'lucide-react';
import { makeApi } from '../api/endpoints.js';
import { friendlyError } from '../api/errors.js';
import { useSettings } from '../store/settings.js';
import Avatar from './Avatar.jsx';
import { tips } from '../utils/tips.js';

export default function SetupScreen({ initialStep = 1, onClose }) {
  const settings = useSettings();
  const [step, setStep] = useState(initialStep);
  const [key, setKey] = useState(settings.apiKey || '');
  const [showKey, setShowKey] = useState(false);
  const [email, setEmail] = useState(settings.userEmail || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);

  const api = makeApi(() => key.trim());

  async function checkKey(e) {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const projects = await api.getProjects();
      if (!Array.isArray(projects)) throw new Error('Unexpected response from ProofHub');
      setStep(2);
    } catch (err) {
      setError(err?.kind === 'auth' ? 'That key was rejected — check you copied all of it.' : friendlyError(err));
    } finally { setBusy(false); }
  }

  async function checkEmail(e) {
    e.preventDefault();
    setError(''); setBusy(true); setMatch(null);
    try {
      const people = await api.getPeople();
      const wanted = email.trim().toLowerCase();
      const person = (people || []).find((p) => String(p.email || '').trim().toLowerCase() === wanted);
      if (!person) {
        setError('No ProofHub user has that email. Check the spelling, or ask your admin which email your ProofHub account uses.');
        return;
      }
      if (person.suspended) { setError('That ProofHub account is suspended.'); return; }
      setMatch(person);
    } catch (err) { setError(friendlyError(err)); } finally { setBusy(false); }
  }

  function confirm() {
    settings.set({
      apiKey: key.trim(),
      userEmail: email.trim(),
      userId: match.id,
      userName: `${match.first_name || ''} ${match.last_name || ''}`.trim(),
      userInitials: match.initials || '',
      userColor: match.profile_color || '',
      identityVerified: false,
    });
    onClose?.();
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <div className="setup-brand"><Clock size={22} /> <span>Time Logger</span></div>
        <p className="muted">A simpler way to log time against your ProofHub tasks. Two quick steps to connect.</p>

        <ol className="steps">
          <li className={step === 1 ? 'active' : 'done'}>API key</li>
          <li className={step === 2 ? 'active' : ''}>Your email</li>
        </ol>

        {step === 1 && (
          <form onSubmit={checkKey}>
            <h2>Paste your ProofHub API key</h2>
            <div className="howto">
              <p>In ProofHub, open the <strong>profile menu</strong> (top right), then <strong>click your profile picture five times</strong>. A window shows your API key — copy it.</p>
              <p className="muted small">The key stays in this browser only and is sent to projects.sblcorp.com and nowhere else.</p>
            </div>
            <label className="field">
              <span>API key</span>
              <div className="input-row">
                <input type={showKey ? 'text' : 'password'} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" spellCheck={false} placeholder="40-character key" required title={tips.suKey} />
                <button type="button" className="icon-btn" aria-label={showKey ? 'Hide key' : 'Show key'} title={tips.suShowKey} onClick={() => setShowKey((v) => !v)}>{showKey ? <EyeOff size={16} /> : <Eye size={16} />}</button>
              </div>
            </label>
            {error && <p className="error-text">{error}</p>}
            <div className="actions">
              {onClose && <button type="button" className="btn" onClick={onClose}>Cancel</button>}
              <button className="btn btn-primary" disabled={busy || !key.trim()}>{busy ? 'Checking…' : 'Next'}</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={checkEmail}>
            <h2>Which ProofHub account is yours?</h2>
            <p className="muted">Enter the email you use to sign in to ProofHub.</p>
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); setMatch(null); }} autoComplete="email" placeholder="name@sblcorp.com" required title={tips.suEmail} />
            </label>
            {error && <p className="error-text">{error}</p>}
            {match ? (
              <div className="match">
                <Avatar initials={match.initials} color={match.profile_color} name={match.first_name} />
                <div>
                  <div className="strong">{match.first_name} {match.last_name}</div>
                  <div className="muted small">{match.role_name || match.title || match.email}</div>
                </div>
                <div className="spacer" />
                <button type="button" className="btn" onClick={() => setMatch(null)} title={tips.suNotMe}>Not me</button>
                <button type="button" className="btn btn-primary" onClick={confirm} title={tips.suThatsMe}>That's me</button>
              </div>
            ) : (
              <div className="actions">
                <button type="button" className="btn" onClick={() => { setStep(1); setError(''); }}>Back</button>
                <button className="btn btn-primary" disabled={busy || !email.trim()}>{busy ? 'Looking up…' : 'Find my account'}</button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
