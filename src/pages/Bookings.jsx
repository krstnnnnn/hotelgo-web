import { useEffect, useState } from 'react';
import { api } from '../api';
import { Confirm, Field, FormModal, Loading, useLoad, useToast, peso, stay, when } from '../ui';
import { Chip, Head, Seg, SearchBox, STATUS, useDebounced } from '../v2';

const toMs = (s) => new Date(String(s).replace(' ', 'T')).getTime();
const hh = (ms) => new Date(ms).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const firstLast = (n = '') => { const p = n.split(' '); return p.length > 1 ? p[0] + ' ' + p[p.length - 1][0] + '.' : n; };

/* Rooms down the side, time along the top: one block per booking */
function Timeline({ rows, now, base, onPick, shift, setShift, multi }) {
  const from = base + shift * 3600000, span = 12 * 3600000;
  const pos = (ms) => Math.max(0, Math.min(100, ((ms - from) / span) * 100));
  const rooms = {};
  rows.filter((b) => b.room_no && !['cancelled', 'expired'].includes(b.status) && toMs(b.end_at) > from && toMs(b.start_at) < from + span).forEach((b) => { const k = (b.hotel_id || 0) + '-' + b.room_no; (rooms[k] ||= { no: b.room_no, hotel: multi ? b.hotel_name : '', items: [] }).items.push(b); });
  const list = Object.values(rooms);
  const nowPct = pos(now);
  return (
    <section className="card timeline">
      <div className="row between" style={{ margin: '10px 0 4px' }}><b>Schedule</b><div className="tl-shift"><button aria-label="Earlier" onClick={() => setShift(shift - 6)}>‹</button><button aria-label="Later" onClick={() => setShift(shift + 6)}>›</button></div></div>
      <div className="tl-row tl-head"><span>ROOM</span><div className="tl-track">{Array.from({ length: 7 }, (_, i) => <i key={i} className="tl-tick" style={{ left: (i / 6) * 100 + '%' }}>{hh(from + i * 2 * 3600000)}</i>)}</div></div>
      {list.length === 0 && <p className="muted" style={{ padding: '12px 4px' }}>No bookings in this window.</p>}
      {list.map((r) => (
        <div className="tl-row" key={r.hotel + r.no}>
          <b className="tl-room">{r.no}{r.hotel && <small className="tl-hotel">{r.hotel}</small>}</b>
          <div className="tl-track">
            {r.items.map((b) => { const l = pos(toMs(b.start_at)), w = Math.max(3, pos(toMs(b.end_at)) - l); return (
              <button key={b.booking_ref} className={'tl-block ' + (b.status === 'pending_payment' ? 'tl-pending' : b.stay_type === 'overnight' ? 'tl-night' : 'tl-hour')} style={{ left: l + '%', width: w + '%' }}
                title={b.booking_ref + ' · ' + b.guest_name + ' · ' + hh(toMs(b.start_at)) + ' - ' + hh(toMs(b.end_at))} onClick={() => onPick(b.booking_ref)}>{stay(b)} · {firstLast(b.guest_name)}</button>); })}
            {nowPct > 0 && nowPct < 100 && <i className="tl-now" style={{ left: nowPct + '%' }} />}
          </div>
        </div>
      ))}
    </section>
  );
}

export default function Bookings({ user, refParam }) {
  const [stayF, setStayF] = useState(''); const [status, setStatus] = useState(''); const [day, setDay] = useState('today'); const [hotel, setHotel] = useState(''); const [q, setQ] = useState('');
  const dq = useDebounced(q).trim(); const [shift, setShift] = useState(0);
  const [walkin, setWalkin] = useState(refParam === 'new');            // #/bookings/new (from the dashboard button) opens the walk-in form
  const list = useLoad(() => api('GET', '/bookings?' + new URLSearchParams({ status, q: dq, stay: stayF, day: dq ? 'all' : day, hotel_id: hotel })), [status, dq, stayF, day, hotel]);
  const hotels = useLoad(() => (user.platform ? api('GET', '/manage/hotels') : Promise.resolve({ data: [] })));
  useEffect(() => { const t = setInterval(list.reload, 30000); return () => clearInterval(t); }, [list.reload]);
  useEffect(() => setShift(0), [day]);
  const rows = list.data ? list.data.data : []; const sel = refParam && refParam !== 'new' ? refParam : (rows[0] && rows[0].booking_ref) || null;
  const now = list.data ? toMs(list.data.now) : Date.now();
  const base = day === 'tomorrow' ? toMs(new Date(Date.now() + 86400000).toISOString().slice(0, 10) + 'T00:00:00') : Math.floor((now - 2 * 3600000) / 3600000) * 3600000;
  const pick = (r) => { location.hash = '#/bookings/' + r; };
  return (
    <div className="v2">
      <Head title="Reservations" sub="Schedule, search, check in and out, take payment.">
        <SearchBox value={q} onChange={setQ} placeholder="Search ref, guest, mobile or room" />
        <button className="btn amber" onClick={() => setWalkin(true)}>+ New booking</button>
      </Head>
      <div className="toolbar">
        <Seg value={stayF} onChange={setStayF} items={[['', 'All'], ['hourly', 'Hourly'], ['overnight', 'Overnight']]} />
        {user.platform && <select className="pill-select" value={hotel} onChange={(e) => setHotel(e.target.value)} aria-label="Hotel"><option value="">All hotels</option>{(hotels.data ? hotels.data.data : []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>}
        <select className="pill-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Status</option>{Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="pill-select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day" disabled={!!dq}><option value="today">Today</option><option value="tomorrow">Tomorrow</option><option value="all">All dates</option></select>
        {dq && <span className="muted small">Searching all dates</span>}
      </div>
      <Loading state={list} />
      {list.data && (
        <>
          {day !== 'all' && !dq && <Timeline rows={rows} now={now} base={base} shift={shift} setShift={setShift} onPick={pick} multi={!!user.platform} />}
          <div className="split">
            <section className="card panel scroll">
              <table className="tbl">
                <thead><tr><th>REF</th><th>GUEST</th>{user.platform && <th>HOTEL</th>}<th>ROOM</th><th>STAY</th><th>STATUS</th></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan="6" className="muted">No bookings match{dq ? ' "' + dq + '"' : ''}.</td></tr>}
                  {rows.map((b) => (
                    <tr key={b.booking_ref} className={'row-click' + (sel === b.booking_ref ? ' on' : '')} onClick={() => pick(b.booking_ref)}>
                      <td><b>{b.booking_ref}</b></td><td>{b.guest_name}</td>{user.platform && <td>{b.hotel_name}</td>}<td>{b.room_no || '—'}</td><td>{stay(b)}</td><td><Chip s={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {sel ? <Detail key={sel} bookingRef={sel} user={user} onChange={list.reload} /> : <aside className="card panel"><p className="muted">Select a booking.</p></aside>}
          </div>
        </>
      )}
      {walkin && <Walkin onClose={() => { setWalkin(false); if (refParam === 'new') location.hash = '#/bookings'; }} onDone={(ref) => { list.reload(); location.hash = '#/bookings/' + ref; }} />}
    </div>
  );
}

function Walkin({ onClose, onDone }) {
  const types = useLoad(() => api('GET', '/room-types'));
  const [f, setF] = useState({ room_type_id: '', stay: 'hourly', hours: 3, guests: 1, name: '', mobile: '', pay: 'cash' });
  const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const r = await api('POST', '/bookings', { ...f, room_type_id: Number(f.room_type_id), hours: Number(f.hours), guests: Number(f.guests) });
    toast(f.pay === 'online' ? 'Room ' + r.data.room_no + ' held. Now send the guest a payment link.' : 'Walk-in booked: room ' + r.data.room_no + '.'); onDone(r.data.booking_ref);
  };
  return (
 <FormModal title="Walk-in booking" onClose={onClose} onSave={save} save="Book room">
      <Loading state={types} />
      <div className="grid2">
        <Field label="Room type"><select value={f.room_type_id} onChange={set('room_type_id')} required><option value="">Choose…</option>{(types.data?.data || []).map((t) => <option key={t.id} value={t.id}>{t.name} (up to {t.max_guests})</option>)}</select></Field>
        <Field label="Stay"><select value={f.stay} onChange={set('stay')}><option value="hourly">Hourly</option><option value="overnight">Overnight</option></select></Field>
        {f.stay === 'hourly' && <Field label="Hours"><select value={f.hours} onChange={set('hours')}><option>3</option><option>6</option><option>12</option></select></Field>}
        <Field label="Guests"><input type="number" min="1" value={f.guests} onChange={set('guests')} required /></Field>
        <Field label="Guest name"><input value={f.name} onChange={set('name')} required minLength={2} /></Field>
        <Field label="Mobile number"><input value={f.mobile} onChange={set('mobile')} placeholder="09171234567" required /></Field>
      </div>
      <div className="paychoice" role="radiogroup" aria-label="How will the guest pay?">
        <label className={f.pay === 'cash' ? 'on' : ''}><input type="radio" name="pay" checked={f.pay === 'cash'} onChange={() => setF({ ...f, pay: 'cash' })} /><b>Cash at the desk</b><small>Confirmed right away</small></label>
        <label className={f.pay === 'online' ? 'on' : ''}><input type="radio" name="pay" checked={f.pay === 'online'} onChange={() => setF({ ...f, pay: 'online' })} /><b>GCash, Maya or card</b><small>Room is held while the guest pays</small></label>
      </div>
    </FormModal>
  );
}

function Detail({ bookingRef, user, onChange }) {
  const d = useLoad(() => api('GET', '/bookings/' + bookingRef), [bookingRef]);
  const toast = useToast();
  const [edit, setEdit] = useState(false); const [del, setDel] = useState(false); const [room, setRoom] = useState('');
  const b = d.data && d.data.data;
  const act = async (doIt, extra = {}) => {
    try {
      const r = await api('POST', '/bookings/' + bookingRef + '/action', { do: doIt, ...extra });
      toast(r.message, r.level === 'warn' ? 'bad' : 'ok'); d.reload(); onChange();
    } catch (e) { toast(e.message, 'bad'); }
  };
  if (!b) return <aside className="card panel"><Loading state={d} /></aside>;
  const free = d.data.free_rooms || []; const editable = ['confirmed', 'pending_payment'].includes(b.status);
  return (
    <aside className="card panel detail">
      <div className="panel-head"><h2>Booking {bookingRef}</h2><Chip s={b.status} /></div>
      <dl className="kv">
        <dt>Guest</dt><dd>{b.guest_name}</dd><dt>Mobile</dt><dd>{b.guest_mobile}</dd><dt>Hotel</dt><dd>{b.hotel_name || '—'} · Room {b.room_no || '—'}</dd>
        <dt>Requested</dt><dd>{b.type_name} · {stay(b)}</dd><dt>Window</dt><dd>{when(b.start_at)} – {when(b.end_at)}</dd><dt>Amount</dt><dd>{peso(b.total)}</dd><dt>Booked</dt><dd>{b.source === 'walkin' ? 'Walk-in' : 'Online'}</dd>{b.gcal_event_id ? <><dt>Calendar</dt><dd>In Google Calendar</dd></> : null}
      </dl>
      <span className="eyebrow">AUTOMATED ROOM ASSIGNMENT</span>
      <div className="assign"><span>Room {b.room_no || '—'} · free for the full window</span><em>ASSIGNED</em></div>
      <p className="hint">Rule: first free room of the requested type in this hotel, with a cleaning buffer.</p>
      {editable && free.length > 0 && (
        <div className="row"><select style={{ flex: 1 }} value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Other free room"><option value="">Move to another room…</option>{free.map((r) => <option key={r.id} value={r.id}>Room {r.room_no}</option>)}</select>
          <button className="btn small ghost" disabled={!room} onClick={() => act('reassign', { room_id: Number(room) })}>Assign</button></div>
      )}
      {b.status === 'pending_payment' && <PayBox b={b} onDone={() => { d.reload(); onChange(); }} />}
      <div className="btn-pair">
        <button className="btn" disabled={b.status !== 'confirmed'} onClick={() => act('checkin')}>Check in</button>
        {b.status === 'checked_in' ? <button className="btn navy" onClick={() => act('checkout')}>Check out</button>
          : <button className="btn ghost" disabled={!editable} onClick={() => window.confirm('Cancel booking ' + bookingRef + '? Paid money is refunded.') && act('cancel')}>Cancel</button>}
      </div>
      <button className="btn amber btn-block" disabled={!['confirmed', 'checked_in'].includes(b.status)} onClick={() => act('resend')}>Resend SMS / email</button>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn small ghost" onClick={() => setEdit(true)}>Edit guest details</button>
        {user.role === 'admin' && <button className="btn small danger" onClick={() => setDel(true)}>Delete</button>}
      </div>
      {d.data.payments.length > 0 && <><span className="eyebrow">PAYMENTS</span><table className="tbl"><tbody>{d.data.payments.map((p) => <tr key={p.id}><td className="mono">{p.txn_ref}</td><td>{p.method}</td><td>{peso(p.amount)}</td><td><span className={'chip chip-' + (p.status === 'paid' ? 'teal' : 'grey')}>{p.status.replace('_', ' ')}</span></td></tr>)}</tbody></table></>}
      {d.data.notifications.length > 0 && <><span className="eyebrow">MESSAGES SENT</span><table className="tbl"><tbody>{d.data.notifications.map((n) => <tr key={n.id}><td>{n.channel}</td><td>{n.recipient}</td><td>{n.status}</td></tr>)}</tbody></table></>}
      {edit && <EditGuest b={b} onClose={() => setEdit(false)} onSaved={() => { d.reload(); onChange(); }} />}
      {del && <Confirm title="Delete booking" text="Only cancelled or expired bookings without a payment can be deleted. This cannot be undone." onClose={() => setDel(false)}
        onYes={async () => { await api('DELETE', '/bookings/' + bookingRef); toast('Booking deleted.'); onChange(); location.hash = '#/bookings'; }} />}
    </aside>
  );
}

function EditGuest({ b, onClose, onSaved }) {
  const [f, setF] = useState({ guest_name: b.guest_name, guest_mobile: b.guest_mobile, guest_email: b.guest_email, guests: b.guests });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal title="Edit guest details" onClose={onClose} onSave={async () => { await api('PUT', '/bookings/' + b.booking_ref, { ...f, guests: Number(f.guests) }); onSaved(); }}>
      <div className="grid2">
        <Field label="Name"><input value={f.guest_name} onChange={set('guest_name')} required /></Field>
        <Field label="Mobile"><input value={f.guest_mobile} onChange={set('guest_mobile')} required /></Field>
        <Field label="Email"><input type="email" value={f.guest_email} onChange={set('guest_email')} /></Field>
        <Field label="Guests"><input type="number" min="1" value={f.guests} onChange={set('guests')} required /></Field>
      </div>
    </FormModal>
  );
}

/* Payment panel for a booking that is still waiting for payment. The guest pays on PayMongo's page (wallet or link);
   we ask PayMongo for the result, here automatically every 10 seconds and with the "Check payment" button. */
const WALLETS = [['gcash', 'GCash'], ['paymaya', 'Maya'], ['grab_pay', 'GrabPay'], ['shopeepay', 'ShopeePay']];
function PayBox({ b, onDone }) {
  const toast = useToast();
  const [url, setUrl] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const call = async (body) => {
    setBusy(true);
    try { return await api('POST', '/bookings/' + b.booking_ref + '/pay', body); }
    catch (e) { toast(e.message, 'bad'); return null; }
    finally { setBusy(false); }
  };
  const check = async (quiet) => {
    const r = await call({ do: 'check' });
    if (!r) return;
    if (r.state === 'paid') { toast('Payment received. Booking confirmed.'); onDone(); } else if (!quiet) setMsg(r.message);
  };
  useEffect(() => { if (!b.pay_ref) return undefined; const t = setInterval(() => check(true), 10000); return () => clearInterval(t); }, [b.pay_ref]);   // eslint-disable-line
  const start = async (body) => { const r = await call(body); if (r && r.url) { setUrl(r.url); window.open(r.url, '_blank', 'noopener'); onDone(); } };
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Link copied.'); } catch { toast('Select the link and copy it.', 'bad'); } };
  return (
    <div className="paybox">
      <div className="row between"><h3>Waiting for payment · {peso(b.total)}</h3><small className="muted">Held until {when(b.hold_expires_at)}</small></div>
      <p className="muted small">Choose how the guest pays. The system asks PayMongo and confirms the booking by itself.</p>
      <div className="row">
        {WALLETS.map(([k, n]) => <button key={k} className="btn small amber" disabled={busy} onClick={() => start({ do: 'wallet', wallet: k })}>{n}</button>)}
        <button className="btn small ghost" disabled={busy} onClick={() => start({ do: 'link' })}>Card / bank link</button>
      </div>
      {url && <div className="payurl"><input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Payment address" /><button className="btn small" onClick={copy}>Copy</button></div>}
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn small" disabled={busy} onClick={() => check(false)}>Check payment</button>
        <button className="btn small ghost" disabled={busy} onClick={async () => { if (window.confirm('Mark this booking as paid in cash at the desk?')) { const r = await call({ do: 'cash' }); if (r) { toast(r.message); onDone(); } } }}>Paid cash at desk</button>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </div>
  );
}
