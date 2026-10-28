import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { Icon } from './icons';
import { label, when } from './ui';

/* small helpers shared by the admin screens that follow the reference layout */
export const useDebounced = (v, ms = 300) => { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; };
export const initials = (n) => String(n || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
export function downloadCsv(name, rows) {
  const esc = (c) => { let s = String(c ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };   // a leading = + - @ is neutralised so Excel never runs it as a formula
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const STATUS = { pending_payment: ['Awaiting payment', 'warn'], confirmed: ['Paid · upcoming', 'teal'], checked_in: ['Checked in', 'navy'], checked_out: ['Completed', 'grey'], cancelled: ['Cancelled', 'grey'], expired: ['Expired', 'grey'] };
export const PAY_STATUS = { paid: ['Paid', 'teal'], refund_pending: ['Refund pending', 'warn'], refunded: ['Refunded', 'grey'], failed: ['Failed', 'bad'], pending: ['Pending', 'warn'] };
export const Chip = ({ s, map = STATUS }) => { const [l, t] = map[s] || [label(s), 'grey']; return <span className={'chip chip-' + t}>{l}</span>; };
export const SearchBox = ({ value, onChange, placeholder }) => (
  <label className="search"><Icon n="availability" size={16} /><input placeholder={placeholder} aria-label={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />{value && <button type="button" className="x" aria-label="Clear" onClick={() => onChange('')}>×</button>}</label>
);
export const Head = ({ title, sub, children }) => <header className="dash-head"><div><h1 className="page-title">{title}</h1>{sub && <p className="sub">{sub}</p>}</div><div className="tools">{children}</div></header>;
export const Seg = ({ value, onChange, items }) => <div className="seg">{items.map(([v, l]) => <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>)}</div>;

/* the bell in the header: newest messages, a count of the ones not seen yet */
const SEEN = 'hg_bell_seen';
const readSeen = () => { try { return Number(localStorage.getItem(SEEN)) || 0; } catch { return 0; } };
export function Bell({ tick }) {
  const [log, setLog] = useState([]); const [svc, setSvc] = useState(null); const [open, setOpen] = useState(false); const [seen, setSeen] = useState(readSeen); const [mark, setMark] = useState(0); const box = useRef(null);
  useEffect(() => { let alive = true; api('GET', '/notifications').then((d) => { if (alive) { setLog(d.data || []); setSvc(d.services || null); } }, () => {}); return () => { alive = false; }; }, [tick]);
  useEffect(() => {
    if (!open) return undefined;
    const down = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const key = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const ts = (n) => Date.parse(String(n.created_at).replace(' ', 'T')) || 0;
  const unread = log.filter((n) => ts(n) > seen).length;
  const toggle = () => {
    if (!open) { setMark(seen); const newest = log.length ? Math.max(...log.map(ts)) : 0; if (newest > seen) { try { localStorage.setItem(SEEN, String(newest)); } catch { /* ignore */ } setSeen(newest); } }
    setOpen(!open);
  };
  return (
    <div className="bell-wrap" ref={box}>
      <button className="icon-btn" aria-label={unread ? 'Notifications, ' + unread + ' new' : 'Notifications'} aria-expanded={open} onClick={toggle}><Icon n="notifications" size={18} />{unread > 0 && <i className="bell-count">{unread > 9 ? '9+' : unread}</i>}</button>
      {open && (
        <div className="card bell-pop" role="dialog" aria-label="Notifications">
          <div className="panel-head"><h2>Notifications</h2><a href="#/notifications" onClick={() => setOpen(false)}>View all</a></div>
          <ul className="bell-list">
            {log.length === 0 && <li className="muted">Nothing sent yet.</li>}
            {log.slice(0, 8).map((n) => (
              <li key={n.id}><div className="li-main"><b>{n.channel === 'sms' ? 'SMS' : 'Email'} · {n.recipient}</b><small>{n.subject || 'Message'} · {when(n.created_at)}</small></div><span className={'chip chip-' + (n.status === 'sent' ? 'teal' : n.status === 'failed' ? 'bad' : 'grey')}>{label(n.status)}</span>{ts(n) > mark && <i className="bell-new" aria-label="New" />}</li>
            ))}
          </ul>
          {svc && (!svc.sms || !svc.email) && <p className="hint">{!svc.sms && !svc.email ? 'SMS and email are' : !svc.sms ? 'SMS is' : 'Email is'} in demo mode: messages are saved here, not sent.</p>}
        </div>
      )}
    </div>
  );
}
