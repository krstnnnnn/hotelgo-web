import { useEffect, useState } from 'react';
import { api } from '../api';
import { Confirm, Field, FormModal, Loading, useLoad, useToast, peso, stay, when } from '../ui';
import { BookingRequests } from './Requests';
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
              <button key={b.booking_ref} className={'tl-block ' + (b.status === 'pending_payment' ? 'tl-pending' : b.stay_type === 'hourly' ? 'tl-hour' : 'tl-night')} style={{ left: l + '%', width: w + '%' }}
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
  const list = useLoad(() => api('GET', '/bookings?' + new URLSearchParams({ status, q: dq, stay: stayF, day: dq ? 'all' : day, hotel_id: hotel })), [status, dq, stayF, day, hotel], 'bookings');
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
        <Seg value={stayF} onChange={setStayF} items={[['', 'All'], ['hourly', 'Hourly'], ['overnight', 'Overnight'], ['daily', 'Per day']]} />
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

/* New booking at the front desk: hotel, room type, arrival, stay, guest, how it is paid, and a live total */
const PAY_MODES = [['now', 'Pay now'], ['later', 'Pay later'], ['online', 'Pay online']];
const PAY_METHODS = [['cash', 'Cash'], ['ewallet', 'E-wallet'], ['card', 'Card'], ['bank', 'Bank / OTC']];
const two = (n) => String(n).padStart(2, '0');
const localInput = (d) => d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate()) + 'T' + two(d.getHours()) + ':' + two(d.getMinutes());
const dayTime = (d) => d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const clock = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const clock12 = (t) => { const [h, m] = String(t).split(':').map(Number); return clock(new Date(2000, 0, 1, h, m)); };

function Walkin({ onClose, onDone }) {
  const types = useLoad(() => api('GET', '/room-types'), [], 'room-types');
  const toast = useToast();
  const all = types.data?.data || [];
  const night = types.data?.overnight || { start: '20:00', end: '12:00' };
  const day = types.data?.daily || { checkin: '14:00', checkout: '12:00', max_days: 30 };
  const hotels = all.filter((t, i) => all.findIndex((x) => x.hotel_id === t.hotel_id) === i).map((t) => ({ id: String(t.hotel_id), name: t.hotel_name }));
  const [f, setF] = useState({ hotel_id: '', room_type_id: '', stay: 'hourly', hours: 3, days: 2, arrival: localInput(new Date()), name: '', mobile: '', pay_mode: 'now', method: 'cash', coupon: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const hotelId = f.hotel_id || (hotels[0] && hotels[0].id) || '';
  const list = all.filter((t) => String(t.hotel_id) === hotelId);
  const type = list.find((t) => String(t.id) === String(f.room_type_id)) || list[0];
  const days = Math.min(Math.max(parseInt(f.days, 10) || 1, 1), day.max_days);
  const stays = type ? [
    { stay: 'hourly', hours: 3, label: '3 hrs', sub: 'Hourly', price: type.price_3h },
    { stay: 'hourly', hours: 6, label: '6 hrs', sub: 'Hourly', price: type.price_6h },
    { stay: 'hourly', hours: 12, label: '12 hrs', sub: 'Hourly', price: type.price_12h },
    { stay: 'overnight', hours: 0, label: 'Overnight', sub: clock12(night.start).replace(':00', '') + ' – ' + clock12(night.end).replace(':00', ''), price: type.price_overnight },
    ...(Number(type.price_daily) > 0 ? [{ stay: 'daily', hours: 0, label: 'Per day', sub: 'fixed price per day', price: Number(type.price_daily) * days, perDay: Number(type.price_daily) }] : []),
  ] : [];
  const pick = stays.find((s) => s.stay === f.stay && (s.stay !== 'hourly' || s.hours === Number(f.hours))) || stays[0];
  // when the guest arrives and leaves (overnight always starts at the hotel's overnight time)
  const arr = new Date(f.arrival);
  const valid = !isNaN(arr.getTime());
  let from = null; let to = null;
  if (pick && valid) {
    if (pick.stay === 'overnight') {
      const [sh, sm] = night.start.split(':').map(Number); const [eh, em] = night.end.split(':').map(Number);
      from = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate(), sh, sm); to = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate() + 1, eh, em);
    } else if (pick.stay === 'daily') {
      const [sh, sm] = day.checkin.split(':').map(Number); const [eh, em] = day.checkout.split(':').map(Number);
      from = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate(), sh, sm); to = new Date(arr.getFullYear(), arr.getMonth(), arr.getDate() + days, eh, em);
    } else { from = arr; to = new Date(arr.getTime() + pick.hours * 3600000); }
  }
  const outBy = to && from ? (to.toDateString() === from.toDateString() ? clock(to) : dayTime(to)) : '';
  const save = async () => {
    if (!type || !pick || !valid) throw new Error('Choose a hotel, a room type and an arrival time.');
    const [date, time] = f.arrival.split('T');
    const r = await api('POST', '/bookings', { room_type_id: Number(type.id), stay: pick.stay, hours: pick.stay === 'daily' ? undefined : pick.hours || 3, days: pick.stay === 'daily' ? days : undefined, guests: 1, date, time, name: f.name, mobile: f.mobile, pay_mode: f.pay_mode, method: f.method, coupon: f.coupon.trim() });
    toast(f.pay_mode === 'online' ? 'Room ' + r.data.room_no + ' held. Now send the guest a payment link.' : f.pay_mode === 'later' ? 'Room ' + r.data.room_no + ' reserved. Collect the payment at the desk.' : 'Booking created: room ' + r.data.room_no + '.');
    onDone(r.data.booking_ref);
  };
  return (
    <FormModal title="New booking" onClose={onClose} onSave={save} save="Create booking">
      <Loading state={types} />
      <div className="grid2">
        <Field label="Hotel"><select value={hotelId} onChange={(e) => setF({ ...f, hotel_id: e.target.value, room_type_id: '' })} disabled={hotels.length < 2}>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field label="Room type"><select value={type ? String(type.id) : ''} onChange={set('room_type_id')} required>{list.map((t) => <option key={t.id} value={t.id}>{t.name} · up to {t.max_guests}</option>)}</select></Field>
      </div>
      <Field label="Arrival date & time"><input type="datetime-local" value={f.arrival} onChange={set('arrival')} required /></Field>
      <div className="lbl">Stay</div>
      <div className="staycards" role="radiogroup" aria-label="Stay">
        {stays.map((s) => { const on = pick && s.stay === pick.stay && s.hours === pick.hours; return (
          <button type="button" key={s.label} role="radio" aria-checked={!!on} className={on ? 'on' : ''} onClick={() => setF({ ...f, stay: s.stay, hours: s.hours || 3 })}>
            <b>{s.label}</b><span className="pr">₱{Number(s.perDay || s.price).toLocaleString('en-PH')}{s.perDay ? '/day' : ''}</span><small>{s.sub}</small>
          </button>); })}
      </div>
      {pick && pick.stay === 'daily' && <Field label={'Number of days (1–' + day.max_days + ')'}><input type="number" min="1" max={day.max_days} step="1" value={f.days} onChange={set('days')} required /></Field>}
      <div className="grid2">
        <Field label="Guest name"><input value={f.name} onChange={set('name')} placeholder="e.g. Juan Dela Cruz" required minLength={2} /></Field>
        <Field label="Mobile (optional)"><input value={f.mobile} onChange={set('mobile')} placeholder="0917 123 4567" inputMode="tel" /></Field>
      </div>
      <Field label="Promo code (optional)"><input value={f.coupon} onChange={(e) => setF({ ...f, coupon: e.target.value.toUpperCase() })} maxLength={20} placeholder="e.g. SUMMER20" /></Field>
      <div className="lbl">Payment</div>
      <Seg value={f.pay_mode} onChange={(v) => setF({ ...f, pay_mode: v })} items={PAY_MODES} />
      {f.pay_mode === 'now' && <div style={{ marginTop: 8 }}><Seg value={f.method} onChange={(v) => setF({ ...f, method: v })} items={PAY_METHODS} /></div>}
      {f.pay_mode === 'later' && <p className="hint">The room is reserved. Take the payment at the desk when the guest arrives (open the booking and press “Paid cash at desk”). If nobody pays within 30 minutes after arrival, the room is released.</p>}
      {f.pay_mode === 'online' && <p className="hint">The room is held while the guest pays by GCash, Maya or card. You will get a payment link to send.</p>}
      <div className="totalcard"><div><b>Total</b><small>{from ? 'Arrives ' + dayTime(from) + ' · out by ' + outBy : 'Choose an arrival time'}</small></div><strong>{pick ? '₱' + Number(pick.price).toLocaleString('en-PH') : '—'}</strong></div>
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
        <dt>Guest</dt><dd>{b.guest_name}</dd><dt>Mobile</dt><dd>{b.guest_mobile || "—"}</dd><dt>Hotel</dt><dd>{b.hotel_name || '—'} · Room {b.room_no || '—'}</dd>
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
      <button className="btn amber btn-block" disabled={!['confirmed', 'checked_in'].includes(b.status)} onClick={() => act('resend')}>Resend email</button>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn small ghost" onClick={() => setEdit(true)}>Edit guest details</button>
        {user.role === 'admin' && <button className="btn small danger" onClick={() => setDel(true)}>Delete</button>}
      </div>
      {['confirmed', 'checked_in'].includes(b.status) && <BookingRequests bookingRef={bookingRef} list={d.data.requests || []} online={!!d.data.online} onChange={() => { d.reload(); onChange(); }} />}
      {d.data.payments.length > 0 && <><span className="eyebrow">PAYMENTS</span><table className="tbl"><tbody>{d.data.payments.map((p) => <tr key={p.id}><td className="mono">{p.txn_ref}</td><td>{p.method}</td><td>{peso(p.amount)}</td><td><span className={'chip chip-' + (p.status === 'paid' ? 'teal' : 'grey')}>{p.status.replace('_', ' ')}</span></td></tr>)}</tbody></table></>}
      {d.data.notifications.length > 0 && <><span className="eyebrow">MESSAGES SENT</span><table className="tbl"><tbody>{d.data.notifications.map((n) => <tr key={n.id}><td>{n.channel}</td><td>{n.recipient}</td><td>{n.status}</td></tr>)}</tbody></table></>}
      {edit && <EditGuest b={b} onClose={() => setEdit(false)} onSaved={() => { d.reload(); onChange(); }} />}
      {del && <Confirm title="Delete booking" text="Only cancelled or expired bookings without a payment can be deleted. This cannot be undone." onClose={() => setDel(false)}
        onYes={async () => { await api('DELETE', '/bookings/' + bookingRef); toast('Booking deleted.'); onChange(); location.hash = '#/bookings'; }} />}
    </aside>
  );
}

function EditGuest({ b, onClose, onSaved }) {
  const [f, setF] = useState({ guest_name: b.guest_name, guest_mobile: b.guest_mobile || '', guest_email: b.guest_email || '', guests: b.guests });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal title="Edit guest details" onClose={onClose} onSave={async () => { await api('PUT', '/bookings/' + b.booking_ref, { ...f, guests: Number(f.guests) }); onSaved(); }}>
      <div className="grid2">
        <Field label="Name"><input value={f.guest_name} onChange={set('guest_name')} required /></Field>
        <Field label="Mobile (optional)"><input value={f.guest_mobile} onChange={set('guest_mobile')} placeholder="0917 123 4567" inputMode="tel" /></Field>
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
