import { Icon } from '../icons';
import { api } from '../api';
import { Loading, Pill, Top, label, peso, stay, useLoad } from '../ui';

const clock = (s) => new Date(String(s).replace(' ', 'T')).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

export default function Dashboard() {
  const d = useLoad(() => api('GET', '/dashboard'));
  const x = d.data;
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <Top title="Dashboard" sub={today}>
        <button className="btn ghost" onClick={d.reload}><Icon n="refresh" size={15} /> Refresh</button>
        <a className="btn" href="#/bookings/new">+ Walk-in booking</a>
      </Top>
      <Loading state={d} />
      {x && (
        <>
          <div className="cards">
            <div className="card stat2"><div className="l">Occupancy</div><div className="v">{x.occupancy}%</div><div className="meter"><i style={{ width: Math.min(100, x.occupancy) + '%' }} /></div></div>
            <div className="card stat2"><div className="l">Available now</div><div className="v">{x.count.available || 0}</div><div className="s">of {x.total} rooms</div></div>
            <div className="card stat2"><div className="l">Check-ins next 2 hrs</div><div className="v">{x.checkins_soon}</div><div className="s">{x.checkins_soon ? 'Get the keys ready' : 'Nothing soon'}</div></div>
            <div className="card stat2 dark"><div className="l">Today's revenue</div><div className="v">{peso(x.revenue_today)}</div><div className="s">Paid bookings</div></div>
          </div>
          <div className="dash">
            <div className="card">
              <div className="row between" style={{ marginBottom: 14 }}><h2>Room availability</h2>
                <div className="legend"><i className="available" />Available<i className="reserved" />Reserved<i className="occupied" />Occupied<i className="cleaning" />Other</div></div>
              <div className="tiles">
                {x.board.map((r) => (
                  <div key={r.id} className={'tile ' + r.state} title={r.note}>
                    <b>{r.room_no}</b><span>{r.type_name}</span><em>{label(r.state)}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="stack">
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Upcoming check-ins</h2>
                {x.upcoming.length === 0 && <p className="muted">No check-ins soon.</p>}
                {x.upcoming.map((b) => (
                  <a key={b.booking_ref} className="li" href={'#/bookings/' + b.booking_ref}>
                    <div><b>{clock(b.start_at)}</b> · {b.guest_name}<small>{b.type_name} · {stay(b)}</small></div>
                    <span className="pill ok">Rm {b.room_no || '—'}</span>
                  </a>
                ))}
              </div>
              <div className="card">
                <h2 style={{ marginBottom: 6 }}>Latest notifications</h2>
                {x.notes.length === 0 && <p className="muted">Nothing sent yet.</p>}
                {x.notes.map((n, i) => (
                  <div key={i} className="li small"><span><Pill v={n.status} text={n.channel.toUpperCase() + ' · ' + n.status} /> {n.to}</span></div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
