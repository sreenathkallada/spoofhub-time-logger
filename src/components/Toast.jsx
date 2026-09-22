import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { X } from 'lucide-react';

const Ctx = createContext(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);
  const remove = useCallback((id) => setItems((xs) => xs.filter((t) => t.id !== id)), []);
  const push = useCallback((t) => {
    const id = ++seq.current;
    const item = { id, ttl: 5000, ...t };
    setItems((xs) => [...xs, item]);
    if (item.ttl > 0) setTimeout(() => remove(id), item.ttl);
    return () => remove(id);
  }, [remove]);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone || 'info'}`}>
            <span>{t.message}</span>
            {t.action && (
              <button className="btn-link" onClick={() => { t.onAction?.(); remove(t.id); }}>{t.action}</button>
            )}
            <button className="icon-btn" aria-label="Dismiss" onClick={() => remove(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
