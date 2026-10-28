import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { api } from '../api';
import { Loading, Pill, Top, label, peso, stay, useLoad } from '../ui';

const clock = (s) => new Date(String(s).replace(' ', 'T')).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const compact = (n) => (n >= 1000 ? +(n / 1000).toFixed(1) + 'k' : String(Math.round(n)));
const HOTEL_KEY = 'hg_dash_hotel';
const saved = () => { try { return Number(localStorage.getItem(HOTEL_KEY)) || 0; } catch { return 0; } };

function Donut({ pct }) {
  const r = 24, c = 2 * Math.PI * r;
  return (
    <svg className="donut" viewBox="0 0 60 60" aria-label={pct + ' percent occupied'}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="#dbe7ec" strokeWidth="7" />
      <circle cx="30" cy="30" r={r} fill="none" stroke="#0E7C86" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} transform="rotate(-90 30 30)" />
      <text x="30" y="34" textAnchor="middle" className="donut-text">{pct}%</text>
    </svg>
  );
}

function niceTop(max) {
  if (max <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(max / 4)));
  return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s * 4 >= max) * 4;
}

function RevenueChart({ week }) {
  const W = 640, H = 240, L = 50, R = 16, T = 16, B = 32, pw = W - L - R, ph = H - T - B;
  const rows = week.map((d) => ({ ...d, total: d.hourly + d.overnight }));
  const live = rows.map((d, i) => ({ ...d, i })).filter((d) => !d.is_future);
  const top = niceTop(Math.max(0, ...live.map((d) => d.total)));
  const x = (i) => L + (i * pw) / Math.max(1, rows.length - 1), y = (v) => T + ph - (v / top) * ph;
  const pts = (k) => live.map((d) => `${x(d.i)},${y(d[k])}`).join(' ');
  return (
    <>
      <svg className="linechart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue this week">
        {[0, 1, 2, 3, 4].map((k) => { const t = (top / 4) * k; return <g key={k}><line className="lc-grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} /><text className="lc-y" x={L - 8} y={y(t) + 4} textAnchor="end">{t === 0 ? '0' : '₱' + compact(t)}</text></g>; })}
        {rows.map((d, i) => <text key={d.date} className={'lc-x' + (d.is_today ? ' today' : '')} x={x(i)} y={H - 10} textAnchor="middle">{d.day}</text>)}
        {live.length > 1 && <polygon className="lc-area" points={`${x(live[0].i)},${y(0)} ${pts('total')} ${x(live[live.length - 1].i)},${y(0)}`} />}
        {live.length > 1 && <polyline className="lc-line lc-hourly" points={pts('hourly')} />}
        {live.length > 1 && <polyline className="lc-line lc-overnight" points={pts('overnight')} />}
        {live.length > 1 && <polyline className="lc-line lc-total" points={pts('total')} />}
        {live.map((d) => <g key={d.date}><circle className={'lc-dot' + (d.is_today ? ' today' : '')} cx={x(d.i)} cy={y(d.total)} r={d.is_today ? 5.5 : 4} /><circle className="lc-hit" cx={x(d.i)} cy={y(d.total)} r="14"><title>{`${d.day}: ${peso(d.total)} (Hourly ${peso(d.hourly)} · Overnight ${peso(d.overnight)})`}</title></circle></g>)}
      </svg>
      <div className="lc-key"><span><i style={{ background: '#0E7C86' }} />Total</span><span><i style={{ background: '#F5A524' }} />Hourly</span><span><i style={{ background: '#0B2233' }} />Overnight</span></div>
    </>
  );
}

function Tile({ r, hotel }) {
  return (
    <div className={'tile ' + r.state} title={r.note}>
      <b>{r.room_no}</b><span>{hotel && r.hotel_name ? r.hotel_name + ' · ' : ''}{r.type_name}</span><em>{label(r.state)}</em>{r.state !== "available" && <small>{r.note}</small>}
    </div>
  );
}

function HotelInfo({ name, rooms, stats }) {
  const bookable = rooms.filter((r) => r.state !== 'maintenance').length;
  const occ = rooms.filter((r) => r.state === 'occupied').length;
  const pct = bookable ? Math.round((occ / bookable) * 100) : 0;
  return (
    <div className="hotel-info">
      <div className="hi-top"><span className="hi-area">{name}</span><b>{occ} of {bookable} occupied · {pct}%</b></div>
      <div className="hi-bar"><i style={{ width: pct + '%' }} /></div>
      <div className="hi-stats"><div><small>Revenue today</small><b>{peso(stats ? stats.revenue_today : 0)}</b></div><div><small>Rooms</small><b>{rooms.length}</b></div></div>
    </div>
  );
}

export default function Dashboard({ user, onBadges }) {
  const d = useLoad(() => api('GET', '/dashboard'));
  const [hid, setHid] = useState(saved);
  useEffect(() => { const t = setInterval(d.reload, 30000); return () => clearInterval(t); }, [d.reload]);
  useEffect(() => { if (d.data && onBadges) onBadges(d.data.badges || {}); }, [d.data]);      // eslint-disable-line
  const x = d.data && { ...d.data, board: d.data.board || [], upcoming: d.data.upcoming || [], notes: d.data.notes || [], count: d.data.count || {}, week: d.data.week || [], hotels: d.data.hotels || [], hotel_stats: d.data.hotel_stats || [] };
  const pick = (id) => { setHid(id); try { localStorage.setItem(HOTEL_KEY, String(id)); } catch { /* ignore */ } };
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const activeId = x && x.hotels.some((h) => h.id === hid) ? hid : 0;
  const board = x ? (activeId ? x.board.filter((r) => Number(r.hotel_id) === activeId) : x.board) : [];
  const count = (s) => board.filter((r) => r.state === s).length;
  const total = board.length || 1;
  const pct = x ? Math.round(((count('occupied') + count('reserved')) / total) * 100) : 0;
  const stat = (id) => (x ? x.hotel_stats.find((h) => h.hotel_id === id) : null);
  const revenue = x ? (activeId ? (stat(activeId) || { revenue_today: 0 }).revenue_today : x.revenue_today) : 0;
  const upcoming = x ? (activeId ? x.upcoming.filter((b) => Number(b.hotel_id) === activeId) : x.upcoming) : [];
  const groups = x && !activeId && x.hotels.length > 0 ? x.hotels.map((h) => ({ h, rooms: x.board.filter((r) => Number(r.hotel_id) === h.id) })).filter((g) => g.rooms.length) : null;
  return (
    <>
      <Top title="Dashboard" sub={(user && user.hotel_name ? user.hotel_name + ' · ' : user && user.platform ? (activeId ? x.hotels.find((h) => h.id === activeId).name : 'All hotels') + ' · ' : '') + today}>
        <button className="btn ghost" onClick={d.reload}><Icon n="refresh" size={15} /> Refresh</button>
        <a className="btn" href="#/bookings/new">+ Walk-in booking</a>
      </Top>
      <Loading state={d} />
      {x && (
        <>
          {x.hotels.length > 0 && (
            <div className="hotel-scroll"><nav className="seg" aria-label="Hotels">
              <button className={activeId === 0 ? 'on' : ''} onClick={() => pick(0)}>All hotels</button>
              {x.hotels.map((h) => <button key={h.id} className={activeId === h.id ? 'on' : ''} title={h.name} onClick={() => pick(h.id)}>{h.name}</button>)}
            </nav></div>
          )}
          <div className="stats">
            <div className="card stat3"><div><div className="l">Occupancy</div><div className="v">{count('occupied')} / {board.length}</div><div className="s">rooms in use</div></div><Donut pct={pct} /></div>
            <div className="card stat3"><div><div className="l">Available now</div><div className="v">{count('available')}</div><div className="s">of {board.length} rooms</div></div><span className="si t2"><Icon n="ready" size={22} /></span></div>
            <div className="card stat3"><div><div className="l">Check-ins next 2 hrs</div><div className="v">{activeId ? upcoming.length : x.checkins_soon}</div><div className="s">{(activeId ? upcoming.length : x.checkins_soon) ? 'Get the keys ready' : 'Nothing soon'}</div></div><span className="si t3"><Icon n="clock" size={22} /></span></div>
            <div className="card stat3 dark"><div><div className="l">Today's revenue</div><div className="v">{peso(revenue)}</div><div className="s">Paid bookings</div></div><span className="si t4"><Icon n="peso" size={22} /></span></div>
          </div>
          <div className="dash">
            <div className="card">
              <div className="row between" style={{ marginBottom: 14 }}><h2>Room availability</h2>
                <div className="legend"><i className="available" />Available<i className="reserved" />Reserved<i className="occupied" />Occupied<i className="cleaning" />Other</div></div>
              {groups ? groups.map((g) => (
                <div key={g.h.id} className="hgroup"><h3>{g.h.name}</h3>
                  <div className="tiles">{g.rooms.map((r) => <Tile key={r.id} r={r} />)}<HotelInfo name={g.h.area || g.h.name} rooms={g.rooms} stats={stat(g.h.id)} /></div></div>
              )) : <div className="tiles">{board.map((r) => <Tile key={r.id} r={r} hotel={!!(user && user.platform)} />)}{!groups && board.length > 0 && <HotelInfo name={user.hotel_name || 'Your hotel'} rooms={board} stats={{ revenue_today: revenue }} />}</div>}
              {board.length === 0 && <p className="muted">No rooms yet. Add rooms under Rooms.</p>}
            </div>
            <div className="stack">
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Upcoming check-ins</h2>
                {upcoming.length === 0 && <p className="muted">No check-ins soon.</p>}
                {upcoming.map((b) => (
                  <a key={b.booking_ref} className="li" href={'#/bookings/' + b.booking_ref}>
                    <div><b>{clock(b.start_at)}</b> · {b.guest_name}<small>{b.type_name} · {stay(b)}</small></div>
                    <span className="pill ok">Rm {b.room_no || '—'}</span>
                  </a>
                ))}
              </div>
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Latest notifications</h2>
                {x.notes.length === 0 && <p className="muted">Nothing sent yet.</p>}
                {x.notes.map((n, i) => <div key={i} className="li small"><span><Pill v={n.status} text={n.channel.toUpperCase() + ' · ' + n.status} /> {n.to}</span></div>)}
              </div>
            </div>
          </div>
          <div className="card" style={{ marginTop: 18 }}><h2 style={{ marginBottom: 10 }}>Revenue this week</h2><RevenueChart week={x.week} /></div>
        </>
      )}
    </>
  );
}
