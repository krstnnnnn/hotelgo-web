/* The GUEST pages of the website: sign in / register, book, pay, my bookings, the booking ticket, receipt and the legal pages.
   They talk to the back end only through the JSON API (/api/guest/...). Same look as the landing page (assets/site.css). */
import { useEffect, useRef, useState } from 'react';
import { api, ApiError, download, guestSignIn, startSession } from '../api';
import { cfg, photoUrl } from './config';
import { legalDocs } from './legal';
import { Included, VipBadge } from '../ui';

/* ------------------------------------------------------------------ small helpers */
export const go = (path) => { location.hash = '#/' + path.replace(/^[#/]+/, ''); };
const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toDate = (s) => new Date(String(s).replace(' ', 'T'));
const fmtDt = (s) => {
  const d = toDate(s); if (isNaN(d)) return '';
  return d.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
};
const stayLabel = (b) => (b.stay_type === 'overnight' ? 'Overnight' : 'Hourly · ' + Number(b.hours) + ' hrs');
const payLabel = (m) => ({ ewallet: 'E-wallet', card: 'Card', bank: 'Bank / OTC', cash: 'Cash' }[m] || 'Online');
const pillOf = (s) => ({ confirmed: 'ok', paid: 'ok', sent: 'ok', accepted: 'ok', done: 'ok', pending_payment: 'warn', new: 'warn', logged: 'warn', checked_in: 'info', declined: 'bad', failed: 'bad' }[s] || 'gray');
const isoDate = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const timeOptions = () => Array.from({ length: 48 }, (_, i) => { const v = String(Math.floor(i / 2)).padStart(2, '0') + ':' + (i % 2 ? '30' : '00'); const d = new Date(2000, 0, 1, Math.floor(i / 2), (i % 2) * 30); return [v, d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })]; });
const maskEmail = (m = '') => m.replace(/^(.).*(@.*)$/, '$1***$2');

/* the part after ? in the hash address:  #/book?type=1&stay=hourly  ->  { type: '1', stay: 'hourly' } */
export const useQuery = () => {
  const read = () => Object.fromEntries(new URLSearchParams((location.hash.split('?')[1]) || ''));
  const [q, setQ] = useState(read);
  useEffect(() => { const f = () => setQ(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return q;
};

/* one-time messages that survive a page change (the old "flash") */
let pending = null;
export const flash = (kind, text) => { pending = { kind, text }; };
function Notice() {
  const [n] = useState(() => { const x = pending; pending = null; return x; });
  return n ? <div className={'flash ' + n.kind} role="status">{n.text}</div> : null;
}
const Err = ({ text }) => (text ? <div className="flash bad" role="alert">{text}</div> : null);

/* page needs a signed-in guest */
export function NeedGuest({ user, children }) {
  useEffect(() => { if (!user) { flash('info', 'Please sign in to continue.'); go('login?next=' + encodeURIComponent(location.hash.replace(/^#\/?/, ''))); } }, [user]);
  if (!user) return null;
  if (user.role !== 'guest') return <div className="container section"><div className="card center">You are signed in as staff. Please sign out of the staff console to book as a guest.</div></div>;
  return children;
}

/* the small icon set the old PHP pages used */
const PATHS = {
  wallet: 'M3 7a3 3 0 0 1 3-3h11v3M3 7v10a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V10a3 3 0 0 0-3-3H3M16 13.5h2',
  card: 'M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3 10h18M7 15h4',
  bank: 'M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  lock: 'M7 11h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3zM8 11V8a4 4 0 0 1 8 0v3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  bell: 'M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4',
  calendar: 'M6 5h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM8 3v4M16 3v4M3 10h18',
  message: 'M4 5h16v11H9l-5 4z',
  mail: 'M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM3 7l9 6 9-6',
  check: 'M5 12l5 5 9-10',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
};
export const Ico = ({ n, color = 'currentColor', size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[n]} /></svg>
);

const Field = ({ id, label, help, children }) => <div className="field"><label htmlFor={id}>{label}</label>{children}{help && <div className="help">{help}</div>}</div>;

/* ------------------------------------------------------------------ sign in, register, verify, forgot, reset */
export function GuestLogin({ onUser }) {
  const q = useQuery(); const [f, setF] = useState({ email: '', password: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { onUser(await guestSignIn(f.email, f.password)); go(q.next ? decodeURIComponent(q.next) : 'my-bookings'); }
    catch (x) {
      if (x instanceof ApiError && x.data.need_verify) { flash('info', 'Please verify your account first. We sent you a code by email.'); go('verify?email=' + encodeURIComponent(f.email)); return; }
      setErr(x.message); setBusy(false);
    }
  };
  return (
    <div className="auth">
      <div className="art"><span className="pill" style={{ background: '#14344A', color: '#F5A524' }}>Puerto Galera</span>
        <h1>Your room, on your time.</h1>
        <ul><li>✓ Live room availability and instant room assignment</li><li>✓ Secure online payment</li><li>✓ Manage or cancel your bookings</li></ul>
        <div className="sun" aria-hidden="true" /><div className="wave" aria-hidden="true" /><div className="wave w2" aria-hidden="true" /><div className="wave w3" aria-hidden="true" /></div>
      <div className="form"><div className="box">
        <h1 style={{ fontSize: '2rem' }}>Welcome back</h1><p className="mute">Sign in to manage your bookings.</p>
        <Notice /><Err text={err} />
        <form onSubmit={submit} autoComplete="on">
          <Field id="email" label="Email"><input id="email" type="email" required maxLength={150} autoComplete="username" value={f.email} onChange={set('email')} /></Field>
          <Field id="password" label="Password"><input id="password" type={show ? 'text' : 'password'} required maxLength={72} autoComplete="current-password" value={f.password} onChange={set('password')} />
            <button className="btn btn-sm btn-out" type="button" onClick={() => setShow(!show)} style={{ marginTop: 8 }}>Show / hide</button></Field>
          <div className="row between" style={{ marginBottom: 18 }}><span /><a href="#/forgot">Forgot password?</a></div>
          <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </form>
        <p className="center small" style={{ marginTop: 20 }}>New to HOTELGO? <a href="#/register"><b>Create an account</b></a></p>
      </div></div>
    </div>
  );
}

export function GuestRegister() {
  const [f, setF] = useState({ full_name: '', mobile: '', email: '', password: '', password2: '', agree: false }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/register', f); flash('ok', j.message); go('verify?email=' + encodeURIComponent(j.email)); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="eyebrow">Step 1 of 2 · Your details</div><h1 style={{ fontSize: '2rem' }}>Create your account</h1><p className="mute">We will email you a 6-digit code to verify your email address.</p>
      <Err text={err} />
      <form onSubmit={submit} autoComplete="on">
        <Field id="full_name" label="Full name"><input id="full_name" required maxLength={120} autoComplete="name" value={f.full_name} onChange={set('full_name')} /></Field>
        <Field id="mobile" label="Mobile number"><input id="mobile" required maxLength={20} placeholder="09XX XXX XXXX" autoComplete="tel" value={f.mobile} onChange={set('mobile')} /></Field>
        <Field id="email" label="Email"><input id="email" type="email" required maxLength={150} autoComplete="email" value={f.email} onChange={set('email')} /></Field>
        <Field id="password" label="Password" help="8+ characters with at least one letter and one number."><input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field id="password2" label="Confirm password"><input id="password2" type="password" required maxLength={72} autoComplete="new-password" value={f.password2} onChange={set('password2')} /></Field>
        <div className="check"><input id="agree" type="checkbox" required checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /><label htmlFor="agree">I agree to the <a href="#/house-rules">house rules</a> and <a href="#/privacy">privacy notice</a>.</label></div>
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
      </form>
      <p className="center small" style={{ marginTop: 16 }}>Already have an account? <a href="#/login"><b>Sign in</b></a></p>
    </div></div>
  );
}

export function GuestVerify({ onUser }) {
  const { email = '' } = useQuery(); const [note, setNote] = useState(''); const [code, setCode] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/verify', { email, code }); onUser(startSession(j, 'guest')); flash('ok', 'Your account is verified. Welcome to HOTELGO!'); go('my-bookings'); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  const resend = async () => { setErr(''); try { const j = await api('POST', '/guest/verify/resend', { email }); setNote(j.message); } catch (x) { setErr(x.message); } };
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <div className="eyebrow">Step 2 of 2</div><h1 style={{ fontSize: '2rem' }}>Verify your email</h1>
      <p className="mute">Enter the 6-digit code we sent to your <b>{maskEmail(email)}</b>. It expires in 10 minutes. (Check your spam folder too.)</p>
      <Notice />{note && <div className="flash info" role="status">{note}</div>}<Err text={err} />
      <form onSubmit={submit}>
        <Field id="code" label="6-digit code"><input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Checking…' : 'Verify and continue'}</button>
      </form>
      <button className="btn btn-out btn-block" type="button" style={{ marginTop: 12 }} onClick={resend}>Send a new code</button>
    </div></div>
  );
}

export function GuestForgot() {
  const [email, setEmail] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/forgot', { email }); flash('ok', j.message); go('reset?email=' + encodeURIComponent(email)); }
    catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem' }}>Forgot your password?</h1><p className="mute">Enter your account email. We will email you a 6-digit reset code.</p><Err text={err} />
      <form onSubmit={submit}><Field id="email" label="Email"><input id="email" type="email" required maxLength={150} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset code'}</button></form>
      <p className="center small" style={{ marginTop: 16 }}><a href="#/login">← Back to sign in</a></p>
    </div></div>
  );
}

export function GuestReset() {
  const { email = '' } = useQuery(); const [f, setF] = useState({ code: '', password: '', password2: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/reset', { email, ...f }); flash('ok', j.message); go('login'); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem' }}>Set a new password</h1><Notice /><Err text={err} />
      <form onSubmit={submit}>
        <Field id="code" label="6-digit code"><input id="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" value={f.code} onChange={set('code')} /></Field>
        <Field id="password" label="New password" help="8+ characters with letters and numbers."><input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field id="password2" label="Confirm new password"><input id="password2" type="password" required maxLength={72} autoComplete="new-password" value={f.password2} onChange={set('password2')} /></Field>
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </div></div>
  );
}

export function GuestPassword() {
  const [f, setF] = useState({ current: '', password: '', password2: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (f.password !== f.password2) { setErr('The two new passwords do not match.'); return; }
    setBusy(true);
    try { const j = await api('POST', '/guest/password', { current: f.current, password: f.password }); flash('ok', j.message); go('my-bookings'); } catch (x) { setErr(x.message); setBusy(false); }
  };
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
      <h1 style={{ fontSize: '2rem' }}>Change password</h1><Err text={err} />
      <form onSubmit={submit}>
        <Field id="current" label="Current password"><input id="current" type="password" required maxLength={72} autoComplete="current-password" value={f.current} onChange={set('current')} /></Field>
        <Field id="password" label="New password"><input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={f.password} onChange={set('password')} /></Field>
        <Field id="password2" label="Confirm new password"><input id="password2" type="password" required maxLength={72} autoComplete="new-password" value={f.password2} onChange={set('password2')} /></Field>
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </div></div>
  );
}

/* ------------------------------------------------------------------ checkout: details + payment method */
const ID_TYPES = ["Driver's license", 'Passport', 'UMID', 'National ID', 'Other government ID'];
const METHODS = [['ewallet', 'wallet', 'E-wallet', 'Pay with your wallet app'], ['card', 'card', 'Credit / debit card', 'Visa, Mastercard'], ['bank', 'bank', 'Bank / OTC', 'Transfer or pay at a store']];
export function Checkout({ user }) {
  const q = useQuery(); const [d, setD] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: user.full_name || '', mobile: user.mobile || '', email: user.email || '', id_type: ID_TYPES[0], id_number: '', pay_method: 'ewallet', agree: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const key = JSON.stringify(q);
  useEffect(() => {
    api('GET', '/guest/quote?' + new URLSearchParams(q)).then((j) => { setD(j); if (j.free < 1) setErr('Sorry, that room type is fully booked for your time.'); }, (e) => setErr(e.message));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/bookings', { ...q, ...f }); go('pay/' + j.booking_ref); } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (!d) return <div className="container section"><Err text={err || ''} />{!err && <div className="card center mute">Loading…</div>}{err && <p><a href="#/search">← Search again</a></p>}</div>;
  const { type: t, window: w, search: p } = d; const first = String(user.full_name || '').split(' ')[0];
  return (
    <div className="container section" style={{ paddingTop: 24 }}>
      <div className="steps" aria-label="Booking steps" style={{ marginBottom: 24 }}>
        <span className="s passed"><span className="c">✓</span>Search</span><span className="line" /><span className="s passed"><span className="c">✓</span>Choose room</span><span className="line" />
        <span className="s now"><span className="c">3</span>Details &amp; payment</span><span className="line" /><span className="s"><span className="c">4</span>Confirmed</span></div>
      <h1>Almost there, {first}.</h1>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 380px', alignItems: 'start' }}>
        <form className="stack" onSubmit={submit}>
          <Err text={err} />
          <div className="card"><div className="ctitle"><span className="ico"><Ico n="user" color="#0E7C86" /></span><h3>Guest details</h3></div>
            <div className="grid g2">
              <Field id="name" label="Full name"><input id="name" required maxLength={120} value={f.name} onChange={set('name')} /></Field>
              <Field id="mobile" label="Mobile number"><input id="mobile" required maxLength={20} value={f.mobile} onChange={set('mobile')} /></Field>
              <Field id="email" label="Email"><input id="email" type="email" required maxLength={150} value={f.email} onChange={set('email')} /></Field>
              <Field id="id_type" label="Valid ID"><select id="id_type" required value={f.id_type} onChange={set('id_type')}>{ID_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field id="id_number" label="ID number" help={<>For your privacy we save only the <b>last 4 characters</b> of your ID number.</>}><input id="id_number" required maxLength={30} autoComplete="off" value={f.id_number} onChange={set('id_number')} /></Field>
            </div>
            <div className="hint"><Ico n="bell" color="#4F6574" size={18} /><span>We will text and email your booking confirmation.</span></div></div>
          <div className="card"><div className="ctitle"><span className="ico"><Ico n="card" color="#0E7C86" /></span><h3>Payment method</h3><span className="lockline"><Ico n="lock" color="#4F6574" size={15} />Encrypted &amp; secure</span></div>
            <div className="pay-grid" role="radiogroup" aria-label="Payment method">
              {METHODS.map(([k, ic, n, desc]) => (
                <div key={k}><input className="pm" id={'pm_' + k} type="radio" name="pay_method" value={k} checked={f.pay_method === k} onChange={set('pay_method')} required />
                  <label className="pay-card" htmlFor={'pm_' + k}><span className="dot" /><span className="pi"><Ico n={ic} color="#0B2233" size={26} /></span><b>{n}</b><small>{desc}</small></label></div>
              ))}
            </div>
            <div className="hint"><Ico n="shield" color="#0E7C86" size={18} /><span>You will be taken to our payment partner's secure window to pay <b>{peso(d.total)}</b>, then returned here with your confirmation. Your room is held for {d.hold_minutes} minutes.</span></div>
            <div className="check" style={{ margin: '18px 0 16px' }}><input id="agree" type="checkbox" required checked={f.agree} onChange={(e) => setF({ ...f, agree: e.target.checked })} /><label htmlFor="agree">I agree to the <a href="#/house-rules">house rules</a>, <a href="#/cancellation-policy">cancellation policy</a> and <a href="#/privacy">privacy notice</a>.</label></div>
            <button className="btn btn-block btn-lg" type="submit" disabled={busy || d.free < 1}><Ico n="lock" color="#fff" size={18} /> {busy ? 'Please wait…' : 'Pay ' + peso(d.total) + ' and confirm'}</button></div>
        </form>
        <aside className="card">
          {(t.image_id || t.hotel_image_id) ? <div className="scene photo" style={{ borderRadius: 16, marginBottom: 16 }}><img src={photoUrl(t.image_id || t.hotel_image_id)} alt={t.name} /></div> : <div className="scene t2" style={{ borderRadius: 16, marginBottom: 16 }}><i /></div>}
          <h3>{t.name} <VipBadge t={t} /></h3><p className="mute">{t.hotel_name} · {t.hotel_area || 'Puerto Galera'}</p><Included t={t} />
          <div className="stack small">
            <div className="row between"><span className="mute">Stay</span><b>{p.stay === 'overnight' ? 'Overnight' : 'Hourly · ' + w.hours + ' hrs'}</b></div>
            <div className="row between"><span className="mute">Check-in</span><b>{fmtDt(w.start)}</b></div><div className="row between"><span className="mute">Check-out</span><b>{fmtDt(w.end)}</b></div>
            <div className="row between"><span className="mute">Guests</span><b>{p.guests}</b></div><div className="row between"><span className="mute">Room</span><b style={{ color: 'var(--teal)' }}>Assigned after payment</b></div><hr />
            <div className="row between"><span className="mute">Room rate</span><span>{peso(d.rate)}</span></div><div className="row between"><span className="mute">Online booking fee</span><span>{peso(d.fee)}</span></div>
            <div className="row between"><b>Total</b><span className="price">{peso(d.total)}</span></div></div>
          <div className="flash ok small">Free cancellation until {d.cancel_hours} hours before check-in.</div>
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ pay */
const useCountdown = (start) => {
  const [left, setLeft] = useState(start);
  useEffect(() => { setLeft(start); const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000); return () => clearInterval(t); }, [start]);
  return String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
};
export function Pay({ bookingRef }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(''); const [msg, setMsg] = useState('');
  const load = async () => {
    try {
      const j = await api('GET', '/guest/bookings/' + bookingRef + '/pay');
      if (j.state === 'paid') { flash('ok', j.message || 'Payment received. Your room has been assigned!'); go('booking/' + bookingRef); return; }
      if (j.state === 'refund_needed') { flash('bad', j.message); go('my-bookings'); return; }
      if (j.state !== 'pending') { flash('bad', 'This booking is no longer open for payment.'); go('my-bookings'); return; }
      setD(j);
    } catch (x) { setErr(x.message); }
  };
  useEffect(() => { load(); }, [bookingRef]);       // eslint-disable-line
  // PayMongo: after the guest comes back (or paid in another tab) ask the server whether it is paid
  useEffect(() => {
    if (!d) return undefined;
    const t = setInterval(async () => {
      try {
        const j = await api('POST', '/guest/bookings/' + bookingRef + '/pay', { do: 'check' });
        if (j.state === 'paid') { flash('ok', j.message || 'Payment received.'); go('booking/' + bookingRef); }
        else if (j.state === 'refund_needed') { flash('bad', j.message); go('my-bookings'); }
        else if (j.state === 'failed') setMsg('The payment was not completed. You can try again while your room is held.');
        else if (j.state !== 'pending') go('booking/' + bookingRef);
      } catch { /* try again next time */ }
    }, 6000);
    return () => clearInterval(t);
  }, [d, bookingRef]);
  const left = useCountdown(d ? d.seconds_left : 0);
  const start = async (body) => {
    setBusy(body.wallet || body.do); setErr('');
    try { const j = await api('POST', '/guest/bookings/' + bookingRef + '/pay', body); if (j.url) { location.href = j.url; return; } if (j.state === 'paid') { flash('ok', j.message); go('booking/' + bookingRef); } }
    catch (x) { setErr(x.message); }
    setBusy('');
  };
  const cancel = async () => {
    if (!window.confirm('Cancel this booking?')) return;
    try { await api('POST', '/guest/bookings/' + bookingRef + '/cancel'); flash('ok', 'Booking ' + bookingRef + ' was cancelled.'); go('my-bookings'); } catch (x) { setErr(x.message); }
  };
  if (!d) return <div className="container section"><div className="card center" style={{ maxWidth: 520, margin: '0 auto' }}><Err text={err} />{!err && 'Loading…'}</div></div>;
  const b = d.booking; 
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 560, margin: '0 auto' }}>
      <span className="pill">Secure payment · PayMongo</span>
      <h1 style={{ fontSize: '2rem', marginTop: 12 }}>Pay for your room</h1>
      <p className="mute">Room held for <b>{left}</b>. After you pay, this page confirms by itself.</p>
      <Notice /><Err text={err} />{msg && <div className="flash warn">{msg}</div>}
      <div className="stack small"><div className="row between"><span className="mute">Booking</span><b>{b.booking_ref}</b></div><div className="row between"><span className="mute">Room type</span><b>{b.type_name}</b></div>
        <div className="row between"><span className="mute">Stay</span><b>{fmtDt(b.start_at)}</b></div><div className="row between"><b>Amount due</b><span className="price">{peso(b.total)}</span></div></div>
      <>
          <h3 style={{ margin: '22px 0 8px' }}>E-wallet</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {d.wallets.map((w) => <button key={w} className="btn btn-amber btn-block" disabled={!!busy} onClick={() => start({ do: 'wallet', wallet: w })}>{busy === w ? 'Opening…' : d.wallet_names[w] || w}</button>)}
          </div>
          <h3 style={{ margin: '22px 0 8px' }}>Card, online banking or QR</h3>
          <button className="btn btn-out btn-block" disabled={!!busy} onClick={() => start({ do: 'link' })}>{busy === 'link' ? 'Opening…' : 'Open payment link'}</button>
          <p className="mute small" style={{ marginTop: 14 }} aria-live="polite">Paid already? This page checks by itself every few seconds.</p>
      </>
      <button className="btn btn-out btn-block" style={{ marginTop: 10 }} onClick={cancel}>Cancel</button>
    </div></div>
  );
}

/* ------------------------------------------------------------------ my bookings */
export function MyBookings() {
  const { tab: t = 'upcoming' } = useQuery(); const tab = ['upcoming', 'past', 'cancelled'].includes(t) ? t : 'upcoming';
  const [rows, setRows] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { setRows(null); api('GET', '/guest/bookings?tab=' + tab).then((j) => setRows(j.data), (e) => setErr(e.message)); }, [tab]);
  return (
    <div className="container section" style={{ paddingTop: 28 }}>
      <div className="row between"><h1>My bookings</h1>
        <div className="tabs">{[['upcoming', 'Upcoming'], ['past', 'Past'], ['cancelled', 'Cancelled']].map(([k, n]) => <a key={k} className={tab === k ? 'on' : ''} href={'#/my-bookings?tab=' + k}>{n}</a>)}</div></div>
      <Notice /><Err text={err} />
      <div className="stack" style={{ marginTop: 20 }}>
        {(rows || []).map((b) => (
          <div className="card row between" key={b.booking_ref}><div>
            <div className="row"><h3 style={{ margin: 0 }}>{b.room_no && b.status !== 'pending_payment' ? 'Room ' + b.room_no + ' · ' : ''}{b.type_name}</h3><span className={'pill ' + pillOf(b.status)}>{b.status.replace('_', ' ')}</span></div>
            <div className="mute small">{b.booking_ref} · {stayLabel(b)} · {fmtDt(b.start_at)} · {peso(b.total)}</div></div>
            <a className="btn btn-sm" href={'#/' + (b.status === 'pending_payment' ? 'pay/' : 'booking/') + b.booking_ref}>{b.status === 'pending_payment' ? 'Pay now' : 'View'}</a></div>
        ))}
        {rows && rows.length === 0 && <div className="card center mute">Nothing here yet. <a href="#/search">Find a room</a></div>}
        {!rows && !err && <div className="card center mute">Loading…</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ one booking: the ticket */
function Requests({ bookingRef, d, reload }) {
  const [f, setF] = useState({ service: (d.services || [])[0] || '', note: '' }); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/bookings/' + bookingRef + '/requests', f); flash('ok', j.message); setF({ ...f, note: '' }); reload(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };
  const pay = async (id) => { try { const j = await api('POST', '/guest/bookings/' + bookingRef + '/requests/' + id + '/pay'); location.href = j.url; } catch (x) { setErr(x.message); } };
  return (
    <div className="card vipbox"><div className="ctitle"><span className="ico"><Ico n="star" color="#B7791F" /></span><h3>Your VIP package</h3></div>
      {d.included.map(([t, x]) => <div className="row" style={{ gap: 8, margin: '4px 0' }} key={t}><Ico n="check" color="#0E7C86" size={16} /><span><b>{t}</b>{x && <span className="mute small"> · {x}</span>}</span></div>)}
      <h4 style={{ margin: '18px 0 8px' }}>Your requests</h4>
      {d.requests.length === 0 && <p className="mute small">Nothing requested yet. Need something else? Ask below.</p>}
      {d.requests.map((r) => (
        <div className="row between" style={{ gap: 10, margin: '8px 0', alignItems: 'flex-start' }} key={r.id}>
          <div><b>{r.service}</b>{r.note && <div className="mute small">{r.note}</div>}{Number(r.price) > 0 && <div className="small">Price: <b>{peso(r.price)}</b>{r.paid_at ? ' · paid' : ''}</div>}</div>
          <div className="row" style={{ gap: 8 }}><span className={'pill ' + pillOf(r.status)}>{r.status}</span>
            {d.online && r.owing && <button className="btn btn-sm" onClick={() => pay(r.id)}>Pay online</button>}</div>
        </div>
      ))}
      <Err text={err} />
      <form className="stack" style={{ marginTop: 14 }} onSubmit={send}>
        <Field id="rq_service" label="What do you need?"><select id="rq_service" required value={f.service} onChange={(e) => setF({ ...f, service: e.target.value })}>{d.services.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field id="rq_note" label="Details (optional)"><input id="rq_note" maxLength={500} placeholder="e.g. 8 PM, for 4 people" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
        <p className="mute small" style={{ margin: 0 }}>Extras may have a price. The team will confirm it before anything is charged. You can pay at the desk or online.</p>
      </form>
    </div>
  );
}

export function BookingPage({ bookingRef }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  const load = () => api('GET', '/guest/bookings/' + bookingRef).then(setD, (e) => setErr(e.message));
  useEffect(() => { setD(null); load(); }, [bookingRef]);       // eslint-disable-line
  const cancel = async () => {
    if (!window.confirm('Cancel this booking? Your payment will be refunded.')) return;
    try { const j = await api('POST', '/guest/bookings/' + bookingRef + '/cancel'); flash(j.refunded ? 'ok' : 'warn', j.message); go('my-bookings'); } catch (x) { setErr(x.message); }
  };
  if (!d) return <div className="container section"><Err text={err} />{!err && <div className="card center mute">Loading…</div>}{err && <p><a href="#/my-bookings">← My bookings</a></p>}</div>;
  const b = d.data; const ok = ['confirmed', 'checked_in'].includes(b.status); const first = String(b.guest_name).split(' ')[0];
  const start = toDate(b.start_at); const end = toDate(b.end_at); const z = (x) => x.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const gcal = 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: 'HOTELGO · Room ' + b.room_no, dates: z(start) + '/' + z(end), details: 'Booking ' + b.booking_ref + ' · ' + d.hotel.name, location: d.hotel.address });
  const remind = new Date(start.getTime() - 1800000).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  const maps = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(d.hotel.lat + ',' + d.hotel.lng);
  const osm = 'https://www.openstreetmap.org/export/embed.html?bbox=' + [d.hotel.lng - 0.004, d.hotel.lat - 0.004, d.hotel.lng + 0.004, d.hotel.lat + 0.004].join(',') + '&layer=mapnik&marker=' + d.hotel.lat + ',' + d.hotel.lng;
  return (
    <>
      {ok && (
        <section className="done"><div className="container row"><div className="tick"><Ico n="check" color="#0B2233" size={34} /></div><div><h1>You're booked, {first}!</h1><p>Payment received. Your room has been assigned and confirmations are on their way.</p></div></div>
          <svg className="waves" viewBox="0 0 1200 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30c150-40 300 30 450 0s300-30 450 0 200 20 300 0v40H0z" fill="#0A5F67" /><path d="M0 48c180-30 330 24 500 0s300-24 450 0 160 12 250 0v22H0z" fill="#0E7C86" /><path d="M0 62c200-20 360 14 560 0s330-14 480 0 110 8 160 0v8H0z" fill="#F3F7F9" /></svg></section>
      )}
      <div className="container section" style={{ paddingTop: ok ? 0 : 28 }}><Notice /><Err text={err} /><div className="tgrid">
        <div className="stack">
          <div className={'ticket2' + (ok ? '' : ' plain')}><div className="tmain"><div className="eyebrow">{d.hotel.name} · Puerto Galera</div>
            {ok ? <div className="bigroom">Room {b.room_no}</div> : <h2 style={{ margin: '6px 0' }}>{b.status.replace('_', ' ')}</h2>}
            <p className="mute" style={{ margin: 0 }}>{b.type_name} <VipBadge t={b} /> <span className={'pill ' + pillOf(b.status)}>{b.status.replace('_', ' ')}</span></p>
            <div className="kv"><div><span className="eyebrow">Check-in</span><b>{fmtDt(b.start_at)}</b></div><div><span className="eyebrow">Check-out</span><b>{fmtDt(b.end_at)}</b></div>
              <div><span className="eyebrow">Stay</span><b>{stayLabel(b)} · {b.guests} guests</b></div><div><span className="eyebrow">Paid</span><b>{peso(b.total)} · {payLabel(b.pay_method)}</b></div></div>
            <div className="row">
              {ok && <a className="btn btn-pill" href={'#/receipt/' + b.booking_ref}>Download receipt</a>}
              {d.can_modify && <a className="btn btn-pill" href={'#/booking/' + b.booking_ref + '/modify'}>Modify</a>}
              {b.status === 'pending_payment' && <a className="btn btn-amber btn-pill" href={'#/pay/' + b.booking_ref}>Pay now</a>}
              {d.can_cancel && <button className="btn btn-pill danger" type="button" onClick={cancel}>Cancel booking</button>}
              <a className="btn btn-pill" href="#/my-bookings">← My bookings</a></div></div>
            <div className="tside">{ok ? <><div className="qrbox" dangerouslySetInnerHTML={{ __html: d.qr }} /><div className="label">Booking ref</div><div className="ref">{b.booking_ref}</div><p className="small mute" style={{ margin: '6px 0 0' }}>Show this QR at check-in<br />with a valid ID.</p></>
              : <><div className="label">Booking ref</div><div className="ref">{b.booking_ref}</div><p className="small mute" style={{ margin: '6px 0 0' }}>The QR code appears after payment.</p></>}</div></div>
          {ok && <div className="mapcard"><iframe title={'Map of ' + d.hotel.name} loading="lazy" referrerPolicy="no-referrer" src={osm} />
            <div className="info"><h3 style={{ margin: '0 0 6px' }}>{d.hotel.name}</h3><p className="mute small">{d.hotel.address}</p><a className="btn btn-ink btn-sm" target="_blank" rel="noopener noreferrer" href={maps}>Get directions</a></div></div>}
          {Number(b.is_vip) === 1 && ok && <Requests bookingRef={b.booking_ref} d={d} reload={load} />}
        </div>
        <aside className="stack next"><h2 style={{ fontSize: '1.5rem' }}>What happens next</h2>
          {d.sms && <div className="card"><div className="head"><span className="bubble"><Ico n="message" color="#fff" size={18} /></span><b>{d.sms.status === 'logged' ? 'SMS (not sent)' : 'SMS sent'}</b><span className={'pill ' + pillOf(d.sms.status)}>{d.sms.status}</span></div><div className="msgbox">{d.sms.message}</div></div>}
          {d.mail && <div className="card"><div className="head"><span className="bubble"><Ico n="mail" color="#fff" size={18} /></span><b>{d.mail.status === 'logged' ? 'Email (not sent)' : 'Email sent'}</b><span className={'pill ' + pillOf(d.mail.status)}>{d.mail.status}</span></div>
            <div className="msgbox"><b>{d.mail.subject}</b><br /><span className="mute small">To {d.mail.recipient} · Booking details and directions included</span></div></div>}
          {ok && <><div className="card"><div className="head"><span className="bubble amber"><Ico n="calendar" color="#0B2233" size={18} /></span><b>Add it to your calendar</b></div><p className="mute small">Saves the stay with a reminder 30 minutes before check-in.</p>
            <button className="btn btn-block" type="button" onClick={() => download('/guest/bookings/' + b.booking_ref + '/calendar', 'hotelgo-' + b.booking_ref + '.ics').catch((e) => setErr(e.message))}>Add to calendar</button>
            <a className="btn btn-pill btn-block" style={{ marginTop: 8 }} target="_blank" rel="noopener noreferrer" href={gcal}>Open in Google Calendar</a></div>
            <div className="remind"><Ico n="bell" color="#7A4B00" size={20} /><span>Your calendar reminder goes off at <b>{remind}</b>, 30 minutes before check-in.</span></div></>}
        </aside></div></div>
    </>
  );
}

/* ------------------------------------------------------------------ change the date or time */
export function Modify({ bookingRef }) {
  const [d, setD] = useState(null); const [err, setErr] = useState(''); const [f, setF] = useState({ date: '', time: '19:00' }); const [busy, setBusy] = useState(false);
  useEffect(() => {
    api('GET', '/guest/bookings/' + bookingRef).then((j) => {
      if (!j.can_modify) { flash('bad', 'This booking can no longer be changed online. Please contact the motel.'); go('booking/' + bookingRef); return; }
      const s = toDate(j.data.start_at); setF({ date: isoDate(s), time: String(s.getHours()).padStart(2, '0') + ':' + String(s.getMinutes()).padStart(2, '0') }); setD(j);
    }, (e) => setErr(e.message));
  }, [bookingRef]);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const j = await api('POST', '/guest/bookings/' + bookingRef + '/modify', f); flash('ok', j.message); go('booking/' + bookingRef); } catch (x) { setErr(x.message); setBusy(false); }
  };
  if (!d) return <div className="container section"><Err text={err} />{!err && <div className="card center mute">Loading…</div>}</div>;
  const b = d.data; const today = new Date(); const max = new Date(Date.now() + 60 * 86400000);
  return (
    <div className="container section"><div className="card" style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="eyebrow">Booking {b.booking_ref}</div><h1 style={{ fontSize: '2rem' }}>Change your date or time</h1>
      <p className="mute">Now: <b>{fmtDt(b.start_at)}</b> ({stayLabel(b)}). Same room type and same length of stay, so the price does not change. Free changes until {d.cancel_hours} hours before check-in.</p>
      <Err text={err} />
      <form onSubmit={submit}>
        <Field id="date" label="New date"><input id="date" type="date" required min={isoDate(today)} max={isoDate(max)} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        {b.stay_type === 'hourly' && <Field id="time" label="New start time"><select id="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>{timeOptions().map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>}
        <button className="btn btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save new time'}</button>
      </form>
      <p className="center small" style={{ marginTop: 14 }}><a href={'#/booking/' + b.booking_ref}>← Keep my booking as it is</a></p>
    </div></div>
  );
}

/* ------------------------------------------------------------------ receipt */
export function Receipt({ bookingRef }) {
  const [d, setD] = useState(null); const [err, setErr] = useState('');
  useEffect(() => { api('GET', '/guest/bookings/' + bookingRef + '/receipt').then(setD, (e) => setErr(e.message)); }, [bookingRef]);
  if (!d) return <div className="container section"><Err text={err} />{!err && <div className="card center mute">Loading…</div>}</div>;
  const b = d.data;
  return (
    <div className="container section"><div className="receipt">
      <div className="row between no-print" style={{ marginBottom: 16 }}><a href={'#/booking/' + b.booking_ref}>← Back to booking</a><button className="btn" type="button" onClick={() => window.print()}>Print / Save as PDF</button></div>
      <div className="card"><div className="eyebrow">Official receipt</div><h1 style={{ fontSize: '2rem' }}>{d.hotel.name}</h1><p className="mute">{d.hotel.address}</p>
        <table><tbody>
          <tr><td>Booking reference</td><td>{b.booking_ref}</td></tr><tr><td>Guest</td><td>{b.guest_name}</td></tr><tr><td>Room</td><td>{b.room_no} · {b.type_name}</td></tr>
          <tr><td>Stay</td><td>{stayLabel(b)}</td></tr><tr><td>Check-in</td><td>{fmtDt(b.start_at)}</td></tr><tr><td>Check-out</td><td>{fmtDt(b.end_at)}</td></tr>
          <tr><td>Room rate</td><td>{peso(b.room_rate)}</td></tr><tr><td>Online booking fee</td><td>{peso(b.booking_fee)}</td></tr><tr><td><b>Total</b></td><td>{peso(b.total)}</td></tr>
          {d.payments.map((p, i) => <tr key={p.id}><td>{i === 0 ? 'Payment' : 'Extra payment'}</td><td>{payLabel(p.method)} · {p.txn_ref} · {p.status} · {peso(p.amount)} · {fmtDt(p.paid_at)}</td></tr>)}
        </tbody></table>
        <p className="small mute" style={{ marginTop: 16 }}>Thank you for booking with HOTELGO. Show your booking reference and a valid ID at check-in.</p></div>
    </div></div>
  );
}

/* ------------------------------------------------------------------ legal pages */
export function Legal({ page }) {
  const docs = legalDocs(cfg); const [title, secs] = docs[page] || docs.terms; const c = cfg.site;
  const tabs = [['terms', 'Terms'], ['privacy', 'Privacy'], ['cancellation-policy', 'Cancellation'], ['house-rules', 'House rules']]; const key = { 'cancellation-policy': 'cancellation', 'house-rules': 'rules' }[page] || page;
  return (
    <div className="container section legal">
      <a className="small" href="#/">← Back to home</a>
      <div className="eyebrow" style={{ marginTop: 14 }}>HOTELGO</div><h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>{title}</h1>
      <p className="mute small">Last updated 1 January {new Date().getFullYear()} · {c.location}</p>
      <nav className="tabs no-print" style={{ margin: '12px 0 24px', flexWrap: 'wrap' }} aria-label="Policies">
        {tabs.map(([k, n]) => <a key={k} className={(({ 'cancellation-policy': 'cancellation', 'house-rules': 'rules' })[k] || k) === key ? 'on' : ''} href={'#/' + k}>{n}</a>)}</nav>
      <div className="card legal-body">{secs.map(([h, t]) => <div key={h}><h3>{h}</h3><p className="mute">{t}</p></div>)}</div>
      <p className="small mute" style={{ marginTop: 16 }}>Questions? <a href={'mailto:' + c.email}>{c.email}</a> · <a href={'tel:' + c.phone}>{c.phone}</a></p>
    </div>
  );
}
