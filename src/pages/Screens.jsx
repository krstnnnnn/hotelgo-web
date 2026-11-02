import { useEffect, useState } from 'react';
import { api } from '../api';
import { photoUrl } from '../site/config';
import { Confirm, Err, Field, FormModal, Loading, PhotoBox, useLoad, useToast, label, peso, stay, when } from '../ui';
import { Chip, Head, PAY_STATUS, Seg, SearchBox, downloadCsv, initials, useDebounced } from '../v2';

/* ===================================================== Guest records ===================================================== */
export function Guests({ user }) {
  const [q, setQ] = useState(''); const dq = useDebounced(q); const [page, setPage] = useState(1); const [sel, setSel] = useState(null);
  const list = useLoad(() => api('GET', '/guests?' + new URLSearchParams({ q: dq })), [dq]);
  useEffect(() => setPage(1), [dq]);
  const all = list.data ? list.data.data : []; const per = 10; const pages = Math.max(1, Math.ceil(all.length / per)); const rows = all.slice((page - 1) * per, page * per);
  const cur = sel && all.some((g) => g.id === sel) ? sel : rows[0] && rows[0].id;
  return (
    <div className="v2">
      <Head title="Guest records" sub="Personal data: every time a guest is opened it is written to the audit log.">
        <SearchBox value={q} onChange={setQ} placeholder="Search name or exact email" />
        <button className="btn ghost" disabled={!all.length} onClick={() => downloadCsv('hotelgo-guests.csv', [['Name', 'Email', 'Mobile', 'Stays', 'Last visit'], ...all.map((g) => [g.full_name, g.email, g.mobile, g.stays, g.last_visit || ''])])}>Export</button>
      </Head>
      <Loading state={list} />
      {list.data && (
        <div className="split">
          <section className="card panel scroll">
            <table className="tbl">
              <thead><tr><th>GUEST</th><th>MOBILE</th><th>STAYS</th><th>LAST VISIT</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan="4" className="muted">No guests found.</td></tr>}
                {rows.map((g) => <tr key={g.id} className={'row-click' + (cur === g.id ? ' on' : '')} onClick={() => setSel(g.id)}><td><span className="who2"><span className="avatar">{initials(g.full_name)}</span><b>{g.full_name}</b></span></td><td>{g.mobile}</td><td>{g.stays}</td><td>{when(g.last_visit) || '—'}</td></tr>)}
              </tbody>
            </table>
            <div className="pager"><small>{all.length ? 'Showing ' + ((page - 1) * per + 1) + '–' + Math.min(all.length, page * per) + ' of ' + all.length : 'No results'}</small>
              <span><button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Prev</button>{Array.from({ length: Math.min(pages, 5) }, (_, i) => i + 1).map((n) => <button key={n} className={n === page ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>)}<button disabled={page >= pages} onClick={() => setPage(page + 1)}>Next ›</button></span></div>
          </section>
          {cur ? <GuestCard key={cur} id={cur} user={user} onChange={list.reload} /> : <aside className="card panel"><p className="muted">Select a guest.</p></aside>}
        </div>
      )}
    </div>
  );
}

function GuestCard({ id, user, onChange }) {
  const d = useLoad(() => api('GET', '/guests/' + id), [id]); const toast = useToast(); const [edit, setEdit] = useState(false); const [del, setDel] = useState(false);
  const g = d.data && d.data.data;
  if (!g) return <aside className="card panel"><Loading state={d} /></aside>;
  return (
    <aside className="card guest-card">
      <div className="guest-top"><span className="avatar lg">{initials(g.full_name)}</span><div><h2>{g.full_name}</h2><small>Guest since {when(g.created_at)} · {d.data.bookings.length} bookings</small></div></div>
      <div className="guest-body form">
        <div className="two"><label>MOBILE<input readOnly value={g.mobile} /></label><label>EMAIL<input readOnly value={g.email} /></label></div>
        <span className="eyebrow">STAY HISTORY</span>
        <div className="history">
          {d.data.bookings.length === 0 && <div className="muted">No stays yet.</div>}
          {d.data.bookings.map((b) => <div key={b.booking_ref}><b><a href={'#/bookings/' + b.booking_ref}>{b.booking_ref}</a> · {when(b.start_at)}</b><span>Rm {b.room_no || '—'} · {stay(b)} · {peso(b.total)}</span></div>)}
        </div>
        <label>STAFF NOTES<textarea rows="3" readOnly value={g.staff_note || ''} placeholder="No notes yet." /></label>
        <div className="btn-pair"><a className="btn" href="#/bookings/new">New booking</a><button className="btn ghost" onClick={() => setEdit(true)}>Edit record</button></div>
        {user.role === 'admin' && <button className="btn danger btn-block" onClick={() => setDel(true)}>Delete guest</button>}
      </div>
      {edit && <EditGuest g={g} onClose={() => setEdit(false)} onSaved={() => { d.reload(); onChange(); }} />}
      {del && <Confirm title="Delete guest" text="A guest who has bookings cannot be deleted (their history must stay). This cannot be undone." onClose={() => setDel(false)} onYes={async () => { await api('DELETE', '/guests/' + id); toast('Guest deleted.'); onChange(); }} />}
    </aside>
  );
}
function EditGuest({ g, onClose, onSaved }) {
  const [f, setF] = useState({ full_name: g.full_name, email: g.email, mobile: g.mobile, staff_note: g.staff_note || '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal title="Edit guest" onClose={onClose} onSave={async () => { await api('PUT', '/guests/' + g.id, f); onSaved(); }}>
      <div className="grid2"><Field label="Name"><input value={f.full_name} onChange={set('full_name')} required /></Field><Field label="Email"><input type="email" value={f.email} onChange={set('email')} required /></Field><Field label="Mobile"><input value={f.mobile} onChange={set('mobile')} required /></Field></div>
      <Field label="Staff note (max 500 characters)"><textarea rows="3" maxLength={500} value={f.staff_note} onChange={set('staff_note')} /></Field>
    </FormModal>
  );
}

/* ===================================================== Rooms & rates ===================================================== */
const blankType = { hotel_id: '', name: '', description: '', amenities: '', max_guests: 2, price_3h: '', price_6h: '', price_12h: '', price_overnight: '', cleaning_buffer_min: 15, is_active: 1, is_vip: 0, included_services: '' };
export function RoomsRates({ user, tab: first }) {
  const [tab, setTab] = useState(first || 'rooms'); const [typeId, setTypeId] = useState(null); const [addRoom, setAddRoom] = useState(false); const [newType, setNewType] = useState(false); const [delRoom, setDelRoom] = useState(null);
  const rooms = useLoad(() => api('GET', '/rooms')); const types = useLoad(() => api('GET', '/types'));
  const hotels = useLoad(() => (user.platform ? api('GET', '/manage/hotels') : Promise.resolve({ data: [] })));
  const toast = useToast(); const admin = user.role === 'admin';
  useEffect(() => setTab(first || 'rooms'), [first]);
  const R = rooms.data ? rooms.data.data : []; const T = types.data ? types.data.data : [];
  const type = T.find((t) => t.id === typeId) || T[0];
  const count = (id) => R.filter((r) => r.room_type_id === id).length;
  const toggle = async (r) => {
    try { await api('PUT', '/rooms/' + r.id, { room_no: r.room_no, room_type_id: r.room_type_id, floor: r.floor, status: r.status === 'active' ? 'maintenance' : 'active' }); rooms.reload(); } catch (e) { toast(e.message, 'bad'); }
  };
  return (
    <div className="v2">
      <Head title="Rooms & rates" sub={R.length + ' rooms across ' + T.length + ' room types'}>
        {admin && <><button className="btn ghost" onClick={() => setNewType(true)}>+ Room type</button><button className="btn amber" onClick={() => setAddRoom(true)}>+ Add room</button></>}
      </Head>
      <div className="toolbar"><Seg value={tab} onChange={setTab} items={[['rooms', 'Rooms'], ['types', 'Room types'], ['rates', 'Rate plans']]} /></div>
      <Loading state={rooms} /><Loading state={types} />
      <div className="split">
        <section className="card panel scroll">
          {tab === 'rooms' && <table className="tbl"><thead><tr><th>ROOM</th>{user.platform && <th>HOTEL</th>}<th>TYPE</th><th>FLOOR</th><th>STATUS</th><th>BOOKABLE</th>{admin && <th />}</tr></thead><tbody>
            {R.map((r) => <tr key={r.id} className={'row-click' + (type && r.room_type_id === type.id ? ' on' : '')} onClick={() => setTypeId(r.room_type_id)}><td><b>{r.room_no}</b></td>{user.platform && <td>{r.hotel_name}</td>}<td>{r.type_name}</td><td>{r.floor}</td>
              <td><span className={'chip chip-' + (r.status === 'active' ? 'teal' : 'warn')}>{r.status === 'active' ? 'Active' : 'Under maintenance'}</span></td>
              <td onClick={(e) => e.stopPropagation()}>{admin ? <button className={'toggle' + (r.status === 'active' ? ' on' : '')} role="switch" aria-checked={r.status === 'active'} aria-label={'Room ' + r.room_no + ' bookable'} onClick={() => toggle(r)}><i /></button> : '—'}</td>{admin && <td onClick={(e) => e.stopPropagation()}><div className="row"><button className="btn small ghost" onClick={() => setAddRoom(r)}>Edit</button><button className="btn small danger" onClick={() => setDelRoom(r)}>Delete</button></div></td>}</tr>)}</tbody></table>}
          {tab === 'types' && <table className="tbl"><thead><tr><th></th>{user.platform && <th>HOTEL</th>}<th>TYPE</th><th>MAX GUESTS</th><th>BUFFER</th><th>ROOMS</th><th>VISIBLE</th></tr></thead><tbody>
            {T.map((t) => <tr key={t.id} className={'row-click' + (type && t.id === type.id ? ' on' : '')} onClick={() => setTypeId(t.id)}><td>{t.image_id ? <img className="thumb" src={photoUrl(t.image_id)} alt="" /> : null}</td>{user.platform && <td>{t.hotel_name}</td>}<td><b>{t.name}</b>{!!Number(t.is_vip) && <span className="chip chip-warn" style={{ marginLeft: 6 }}>VIP</span>}</td><td>{t.max_guests}</td><td>{t.cleaning_buffer_min} min</td><td>{count(t.id)}</td><td><span className={'chip chip-' + (Number(t.is_active) ? 'teal' : 'grey')}>{Number(t.is_active) ? 'Yes' : 'Hidden'}</span></td></tr>)}</tbody></table>}
          {tab === 'rates' && <table className="tbl"><thead><tr><th>TYPE</th><th>3 HRS</th><th>6 HRS</th><th>12 HRS</th><th>OVERNIGHT</th></tr></thead><tbody>
            {T.map((t) => <tr key={t.id} className={'row-click' + (type && t.id === type.id ? ' on' : '')} onClick={() => setTypeId(t.id)}><td><b>{t.name}</b>{user.platform && <small className="muted"> {t.hotel_name}</small>}</td><td>{peso(t.price_3h)}</td><td>{peso(t.price_6h)}</td><td>{peso(t.price_12h)}</td><td>{peso(t.price_overnight)}</td></tr>)}</tbody></table>}
        </section>
        {type ? <TypePanel key={type.id} t={type} admin={admin} onSaved={types.reload} onDeleted={() => { setTypeId(null); types.reload(); rooms.reload(); }} /> : <aside className="card panel"><p className="muted">Select a room type.</p></aside>}
      </div>
      {addRoom && <RoomForm r={addRoom === true ? null : addRoom} types={T} onClose={() => setAddRoom(false)} onSaved={rooms.reload} />}
      {delRoom && <Confirm title={'Delete room ' + delRoom.room_no} text="A room that has bookings cannot be deleted. Switch it off (maintenance) instead." onClose={() => setDelRoom(null)} onYes={async () => { await api('DELETE', '/rooms/' + delRoom.id); toast('Room deleted.'); rooms.reload(); }} />}
      {newType && <NewType hotels={user.platform ? (hotels.data ? hotels.data.data : []) : null} onClose={() => setNewType(false)} onSaved={types.reload} />}
    </div>
  );
}
function TypePanel({ t, admin, onSaved, onDeleted }) {
  const [f, setF] = useState(t); const [img, setImg] = useState(t.image_id || null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [del, setDel] = useState(false); const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => { setBusy(true); setErr(''); try { await api('PUT', '/types/' + t.id, { ...f, is_active: Number(f.is_active) ? 1 : 0 }); toast('Room type saved.'); onSaved(); } catch (e) { setErr(e.message); } setBusy(false); };
  return (
    <aside className="card panel form">
      <div className="panel-head"><h2>Edit room type · {t.name}</h2></div>
      <Err text={err} />
      <label>NAME<input value={f.name} onChange={set('name')} disabled={!admin} /></label>
      <label>DESCRIPTION<textarea rows="2" maxLength={500} value={f.description || ''} onChange={set('description')} disabled={!admin} /></label>
      <label>AMENITIES (COMMA SEPARATED)<input value={f.amenities || ''} onChange={set('amenities')} disabled={!admin} /></label>
      <div className="two"><label>MAX GUESTS<input type="number" min="1" max="20" value={f.max_guests} onChange={set('max_guests')} disabled={!admin} /></label><label>CLEANING BUFFER (MIN)<input type="number" min="0" max="180" value={f.cleaning_buffer_min} onChange={set('cleaning_buffer_min')} disabled={!admin} /></label></div>
      <div className="two"><label>3 HOURS (₱)<input type="number" min="0" step="0.01" value={f.price_3h} onChange={set('price_3h')} disabled={!admin} /></label><label>6 HOURS (₱)<input type="number" min="0" step="0.01" value={f.price_6h} onChange={set('price_6h')} disabled={!admin} /></label>
        <label>12 HOURS (₱)<input type="number" min="0" step="0.01" value={f.price_12h} onChange={set('price_12h')} disabled={!admin} /></label><label>OVERNIGHT (₱)<input type="number" min="0" step="0.01" value={f.price_overnight} onChange={set('price_overnight')} disabled={!admin} /></label></div>
      <label className="chk" style={{ textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" checked={!!Number(f.is_vip)} onChange={(e) => setF({ ...f, is_vip: e.target.checked ? 1 : 0 })} disabled={!admin} /> VIP / luxury room (guests can send requests)</label>
      {!!Number(f.is_vip) && <label>INCLUDED SERVICES (ONE PER LINE, “TITLE: DETAILS”)<textarea rows="4" maxLength={1000} placeholder={'Welcome drinks: 2 cocktails\nBreakfast in bed: for 2'} value={f.included_services || ''} onChange={set('included_services')} disabled={!admin} /></label>}
      <label className="chk" style={{ textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" checked={!!Number(f.is_active)} onChange={(e) => setF({ ...f, is_active: e.target.checked ? 1 : 0 })} disabled={!admin} /> Visible to guests</label>
      <span className="eyebrow">PHOTO</span>
      {admin ? <PhotoBox kind="room_type" id={t.id} current={img} src={photoUrl(img)} onChange={(v) => { setImg(v); onSaved(); }} /> : <p className="hint">Only the owner can change the photo.</p>}
      {admin && <div className="btn-pair"><button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button><button className="btn ghost" onClick={() => setF(t)} disabled={busy}>Cancel</button></div>}
      {admin && <button className="btn danger btn-block" onClick={() => setDel(true)}>Delete room type</button>}
      {del && <Confirm title={'Delete ' + t.name} text="A type that still has rooms or bookings cannot be deleted. Untick “Visible to guests” to hide it instead." onClose={() => setDel(false)} onYes={async () => { await api('DELETE', '/types/' + t.id); toast('Room type deleted.'); onDeleted(); }} />}
    </aside>
  );
}
function NewType({ hotels, onClose, onSaved }) {
  const [f, setF] = useState({ ...blankType, hotel_id: hotels && hotels[0] ? hotels[0].id : '' }); const toast = useToast(); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal title="New room type" onClose={onClose} onSave={async () => { await api('POST', '/types', { ...f, hotel_id: Number(f.hotel_id) || undefined }); toast('Room type saved. Open it to add a photo.'); onSaved(); }}>
      {hotels && <Field label="Hotel"><select value={f.hotel_id} onChange={set('hotel_id')} required><option value="">Choose…</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
      <Field label="Name"><input value={f.name} onChange={set('name')} required minLength={2} maxLength={80} /></Field>
      <div className="grid2"><Field label="Max guests"><input type="number" min="1" max="20" value={f.max_guests} onChange={set('max_guests')} required /></Field><Field label="Cleaning buffer (min)"><input type="number" min="0" max="180" value={f.cleaning_buffer_min} onChange={set('cleaning_buffer_min')} required /></Field>
        <Field label="3 hours (₱)"><input type="number" min="0" step="0.01" value={f.price_3h} onChange={set('price_3h')} required /></Field><Field label="6 hours (₱)"><input type="number" min="0" step="0.01" value={f.price_6h} onChange={set('price_6h')} required /></Field>
        <Field label="12 hours (₱)"><input type="number" min="0" step="0.01" value={f.price_12h} onChange={set('price_12h')} required /></Field><Field label="Overnight (₱)"><input type="number" min="0" step="0.01" value={f.price_overnight} onChange={set('price_overnight')} required /></Field></div>
      <label className="chk"><input type="checkbox" checked={!!Number(f.is_vip)} onChange={(e) => setF({ ...f, is_vip: e.target.checked ? 1 : 0 })} /> VIP / luxury room</label>
      {!!Number(f.is_vip) && <Field label="Included services (one per line, “Title: details”)"><textarea rows="4" maxLength={1000} value={f.included_services} onChange={set('included_services')} /></Field>}
    </FormModal>
  );
}
function RoomForm({ r, types, onClose, onSaved }) {
  const [f, setF] = useState(r || { room_no: '', room_type_id: types[0] ? types[0].id : '', floor: 1, status: 'active' }); const toast = useToast(); const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <FormModal title={r ? 'Edit room' : 'New room'} onClose={onClose} onSave={async () => { const body = { room_no: f.room_no, room_type_id: Number(f.room_type_id), floor: Number(f.floor), status: f.status }; if (r) await api('PUT', '/rooms/' + r.id, body); else await api('POST', '/rooms', body); toast('Room saved.'); onSaved(); }}>
      <div className="grid2"><Field label="Room number"><input value={f.room_no} onChange={set('room_no')} required maxLength={10} /></Field>
        <Field label="Room type"><select value={f.room_type_id} onChange={set('room_type_id')} required><option value="">Choose…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.hotel_name && types.some((x) => x.hotel_id !== t.hotel_id) ? t.hotel_name + ' · ' : ''}{t.name}</option>)}</select></Field>
        <Field label="Floor"><input type="number" min="1" max="50" value={f.floor} onChange={set('floor')} required /></Field>
        <Field label="Status"><select value={f.status} onChange={set('status')}><option value="active">Active</option><option value="maintenance">Maintenance</option></select></Field></div>
    </FormModal>
  );
}

/* ======================================================== Payments ======================================================== */
function printReceipt(p) {
  const w = window.open('', '_blank', 'width=420,height=560'); if (!w) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  w.document.write('<title>Receipt ' + esc(p.txn_ref) + '</title><body style="font-family:system-ui;padding:24px;color:#0B2233"><h2>HOTELGO receipt</h2><p>Transaction <b>' + esc(p.txn_ref) + '</b><br>Booking <b>' + esc(p.booking_ref) + '</b><br>Guest ' + esc(p.guest_name) + '<br>Method ' + esc(p.method) + '<br>Date ' + esc(when(p.paid_at || p.created_at)) + '</p><h1>' + esc(peso(p.amount)) + '</h1><p>Status: ' + esc(label(p.status)) + '</p></body>');
  w.document.close(); w.focus(); w.print();
}
export function Payments({ user }) {
  const [status, setStatus] = useState(''); const [method, setMethod] = useState(''); const [day, setDay] = useState('today'); const [q, setQ] = useState(''); const dq = useDebounced(q).trim().toLowerCase(); const [sel, setSel] = useState(null); const [ref, setRef] = useState(null); const toast = useToast();
  const list = useLoad(() => api('GET', '/payments')); const x = list.data;
  const today = new Date().toISOString().slice(0, 10);
  const rows = x ? x.data.filter((p) => (!status || p.status === status) && (!method || p.method === method) && (day === 'all' || String(p.paid_at || p.created_at).slice(0, 10) === today) && (!dq || (p.txn_ref + p.booking_ref + p.guest_name).toLowerCase().includes(dq))) : [];
  const p = rows.find((r) => r.id === sel) || rows[0];
  const failed = x ? x.data.filter((r) => r.status === 'failed').length : 0;
  return (
    <div className="v2">
      <Head title="Payments" sub="Online payment gateway (PayMongo) and desk cash. Records are kept for the books: refunded, never deleted.">
        <SearchBox value={q} onChange={setQ} placeholder="Search ref or transaction ID" />
        <button className="btn ghost" disabled={!x} onClick={() => downloadCsv('hotelgo-payments.csv', [['Txn', 'Booking', 'Guest', 'Method', 'Amount', 'Status', 'Paid'], ...rows.map((r) => [r.txn_ref, r.booking_ref, r.guest_name, r.method, r.amount, r.status, r.paid_at || ''])])}>Export CSV</button>
      </Head>
      <Loading state={list} />
      {x && <>
        <section className="stats2">
          <div className="card stat"><span className="sl or">COLLECTED TODAY</span><strong>{peso(x.paid_today)}</strong><small>Paid bookings</small></div>
          <div className="card stat"><span className="sl">WAITING</span><strong>{x.waiting}</strong><small>Awaiting payment</small></div>
          <div className="card stat"><span className="sl">FAILED</span><strong>{failed}</strong><small>Retry or contact guest</small></div>
          <div className="card stat"><span className="sl">REFUNDED</span><strong>{peso(x.refunded)}</strong><small>Returned via gateway</small></div>
        </section>
        <div className="toolbar">
          <select className="pill-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Status</option>{Object.entries(PAY_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="pill-select" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method"><option value="">Method</option><option value="ewallet">E-wallet</option><option value="card">Card</option><option value="bank">Bank / OTC</option><option value="cash">Cash</option></select>
          <select className="pill-select" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day"><option value="today">Today</option><option value="all">All dates</option></select>
        </div>
        <div className="split">
          <section className="card panel scroll"><table className="tbl"><thead><tr><th>TXN ID</th><th>BOOKING</th>{user.platform && <th>HOTEL</th>}<th>METHOD</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>
            {rows.length === 0 && <tr><td colSpan="6" className="muted">No payments match.</td></tr>}
            {rows.map((r) => <tr key={r.id} className={'row-click' + (p && p.id === r.id ? ' on' : '')} onClick={() => setSel(r.id)}><td className="mono">{r.txn_ref}</td><td><b>{r.booking_ref}</b></td>{user.platform && <td>{r.hotel_name}</td>}<td>{r.method}</td><td><b>{peso(r.amount)}</b></td><td><Chip s={r.status} map={PAY_STATUS} /></td></tr>)}</tbody></table></section>
          {p ? (
            <aside className="card panel detail">
              <div className="panel-head"><h2>Transaction {p.txn_ref}</h2><Chip s={p.status} map={PAY_STATUS} /></div>
              <dl className="kv"><dt>Booking</dt><dd>{p.booking_ref}</dd><dt>Guest</dt><dd>{p.guest_name}</dd><dt>Method</dt><dd>{p.method}</dd><dt>{p.status === 'paid' ? 'Paid at' : 'Created'}</dt><dd>{when(p.paid_at || p.created_at)}</dd></dl>
              <div className="row between" style={{ margin: '8px 0 14px' }}><span>Total</span><strong style={{ fontSize: 26, fontFamily: 'Sora' }}>{peso(p.amount)}</strong></div>
              <button className="btn navy btn-block" onClick={() => printReceipt(p)}>Print receipt</button>
              {user.role === 'admin' && ['paid', 'refund_pending'].includes(p.status) && <button className="btn ghost btn-block" onClick={() => setRef(p)}>Issue refund…</button>}
              <p className="hint">Refunds go back through the payment gateway and the booking is cancelled.</p>
            </aside>
          ) : <aside className="card panel"><p className="muted">Select a transaction.</p></aside>}
        </div>
      </>}
      {ref && <Confirm title="Refund payment" yes="Refund" text={'Refund ' + peso(ref.amount) + ' for booking ' + ref.booking_ref + '? The booking will be cancelled.'} onClose={() => setRef(null)} onYes={async () => { const r = await api('POST', '/payments/' + ref.id + '/refund'); toast(r.message); list.reload(); }} />}
    </div>
  );
}

/* ====================================================== Notifications ====================================================== */
const RULES = [
  { id: 'confirmed', event: 'Booking confirmed', sms: true, email: true, timing: 'Instant', tpl: 'HOTELGO: Booking {ref} confirmed. Room {room}, {date}. Show this ref at check-in.' },
  { id: 'cancelled', event: 'Booking cancelled', sms: true, email: true, timing: 'Instant', tpl: 'HOTELGO: Booking {ref} was cancelled. Any payment is being refunded, {guest}.' },
  { id: 'changed', event: 'Booking changed', sms: true, email: true, timing: 'Instant', tpl: 'HOTELGO: Booking {ref} now starts {date}, room {room}.' },
  { id: 'code', event: 'Sign-up / reset code', sms: false, email: true, timing: 'Instant', tpl: 'Your HOTELGO code is 123456. It expires in 10 minutes.' },
];
const SAMPLE = { guest: 'Maria Santos', ref: 'HG-7K3Q9X', room: '203', date: 'Sat 17 Oct 7:00 PM - 10:00 PM' };
const fill = (t) => t.replace(/\{(\w+)\}/g, (m, k) => SAMPLE[k] || m);
export function Notifications() {
  const list = useLoad(() => api('GET', '/notifications')); const [tab, setTab] = useState('rules'); const [selId, setSelId] = useState('confirmed'); const [del, setDel] = useState(null); const [view, setView] = useState(null); const toast = useToast();
  const log = list.data ? list.data.data : []; const svc = list.data ? list.data.services : null; const rule = RULES.find((r) => r.id === selId);
  const Svc = ({ on, name }) => <span className={'chip chip-' + (on ? 'teal' : 'warn')}>{name} · {on ? 'Connected' : 'Off'}</span>;
  const table = (rows) => (
    <table className="tbl"><thead><tr><th>WHEN</th><th>CHANNEL</th><th>TO</th><th>STATUS</th><th /></tr></thead><tbody>
      {rows.length === 0 && <tr><td colSpan="5" className="muted">Nothing sent yet.</td></tr>}
      {rows.map((n) => <tr key={n.id}><td>{when(n.created_at)}</td><td><b>{n.channel === 'sms' ? 'SMS' : 'Email'}</b></td><td>{n.recipient}</td><td><span className={'chip chip-' + (n.status === 'sent' ? 'teal' : n.status === 'failed' ? 'bad' : 'grey')}>{n.status === 'failed' ? 'Failed' : label(n.status)}</span></td>
        <td><div className="row"><button className="btn small ghost" onClick={() => setView(n)}>Read</button>{n.status === 'failed' && <button className="btn small" onClick={async () => { try { const r = await api('POST', '/notifications/' + n.id + '/retry'); toast(r.message); list.reload(); } catch (e) { toast(e.message, 'bad'); } }}>Retry</button>}<button className="btn small danger" onClick={() => setDel(n)}>Delete</button></div></td></tr>)}</tbody></table>
  );
  return (
    <div className="v2">
      <Head title="Notifications" sub="SMS and email sent automatically on booking events">{svc && <><Svc on={svc.sms} name="SMS service" /><Svc on={svc.email} name="Email service" /></>}</Head>
      <div className="toolbar"><Seg value={tab} onChange={setTab} items={[['rules', 'Automatic messages'], ['log', 'Delivery log']]} /></div>
      <Loading state={list} />
      <div className="split">
        <div>
          {tab === 'rules' ? <>
            <section className="card panel"><table className="tbl"><thead><tr><th>EVENT</th><th>SMS</th><th>EMAIL</th><th>TIMING</th></tr></thead><tbody>
              {RULES.map((r) => <tr key={r.id} className={'row-click' + (r.id === selId ? ' on' : '')} onClick={() => setSelId(r.id)}><td><b>{r.event}</b></td><td>{r.sms ? '✓' : '—'}</td><td>{r.email ? '✓' : '—'}</td><td>{r.timing}</td></tr>)}</tbody></table>
              <p className="hint">These are the messages the system sends by itself. SMS and email are only really delivered when the services are connected (Settings).</p></section>
            <h2 style={{ margin: '20px 0 10px', fontSize: 17 }}>Recent delivery log</h2><section className="card panel scroll">{table(log.slice(0, 3))}</section>
          </> : <section className="card panel scroll">{table(log)}</section>}
        </div>
        <div>
          <aside className="card panel form"><div className="panel-head"><h2>Message · {rule.event}</h2></div><p className="hint" style={{ marginTop: 0 }}>Sample text with example values.</p><div className="bubble" style={{ background: '#f3f7f9' }}>{fill(rule.tpl)}</div></aside>
          <aside className="card panel preview"><span className="eyebrow">GUEST PREVIEW</span><div className="bubble">{fill(rule.tpl)}</div></aside>
        </div>
      </div>
      {view && <FormModal title={view.subject || 'Message'} onClose={() => setView(null)} onSave={async () => {}} save="Close"><p className="muted">{view.channel} to {view.recipient}</p><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{view.message.length > 3000 ? view.message.slice(0, 3000) + '…' : view.message}</pre></FormModal>}
      {del && <Confirm title="Delete notification" text="Remove this message from the log?" onClose={() => setDel(null)} onYes={async () => { await api('DELETE', '/notifications/' + del.id); toast('Deleted.'); list.reload(); }} />}
    </div>
  );
}

/* ========================================================= Reports ========================================================= */
const LEVELS = ['#e8eef2', '#bfe0e4', '#8bc7cd', '#2b9aa4', '#0e7c86', '#0a2239'];
const DAYS = [['Sun', 0], ['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6]];
const Meter = ({ label: l, value, pct, navy }) => <div className="rmeter"><div><span>{l}</span><b>{value}</b></div><i><u className={navy ? 'navy' : ''} style={{ width: Math.max(2, pct) + '%' }} /></i></div>;
export function Reports({ user }) {
  const iso = (d) => d.toISOString().slice(0, 10);
  const [range, setRange] = useState('week'); const [tab, setTab] = useState('Overview');
  const span = { week: [6, 0], last_week: [13, 7], month: [29, 0] }[range]; const run = { from: iso(new Date(Date.now() - span[0] * 86400000)), to: iso(new Date(Date.now() - span[1] * 86400000)) };
  const d = useLoad(() => api('GET', '/reports?' + new URLSearchParams(run)), [range]); const x = d.data;
  const series = x ? Object.entries(x.byDay).map(([date, v]) => ({ date, day: date.slice(5), hourly: v.hourly, overnight: v.overnight })) : [];
  const max = Math.max(1, ...series.map((s) => s.hourly + s.overnight)); const total = x ? x.total : 0; const hp = total && x ? Math.round((x.byStay.hourly / total) * 100) : 0;
  const maxType = x ? Math.max(1, ...Object.values(x.byType)) : 1; const up = x && x.prev_total > 0 ? Math.round(((total - x.prev_total) / x.prev_total) * 100) : null;
  const show = (...n) => tab === 'Overview' || n.includes(tab);
  const heat = x ? x.heat || {} : {}; const hmax = Math.max(1, ...Object.values(heat));
  return (
    <div className="v2">
      <Head title="Reports" sub={x ? run.from + ' to ' + run.to : ''}>
        <select className="pill-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Period"><option value="week">This week</option><option value="last_week">Last week</option><option value="month">Last 30 days</option></select>
        <button className="btn ghost" onClick={() => window.print()}>Export PDF</button>
        <button className="btn" disabled={!x} onClick={() => downloadCsv('hotelgo-report-' + range + '.csv', [['Date', 'Hourly', 'Overnight', 'Total'], ...series.map((s) => [s.date, s.hourly, s.overnight, s.hourly + s.overnight])])}>Export CSV</button>
      </Head>
      <div className="toolbar"><Seg value={tab} onChange={setTab} items={['Overview', 'Revenue', 'Occupancy', 'Hourly vs overnight'].map((t) => [t, t])} /></div>
      <Loading state={d} />
      {x && <>
        <section className="stats2">
          <div className="card stat"><span className="sl">TOTAL REVENUE</span><strong>{peso(total)}</strong><small>{up === null ? 'No earlier period to compare' : (up >= 0 ? '↑ ' : '↓ ') + Math.abs(up) + '% vs previous period'}</small></div>
          <div className="card stat"><span className="sl">PAID BOOKINGS</span><strong>{x.count}</strong><small>{peso(x.byStay.hourly)} hourly · {peso(x.byStay.overnight)} overnight</small></div>
          <div className="card stat"><span className="sl">AVG. STAY (HOURLY)</span><strong>{x.avgHours} hrs</strong><small>Hourly bookings only</small></div>
        </section>
        {show('Revenue', 'Hourly vs overnight') && (
          <div className="report-grid">
            {show('Revenue') && <section className="card panel"><div className="panel-head"><h2>Revenue by day</h2><div className="legendc"><span><i style={{ background: 'var(--amber)' }} />Hourly</span><span><i style={{ background: 'var(--ink)' }} />Overnight</span></div></div>
              <div className="bars2">{series.map((s) => <div key={s.date} className="bar-col" title={s.day + ': ' + peso(s.hourly + s.overnight)}><div className="bar">{s.overnight > 0 && <span className="seg-o" style={{ height: (s.overnight / max) * 100 + '%' }} />}{s.hourly > 0 && <span className="seg-h" style={{ height: (s.hourly / max) * 100 + '%' }} />}</div>{series.length <= 14 ? s.day : ''}</div>)}</div></section>}
            <section className="card panel"><div className="panel-head"><h2>Hourly vs overnight</h2></div>
              <Meter label="Hourly" value={hp + '%'} pct={hp} /><Meter label="Overnight" value={(total ? 100 - hp : 0) + '%'} pct={total ? 100 - hp : 0} navy />
              <h3 className="mini">By room type</h3>{Object.entries(x.byType).map(([k, v]) => <Meter key={k} label={k} value={peso(v)} pct={(v / maxType) * 100} />)}
              {user.platform && <><h3 className="mini">By hotel</h3>{Object.entries(x.byHotel || {}).map(([k, v]) => <Meter key={k} label={k} value={peso(v)} pct={(v / Math.max(1, ...Object.values(x.byHotel))) * 100} navy />)}</>}</section>
          </div>
        )}
        {show('Occupancy') && (
          <section className="card panel" style={{ marginTop: 20 }}><div className="panel-head"><h2>Peak hours</h2><span className="muted">Check-ins by weekday and hour · darker means busier</span></div>
            <div className="heat">{DAYS.map(([l, w]) => <div key={l} className="heat-row"><span className="heat-label">{l}</span>{Array.from({ length: 12 }, (_, i) => i + 12).map((h) => { const c = heat[w + '-' + h] || 0; return <i key={h} title={l + ' ' + (h % 12 || 12) + (h < 12 ? ' AM' : ' PM') + ': ' + c + ' check-ins'} style={{ background: LEVELS[c ? Math.min(5, 1 + Math.floor((c / hmax) * 4.99)) : 0] }} />; })}</div>)}
              <div className="heat-axis"><span>12 PM</span><span>6 PM</span><span>11 PM</span></div></div></section>
        )}
      </>}
    </div>
  );
}

/* ========================================================= Settings ========================================================= */
const SERVICES = [
  ['Online payment gateway', 'Accepts e-wallet (GCash, Maya, GrabPay, ShopeePay), card and bank payments through PayMongo; handles refunds.', 'PAYMENT_PROVIDER, PAYMONGO_PUBLIC_KEY, PAYMONGO_SECRET_KEY'],
  ['SMS notification service', 'Booking confirmations and OTP codes. Optional and paid.', 'SMS_PROVIDER, SMS_API_KEY'],
  ['Google Maps', 'Maps, hotel pins and directions (a free map is used without a key).', 'GOOGLE_MAPS_KEY'],
  ['Email notification service', 'Receipts, confirmations and sign-up codes.', 'EMAIL_PROVIDER, APPS_SCRIPT_URL'],
  ['Google Calendar', 'Every paid booking is added to the hotel\u2019s Google Calendar, updated when it changes and removed when it is cancelled. Guests also download a calendar file.', 'GOOGLE_SERVICE_ACCOUNT_JSON, GOOGLE_CALENDAR_ID'],
];
const RULE_FIELDS = [['booking_fee', 'Booking fee (₱)'], ['hold_minutes', 'Room hold (minutes)'], ['cancel_hours', 'Free cancellation until (hours before)'], ['overnight_start', 'Overnight starts (HH:MM)'], ['overnight_end', 'Overnight ends (HH:MM)']];
export function Settings() {
  const [tab, setTab] = useState('Integrations'); const d = useLoad(() => api('GET', '/settings')); const toast = useToast();
  const [f, setF] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const v = f || (d.data && d.data.data);
  const save = async (e) => { e.preventDefault(); setBusy(true); setErr(''); try { const r = await api('PUT', '/settings', v); setF(r.data); toast('Settings saved.'); } catch (x) { setErr(x.message); } setBusy(false); };
  const ints = d.data ? d.data.integrations.map(([name, connected, note]) => ({ name, connected, note })) : [];     // the API sends [name, connected, note]
  return (
    <div className="v2">
      <Head title="Settings" sub="Platform-wide rules and connections" />
      <div className="settings">
        <nav className="card settings-nav">{['Integrations', 'Booking rules', 'Hotels & photos', 'Staff & roles', 'Audit log'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</nav>
        <div>
          <Loading state={d} />
          {tab === 'Integrations' && <>
            <h2 style={{ fontSize: 18 }}>Integrations</h2><p className="muted">The five outside services HOTELGO uses. Keys are set in the server environment (Render → Environment), never typed on this page.</p>
            <div className="svc-list">{SERVICES.map(([name, desc, keys], i) => { const s = ints[i]; return (
              <section key={name} className="card svc"><span className="svc-no">{i + 1}</span><div><h3>{name} {s && <span className={'chip chip-' + (s.connected ? 'teal' : 'warn')}>{s.connected ? 'Connected' : 'Not connected'}</span>}</h3><p>{desc}</p>{s && <p style={{ marginTop: 6 }}>{s.note}</p>}<p className="mono" style={{ marginTop: 6 }}>{keys}</p></div></section>); })}</div>
          </>}
          {tab === 'Booking rules' && v && <form className="card panel form" onSubmit={save}><div className="panel-head"><h2>Booking rules</h2></div><Err text={err} /><div className="two">{RULE_FIELDS.map(([k, t]) => <label key={k}>{t}<input value={v[k] ?? ''} onChange={(e) => setF({ ...v, [k]: e.target.value })} required /></label>)}</div><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></form>}
          {tab === 'Hotels & photos' && <div className="card panel"><p>Each hotel's name, address, map pin and photo are on the <a href="#/hotels">Hotels</a> page. The landing page pictures are on <a href="#/photos">Home photos</a>.</p></div>}
          {tab === 'Staff & roles' && <div className="card panel"><p>Front-desk and owner accounts are managed on the <a href="#/staff">Staff</a> page.</p></div>}
          {tab === 'Audit log' && <div className="card panel"><p>Every sign-in, payment and guest view is on the <a href="#/audit">Audit log</a>.</p></div>}
        </div>
      </div>
    </div>
  );
}
