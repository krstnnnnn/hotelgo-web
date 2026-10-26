import { Logo } from '../icons';
import { useState } from 'react';
import { api, signIn } from '../api';
import { Err, Field, FormModal, Loading, Top, label, peso, useLoad, useToast } from '../ui';

export function Login({ onUser }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const go = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onUser(await signIn(email, pw)); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="auth2">
      <section className="art2">
        <div className="brand light"><Logo size={42} /><div>HOTEL<span>GO</span><small>Staff console</small></div></div>
        <span className="chip">STAFF PORTAL · PUERTO GALERA</span>
        <h1>Run the front desk from one screen.</h1>
        <ul><li>Live room availability and instant room assignment</li><li>Check guests in and out in two clicks</li><li>Every sign-in is recorded in the audit log</li></ul>
        <div className="sun" aria-hidden="true" /><div className="wave" aria-hidden="true" /><div className="wave w2" aria-hidden="true" /><div className="wave w3" aria-hidden="true" />
      </section>
      <section className="form2">
        <form className="box" onSubmit={go}>
          <div className="brand only-small"><Logo size={38} /><div>HOTEL<span>GO</span></div></div>
          <h1>Welcome back</h1>
          <p className="muted" style={{ marginTop: 0 }}>Sign in with your front-desk or owner account.</p>
          <Err text={err} />
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus /></Field>
          <Field label="Password">
            <div className="pw"><input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="eye" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'}</button></div>
          </Field>
          <button className="btn block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <p style={{ textAlign: 'center', marginBottom: 0 }}><a href="#/availability">Check room availability</a></p>
        </form>
      </section>
    </div>
  );
}

/* Shown to a new staff account (temporary password) and from the menu */
export function ChangePassword({ forced, onDone }) {
  const [cur, setCur] = useState(''); const [pw, setPw] = useState(''); const [pw2, setPw2] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  const go = async (e) => {
    e.preventDefault(); setErr('');
    if (pw !== pw2) return setErr('The two new passwords are not the same.');
    setBusy(true);
    try { await api('POST', '/me/password', { current: cur, password: pw }); toast('Password updated.'); setCur(''); setPw(''); setPw2(''); onDone && onDone(); }
    catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const form = (
    <form className="card" onSubmit={go} style={{ maxWidth: 440 }}>
      <h2>{forced ? 'Choose a new password' : 'Change password'}</h2>
      {forced && <p className="muted">Your account uses a temporary password. Please choose your own before you continue.</p>}
      <Err text={err} />
      <Field label="Current password"><input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></Field>
      <Field label="New password (8+ characters, letters and numbers)"><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required /></Field>
      <Field label="New password again"><input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required /></Field>
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
    </form>
  );
  return forced ? <div className="login">{form}</div> : <><Top title="My account" />{form}</>;
}

/* Public: anybody can see which room types are free for a time (no sign-in) */
const SITE = String((window.HOTELGO_CONFIG && window.HOTELGO_CONFIG.apiUrl) || 'http://localhost:8000/api').replace(/\/api\/?$/, '');
export function Availability({ signedIn }) {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [q, setQ] = useState({ stay: 'hourly', date: tomorrow, time: '19:00', hours: 3, guests: 2 });
  const [run, setRun] = useState(q);
  const res = useLoad(() => api('GET', '/availability?' + new URLSearchParams(run)), [JSON.stringify(run)]);
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const rows = res.data ? res.data.data : [];
  const search = (
    <form className="pubsearch" onSubmit={(e) => { e.preventDefault(); setRun(q); }}>
      <Field label="Stay"><select value={q.stay} onChange={set('stay')}><option value="hourly">Hourly</option><option value="overnight">Overnight</option></select></Field>
      <Field label="Date"><input type="date" value={q.date} onChange={set('date')} min={new Date().toISOString().slice(0, 10)} /></Field>
      <Field label="Start time"><input type="time" value={q.time} onChange={set('time')} /></Field>
      {q.stay === 'hourly' && <Field label="Hours"><select value={q.hours} onChange={set('hours')}><option>3</option><option>6</option><option>12</option></select></Field>}
      <Field label="Guests"><input type="number" min="1" max="10" value={q.guests} onChange={set('guests')} /></Field>
      <button className="btn">Search rooms</button>
    </form>
  );
  const list = (
    <>
      <Loading state={res} />
      {res.data && <h2 className="pubh">{rows.length} room type{rows.length === 1 ? '' : 's'} available to browse</h2>}
      <div className="pubstack">
        {res.data && rows.length === 0 && <div className="card empty">No room type fits that many guests. Try fewer guests.</div>}
        {rows.map((t, i) => (
          <div className={'result' + (t.free < 1 ? ' full' : '')} key={t.id}>
            <div className={'scene t' + ((i % 3) + 1)}><i /></div>
            <div className="rbody">
              <div className="rtop"><h3>{t.name}</h3>
                {t.free < 1 ? <span className="pill gray">Fully booked</span> : t.free <= 2 ? <span className="pill warn">Only {t.free} left</span> : <span className="pill ok">{t.free} rooms free</span>}</div>
              <p className="muted">{t.description}</p>
              <div className="chips">{String(t.amenities || '').split(',').map((a) => a.trim()).filter(Boolean).map((a) => <span className="chip" key={a}>{a}</span>)}
                <span className="chip">Up to {t.max_guests} guests</span></div>
            </div>
            <div className="buy">
              <div className="price">{peso(t.price)}</div>
              <div className="muted small">{run.stay === 'overnight' ? 'overnight' : run.hours + ' hrs'}</div>
              {t.free > 0 ? <a className="btn" href={SITE + '/book?' + new URLSearchParams({ stay: run.stay, date: run.date, time: run.time, hours: run.hours, guests: run.guests, type: t.id })}>Select room</a>
                : <span className="muted small">Try another time</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
  if (signedIn) return <><Top title="Availability" sub="What a guest would see for a chosen time." /><div className="card" style={{ marginBottom: 16 }}>{search}</div>{list}</>;
  return (
    <div className="pub">
      <header className="pubhero">
        <div className="pubnav"><div className="brand"><Logo size={36} /><div>HOTEL<span>GO</span></div></div><a href="#/">Staff sign in</a></div>
        <h1>Find a room for <em>tonight</em></h1>
        <p>Pick your time and see what is free right now. Rooms are assigned automatically and sent to you by SMS and email.</p>
      </header>
      <main className="pubmain"><div className="card pubcard">{search}</div>{list}</main>
      <footer className="pubfoot">HOTELGO · Puerto Galera</footer>
    </div>
  );
}
export { label };
