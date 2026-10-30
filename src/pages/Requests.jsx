import { useEffect, useState } from 'react';
import { api } from '../api';
import { Err, Field, FormModal, Loading, useLoad, useToast, peso, when } from '../ui';
import { Head, Seg } from '../v2';

const TONE = { new: 'warn', accepted: 'teal', done: 'grey', declined: 'bad' };
const Status = ({ s }) => <span className={'chip chip-' + (TONE[s] || 'grey')}>{s[0].toUpperCase() + s.slice(1)}</span>;

/* accept (with an optional price) or decline, with a short message for the guest */
function AskModal({ r, ask, onClose, onDone }) {
  const [price, setPrice] = useState(r.price > 0 ? String(r.price) : ''); const [reply, setReply] = useState('');
  const accept = ask === 'accept';
  return (
    <FormModal title={(accept ? 'Accept' : 'Decline') + ' · ' + r.service} onClose={onClose} save={accept ? 'Accept request' : 'Decline request'}
      onSave={async () => { const x = await api('PUT', '/requests/' + r.id, { do: ask, reply, ...(accept ? { price: price === '' ? 0 : price } : {}) }); onDone(x.message); }}>
      {accept && <Field label="Extra price (₱), leave empty if it is included"><input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></Field>}
      <Field label="Message to the guest (optional)"><input maxLength={200} value={reply} onChange={(e) => setReply(e.target.value)} /></Field>
    </FormModal>
  );
}

/* the buttons of one request: accept (with an optional price), decline, done, and how the extra price is paid */
export function RequestActions({ r, online, onChange }) {
  const toast = useToast(); const [ask, setAsk] = useState(null); const [busy, setBusy] = useState(false);
  const run = async (fn) => { setBusy(true); try { await fn(); onChange(); } catch (e) { toast(e.message, 'bad'); } setBusy(false); };
  const decide = (d, extra = {}) => run(async () => { const x = await api('PUT', '/requests/' + r.id, { do: d, ...extra }); toast(x.message); });
  const pay = (d) => run(async () => {
    const x = await api('POST', '/requests/' + r.id + '/pay', { do: d });
    if (d === 'link' && x.url) { try { await navigator.clipboard.writeText(x.url); toast('Payment link copied. Send it to the guest.'); } catch { toast('Payment link: ' + x.url); } window.open(x.url, '_blank', 'noopener'); }
    else toast(x.message);
  });
  return (
    <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
      {r.status === 'new' && <><button className="btn small" disabled={busy} onClick={() => setAsk('accept')}>Accept</button><button className="btn small ghost" disabled={busy} onClick={() => setAsk('decline')}>Decline</button></>}
      {r.status === 'accepted' && <button className="btn small" disabled={busy} onClick={() => decide('done')}>Mark done</button>}
      {r.owing && <>
        <button className="btn small amber" disabled={busy} onClick={() => pay('cash')}>Cash received</button>
        {online && <><button className="btn small ghost" disabled={busy} onClick={() => pay('link')}>Payment link</button><button className="btn small ghost" disabled={busy} onClick={() => pay('check')}>Check payment</button></>}
      </>}
      {ask && <AskModal r={r} ask={ask} onClose={() => setAsk(null)} onDone={(m) => { toast(m); onChange(); }} />}
    </div>
  );
}

const money = (r) => (Number(r.price) > 0 ? peso(r.price) + (r.paid_at ? ' · paid' : '') : 'Included / no charge');

/* the requests of ONE booking, with a form to add one (front desk) */
export function BookingRequests({ bookingRef, list, online, onChange }) {
  const toast = useToast(); const [open, setOpen] = useState(false); const [f, setF] = useState({ service: '', note: '', price: '' }); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="row between"><span className="eyebrow">REQUESTS &amp; EXTRAS</span><button className="btn small ghost" onClick={() => setOpen(true)}>+ Add</button></div>
      {list.length === 0 && <p className="hint">No requests yet.</p>}
      {list.map((r) => <div key={r.id} className="req-line"><div className="row between"><b>{r.service}</b><Status s={r.status} /></div>{r.note && <small className="muted">{r.note}</small>}<small>{money(r)} · {r.source === 'staff' ? 'added by staff' : 'from guest'}</small><RequestActions r={r} online={online} onChange={onChange} /></div>)}
      {open && <FormModal title="Add a request or extra charge" onClose={() => setOpen(false)} onSave={async () => { await api('POST', '/bookings/' + bookingRef + '/requests', f); toast('Request added.'); onChange(); }}>
        <Field label="Service"><input value={f.service} onChange={set('service')} required maxLength={120} placeholder="e.g. Balcony set-up" /></Field>
        <Field label="Details (optional)"><input value={f.note} onChange={set('note')} maxLength={500} /></Field>
        <Field label="Price (₱, optional)"><input type="number" min="0" step="0.01" value={f.price} onChange={set('price')} /></Field>
      </FormModal>}
    </>
  );
}

/* the Requests page */
export default function Requests() {
  const [tab, setTab] = useState('open');
  const list = useLoad(() => api('GET', '/requests?status=' + tab), [tab]);
  useEffect(() => { const t = setInterval(list.reload, 20000); return () => clearInterval(t); }, [list.reload]);
  const rows = list.data ? list.data.data : []; const c = list.data ? list.data.counts : {}; const online = !!(list.data && list.data.online);
  return (
    <div className="v2">
      <Head title="Requests" sub="Extra services asked by VIP guests. Accept, set a price if there is one, then mark it done." />
      <div className="toolbar"><Seg value={tab} onChange={setTab} items={[['open', 'Open' + ((c.new || 0) + (c.accepted || 0) ? ' (' + ((c.new || 0) + (c.accepted || 0)) + ')' : '')], ['done', 'Done'], ['declined', 'Declined'], ['all', 'All']]} /></div>
      <Loading state={list} />
      <section className="card panel scroll"><table className="tbl"><thead><tr><th>WHEN</th><th>GUEST</th><th>ROOM</th><th>REQUEST</th><th>PRICE</th><th>STATUS</th><th /></tr></thead><tbody>
        {rows.length === 0 && !list.loading && <tr><td colSpan="7" className="muted">No requests here.</td></tr>}
        {rows.map((r) => <tr key={r.id}><td>{when(r.created_at)}</td><td><a href={'#/bookings/' + r.booking_ref}>{r.guest_name}</a><br /><small className="muted">{r.booking_ref}</small></td><td>{r.room_no || '—'}<br /><small className="muted">{r.type_name}</small></td>
          <td><b>{r.service}</b>{r.note && <><br /><small className="muted">{r.note}</small></>}</td><td>{money(r)}</td><td><Status s={r.status} /></td><td><RequestActions r={r} online={online} onChange={list.reload} /></td></tr>)}
      </tbody></table></section>
    </div>
  );
}
