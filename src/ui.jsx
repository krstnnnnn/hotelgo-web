import { api } from './api';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const when = (s) => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T'));
  return isNaN(d) ? s : d.toLocaleString('en-PH', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
};
export const label = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
export const stay = (b) => (b.stay_type === 'overnight' ? 'Overnight' : b.hours + ' hours');

export function Pill({ v, text }) { return <span className={'pill ' + v}>{text || label(v)}</span>; }

/* run an async loader; gives data / error / loading and a reload() */
export function useLoad(fn, deps = []) {
  const [state, set] = useState({ data: null, error: '', loading: true });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    let alive = true;
    set((s) => ({ ...s, loading: true, error: '' }));
    fnRef.current().then((data) => alive && set({ data, error: '', loading: false }), (e) => alive && set({ data: null, error: e.message, loading: false }));
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: useCallback(() => setN((x) => x + 1), []) };
}

/* little pop-up messages */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function Toasts({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, text, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">{list.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.text}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export function Modal({ title, onClose, wide, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <header><h2>{title}</h2><button className="x" onClick={onClose} aria-label="Close">×</button></header>
        {children}
      </div>
    </div>
  );
}

export function Field({ label: text, children }) { return <label className="f"><span>{text}</span>{children}</label>; }

export function Err({ text }) { return text ? <div className="err" role="alert">{text}</div> : null; }

export function Loading({ state }) {
  if (state.loading && !state.data) return <div className="empty">Loading…</div>;
  if (state.error) return <Err text={state.error} />;
  return null;
}

/* "Are you sure?" pop-up. onYes returns a promise; errors are shown inside the pop-up */
export function Confirm({ title, text, yes = 'Delete', danger = true, onYes, onClose }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { await onYes(); onClose(); } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <p>{text}</p><Err text={err} />
      <div className="row"><button className={'btn' + (danger ? ' danger' : '')} disabled={busy} onClick={go}>{busy ? 'Please wait…' : yes}</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

/* a form inside a pop-up: calls onSave(), shows the error, closes when it works */
export function FormModal({ title, onClose, onSave, save = 'Save', wide, children }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await onSave(); onClose(); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit}>
        <Err text={err} />
        {children}
        <div className="row"><button className="btn" disabled={busy}>{busy ? 'Saving…' : save}</button><button type="button" className="btn ghost" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

export function Table({ head, rows, empty = 'Nothing here yet.' }) {
  return (
    <div className="scroll">
      <table>
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows}</tbody>
      </table>
      {React_isEmpty(rows) && <div className="empty">{empty}</div>}
    </div>
  );
}
const React_isEmpty = (rows) => Array.isArray(rows) && rows.length === 0;

export function Top({ title, sub, children }) {
  return <div className="top"><div><h1>{title}</h1>{sub && <p>{sub}</p>}</div><div className="row">{children}</div></div>;
}

/* Shrinks a chosen picture in the browser (max 1600 px, JPEG) so the upload stays small, then returns a data: URL */
export function shrink(file, max = 1600) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { reject(new Error('Choose a JPG, PNG or WebP picture.')); return; }
    const url = URL.createObjectURL(file); const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      let q = 0.85, out = c.toDataURL('image/jpeg', q);
      while (out.length * 0.75 > 700000 && q > 0.4) { q -= 0.1; out = c.toDataURL('image/jpeg', q); }
      if (c.width < 200 || c.height < 150) reject(new Error('The picture is too small (at least 200 x 150 pixels).'));
      else if (out.length * 0.75 > 700000) reject(new Error('The picture is still too large. Choose a smaller one.'));
      else resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file could not be read as a picture.')); };
    img.src = url;
  });
}

/* Shows the current picture and lets the owner replace or remove it. Saves straight away (POST /manage/photos). */
export function PhotoBox({ kind, id, slot, current, src, wide, onChange }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const send = async (data) => {
    setBusy(true); setErr('');
    try { const r = await api('POST', '/manage/photos', { kind, id, slot, data }); onChange && onChange(r.image_id); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { await send(await shrink(f)); } catch (x) { setErr(x.message); }
  };
  return (
    <div className={'photobox' + (wide ? ' wide' : '')}>
      <div className="pb-img">{current ? <img src={src} alt="" /> : <span>No photo yet</span>}</div>
      <div className="pb-act">
        <label className={'btn small' + (busy ? ' off' : '')}>{busy ? 'Working…' : current ? 'Replace photo' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} disabled={busy} hidden /></label>
        {current ? <button type="button" className="btn small danger" disabled={busy} onClick={() => send(null)}>Remove</button> : null}
      </div>
      {err && <div className="err" role="alert">{err}</div>}
    </div>
  );
}
