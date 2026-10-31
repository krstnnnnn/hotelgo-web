import { Component, StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api, restore, signOut } from './api';
import { Toasts } from './ui';
import { Landing, Layout, SearchPage, SiteCtx, useSkin } from './site/Site';
import { BookingPage, Checkout, GuestForgot, GuestLogin, GuestPassword, GuestRegister, GuestReset, GuestVerify, Legal, Modify, MyBookings, NeedGuest, Pay, Receipt } from './site/Guest';
import { cfg } from './site/config';
import { Icon, Logo } from './icons';
import { Availability, ChangePassword, Login } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Bookings from './pages/Bookings';
import { Guests, Notifications, Payments, Reports, RoomsRates, Settings } from './pages/Screens';
import { Hotels } from './pages/Hotels';
import { Photos } from './pages/Photos';
import { Audit, Staff } from './pages/Owner';
import { Bell } from './v2';
import Requests from './pages/Requests';

/* tiny hash router: #/bookings/HG-ABC123 -> ['bookings', 'HG-ABC123'] */
function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => { const f = () => setR(read()); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);
  return r;
}

const NAV = [
  ['dashboard', 'Dashboard', 'staff', 'dashboard'], ['bookings', 'Reservations', 'staff', 'bookings'], ['requests', 'Requests', 'staff', 'bell'], ['guests', 'Guests', 'staff', 'guests'], ['availability', 'Availability', 'staff', 'availability'],
  ['types', 'Room types', 'staff', 'types'], ['rooms', 'Rooms', 'staff', 'rooms'],
  ['hotels', 'Hotels', 'admin', 'hotel'], ['payments', 'Payments', 'admin', 'payments'], ['notifications', 'Notifications', 'admin', 'notifications'], ['reports', 'Reports', 'admin', 'reports'], ['staff', 'Staff', 'admin', 'staff'], ['photos', 'Home photos', 'platform', 'photo'], ['settings', 'Settings', 'platform', 'settings'], ['audit', 'Audit log', 'admin', 'audit'],
  ['account', 'My account', 'staff', 'account'],
];
const initials = (n) => String(n || '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

function Shell({ user, route, onOut }) {
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState({});
  useEffect(() => { api('GET', '/dashboard').then((d) => setBadges(d.badges || {}), () => {}); }, []);
  const [page, arg] = route;
  const admin = user.role === 'admin'; const platform = !!user.platform;
  const view = () => {
    switch (page) {
      case 'dashboard': return <Dashboard user={user} onBadges={setBadges} />;
      case 'bookings': return <Bookings user={user} refParam={arg} />;
      case 'requests': return <Requests />;
      case 'guests': return <Guests user={user} />;
      case 'availability': return <Availability signedIn />;
      case 'types': return <RoomsRates user={user} tab="types" />;
      case 'rooms': return <RoomsRates user={user} tab="rooms" />;
      case 'account': return <ChangePassword />;
      case 'hotels': return admin ? <Hotels user={user} /> : <NoAccess />;
      case 'payments': return admin ? <Payments user={user} /> : <NoAccess />;
      case 'notifications': return admin ? <Notifications /> : <NoAccess />;
      case 'reports': return admin ? <Reports user={user} /> : <NoAccess />;
      case 'staff': return admin ? <Staff user={user} /> : <NoAccess />;
      case 'photos': return platform ? <Photos /> : <NoAccess />;
      case 'settings': return platform ? <Settings /> : <NoAccess />;
      case 'audit': return admin ? <Audit /> : <NoAccess />;
      default: return <div className="card empty">Page not found.</div>;
    }
  };
  return (
    <div className="shell">
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><Logo /><div>HOTEL<span>GO</span><small>{user.hotel_name || 'Platform console'}</small></div></div>
        <nav className="nav" onClick={() => setOpen(false)}>
          {NAV.filter((n) => n[2] === 'staff' || (n[2] === 'admin' && admin) || (n[2] === 'platform' && platform)).map(([p, t, , ic]) => (
            <span key={p}>{p === 'payments' && <small>Owner</small>}{p === 'account' && <small>Account</small>}<a href={'#/' + p} className={page === p ? 'on' : ''}><Icon n={ic} />{p === 'hotels' && !platform ? 'My hotel' : t}{p === 'bookings' && badges.pending > 0 && <em className="badge">{badges.pending}</em>}{p === 'requests' && badges.requests > 0 && <em className="badge">{badges.requests}</em>}</a></span>
          ))}
        </nav>
        <div className="who">
          <div className="av">{initials(user.full_name)}</div>
          <div className="wn"><b>{user.full_name}</b><span>{user.platform ? 'Platform admin' : user.role === 'admin' ? 'Hotel owner' : 'Front desk'}</span></div>
          <button className="ib" title="Sign out" aria-label="Sign out" onClick={onOut}><Icon n="out" /></button>
        </div>
      </aside>
      <main className="main">
        <div className="v2"><div className="row between" style={{ marginBottom: 6 }}><button className="btn small ghost menu-btn" onClick={() => setOpen(!open)}><Icon n="menu" size={16} /> Menu</button><span /><div className="bellbar"><Bell tick={page} admin={admin} /></div></div></div>
        {view()}
      </main>
    </div>
  );
}
const NoAccess = () => <div className="card empty">Only the owner can open this page.</div>;

const CONSOLE_PAGES = NAV.map((n) => n[0]);
const LEGAL = ['terms', 'privacy', 'cancellation-policy', 'house-rules'];

/* the guest part of the website: sign-in, booking, payment, my bookings, legal pages */
function guestPage(route, user, setUser) {
  const [page, a, b] = route;
  switch (page) {
    case 'login': return <GuestLogin onUser={setUser} />;
    case 'register': return <GuestRegister />;
    case 'verify': return <GuestVerify onUser={setUser} />;
    case 'forgot': return <GuestForgot />;
    case 'reset': return <GuestReset />;
    case 'book': return <NeedGuest user={user}><Checkout user={user} /></NeedGuest>;
    case 'pay': return <NeedGuest user={user}><Pay bookingRef={a} /></NeedGuest>;
    case 'my-bookings': return <NeedGuest user={user}><MyBookings /></NeedGuest>;
    case 'my-password': return <NeedGuest user={user}><GuestPassword /></NeedGuest>;
    case 'booking': return <NeedGuest user={user}>{b === 'modify' ? <Modify bookingRef={a} /> : <BookingPage bookingRef={a} />}</NeedGuest>;
    case 'receipt': return <NeedGuest user={user}><Receipt bookingRef={a} /></NeedGuest>;
    default: return LEGAL.includes(page) ? <Legal page={page} /> : null;
  }
}
const GUEST_PAGES = ['login', 'register', 'verify', 'forgot', 'reset', 'book', 'pay', 'my-bookings', 'my-password', 'booking', 'receipt', ...LEGAL];

function App() {
  const route = useRoute();
  const [user, setUser] = useState(undefined);       // undefined = still checking, null = signed out
  useEffect(() => { restore().then(setUser); }, []);
  const page = route[0] || '';
  const staff = !!user && user.role !== 'guest';
  const isDoor = !!cfg.staffPath && page === cfg.staffPath;          // the secret staff address
  const isConsole = staff && CONSOLE_PAGES.includes(page);
  useSkin(isConsole || isDoor ? 'console' : 'site');
  const out = async () => { await signOut(); setUser(null); location.hash = '#/'; };
  if (user === undefined) return <div className="login"><div className="card">Loading…</div></div>;
  if (isDoor && !staff) return <Login onUser={(u) => { setUser(u); location.hash = '#/dashboard'; }} />;
  if (isDoor && staff) { location.hash = '#/dashboard'; return null; }
  if (isConsole) {
    if (Number(user.must_change_password)) return <ChangePassword forced onDone={() => setUser({ ...user, must_change_password: 0 })} />;
    return <Shell user={user} route={route} onOut={out} />;
  }
  const guestView = GUEST_PAGES.includes(page) ? guestPage(route, user, setUser) : null;
  return (
    <SiteCtx.Provider value={{ user, onOut: out }}>
      {page === 'search' ? <SearchPage /> : guestView ? <Layout>{guestView}</Layout> : <Landing />}
    </SiteCtx.Provider>
  );
}

/* A page that crashes shows a message instead of a blank screen */
class Guard extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="login"><div className="card" style={{ textAlign: 'center' }}>
        <h2>Something went wrong</h2>
        <p className="muted">{String(this.state.err.message || this.state.err)}</p>
        <button className="btn" onClick={() => { location.hash = '#/'; location.reload(); }}>Reload</button>
      </div></div>
    );
  }
}

createRoot(document.getElementById('root')).render(<StrictMode><Guard><Toasts><App /></Toasts></Guard></StrictMode>);
