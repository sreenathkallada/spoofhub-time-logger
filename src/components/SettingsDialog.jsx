import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useSettings } from '../store/settings.js';
import { useDrafts } from '../store/drafts.js';
import { useQueryClient } from '@tanstack/react-query';
import Avatar from './Avatar.jsx';
import { tips } from '../utils/tips.js';

export default function SettingsDialog({ onClose, onChangeAccount }) {
  const s = useSettings();
  const qc = useQueryClient();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function signOut() {
    if (!confirm('Sign out? Unsaved entries in this browser will be discarded.')) return;
    useDrafts.getState().discardAll();
    qc.clear();
    try { localStorage.removeItem('phtl.drafts'); } catch {}
    s.signOut();
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="st-title">
        <div className="modal-head">
          <h2 id="st-title">Settings</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="match">
          <Avatar initials={s.userInitials} color={s.userColor} name={s.userName} />
          <div>
            <div className="strong">{s.userName}</div>
            <div className="muted small">{s.userEmail}{s.identityVerified ? <span title={tips.stVerified}> · verified</span> : ''}</div>
          </div>
          <div className="spacer" />
          <button className="btn" onClick={onChangeAccount} title={tips.stChange}>Change key or email</button>
        </div>

        <div className="grid2">
          <label className="field" title={tips.stStatus}><span>Default status for new entries</span>
            <select value={s.defaultStatus} onChange={(e) => s.set({ defaultStatus: e.target.value })}>
              <option value="billable">Billable</option>
              <option value="non-billable">Non-billable</option>
              <option value="none">None</option>
            </select>
          </label>
          <label className="field" title={tips.stHistory}><span>Show my entries from the last</span>
            <select value={s.daysOfHistory} onChange={(e) => { s.set({ daysOfHistory: Number(e.target.value) }); }}>
              {[14, 30, 60, 90, 180].map((d) => <option key={d} value={d}>{d} days</option>)}
            </select>
          </label>
        </div>

        <p className="muted small">Your API key is stored only in this browser and sent only to projects.sblcorp.com. ProofHub allows about 25 requests every 10 seconds per account; this app keeps under that and waits automatically when told to.</p>

        <div className="actions">
          <button className="btn btn-danger-outline" onClick={signOut} title={tips.stSignOut}>Sign out</button>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
