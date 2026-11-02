/* The public website: landing page + room search. Styled by assets/site.css (same design as the PHP site). */
import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api';
import { cfg, photoUrl } from './config';
import { Included, VipBadge } from '../ui';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d) => { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); };
const today = () => iso(new Date());
/* the next half hour that is still ahead of us (a search for a time that has passed finds nothing) */
const slot = () => {
  const d = new Date(Date.now() + 30 * 60000); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() > 30 ? 60 : d.getMinutes() > 0 ? 30 : 0);
  return { date: iso(d), time: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') };
};
const plus = (days) => iso(new Date(Date.now() + days * 86400000));

/* Switch between the website stylesheet and the staff console stylesheet */
export function useSkin(skin) {
  useEffect(() => {
    const site = document.getElementById('css-site'); const con = document.getElementById('css-console');
    if (site) site.disabled = skin !== 'site';
    if (con) con.disabled = skin !== 'console';
    document.documentElement.classList.toggle('js', skin === 'site');
  }, [skin]);
}

export function jump(id) {
  const go = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if (location.hash.startsWith('#/search')) { location.hash = '#/'; setTimeout(go, 120); } else go();
}
const Jump = ({ id, className, children }) => <a className={className} href="#/" onClick={(e) => { e.preventDefault(); jump(id); }}>{children}</a>;

/* who is signed in (set by the App in main.jsx): { user, onOut } */
export const SiteCtx = createContext({ user: null, onOut: () => {} });

export function Layout({ landing, children }) {
  const { user, onOut } = useContext(SiteCtx); const staff = !!user && user.role !== 'guest'; const guest = !!user && user.role === 'guest';
  const [scrolled, setScrolled] = useState(false); const [open, setOpen] = useState(false);
  useEffect(() => {
    document.body.classList.toggle('is-landing', !!landing);
    const f = () => setScrolled(window.scrollY > 8);
    f(); window.addEventListener('scroll', f, { passive: true });
    return () => { window.removeEventListener('scroll', f); document.body.classList.remove('is-landing'); };
  }, [landing]);
  const c = cfg.site;
  return (
    <>
      <header className={'nav' + (scrolled ? ' scrolled' : '')} id="nav"><div className="container nav-in">
        <a className="logo" href="#/"><i><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" fill="#fff" /><circle cx="12" cy="10" r="3" fill="#0E7C86" /></svg></i><span>HOTEL<b>GO</b></span></a>
        <button className="burger" type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}><span /><span /><span /></button>
        <nav className={'nav-links' + (open ? ' open' : '')} id="navlinks" aria-label="Main" onClick={(e) => { if (e.target.closest('a')) setOpen(false); }}>
          <Jump className="link" id="hotels">Hotels</Jump>
          <a className="link" href="#/search">Rooms</a>
          <Jump className="link" id="offer">What we offer</Jump>
          <Jump className="link" id="map">Map</Jump>
          <Jump className="link" id="gallery">Gallery</Jump>
          <Jump className="link" id="help">Help</Jump>
          <Jump className="link" id="contact">Contact</Jump>
          {staff && <a className="link" href="#/dashboard">Admin area</a>}
          {guest && <a className="link" href="#/my-bookings">My bookings</a>}
        </nav>
        <div className="row">
          {user ? <button className="btn btn-out btn-sm" type="button" onClick={onOut}>Sign out</button> : <a className="btn btn-out btn-sm" href="#/login">Sign in</a>}
          {!user && <a className="btn btn-amber btn-sm" href={landing ? '#/search' : '#/register'}>{landing ? 'Book now' : 'Register'}</a>}
          {user && <a className="btn btn-amber btn-sm" href="#/search">Book now</a>}
        </div>
      </div></header>
      <main>{children}</main>
      <footer><div className="container grid lp-foot">
        <div><div className="logo" style={{ color: '#fff' }}><span>HOTEL<b style={{ color: '#F5A524' }}>GO</b></span></div><p className="small">Hourly and overnight motel booking for Puerto Galera, Oriental Mindoro.</p>
          <p className="small"><a href={'mailto:' + c.email}>{c.email}</a><a href={'tel:' + c.phone}>{c.phone}</a><span>{c.location}</span></p></div>
        <div><h4>Guests</h4><a href="#/search">Search rooms</a><a href="#/my-bookings">My bookings</a><Jump id="help">Help &amp; FAQ</Jump><Jump id="contact">Contact us</Jump></div>
        <div><h4>Legal</h4><a href="#/terms">Terms of Service</a><a href="#/privacy">Privacy Policy</a><a href="#/cancellation-policy">Cancellation &amp; refunds</a><a href="#/house-rules">House rules</a></div>
      </div><div className="container small" style={{ marginTop: 24, borderTop: '1px solid #14344A', paddingTop: 16 }}>© {new Date().getFullYear()} HOTELGO · Puerto Galera, Oriental Mindoro, Philippines</div></footer>
    </>
  );
}

/* ---- search form (same as the PHP site) ---- */
function SearchForm({ init, onGo, areas = [] }) {
  const [q, setQ] = useState({ stay: 'hourly', date: slot().date, time: slot().time, hours: 3, guests: 2, area: '', ...init });
  const set = (k) => (e) => setQ({ ...q, [k]: e.target.value });
  const times = []; for (let m = 0; m < 1440; m += 30) { const h = Math.floor(m / 60), mm = m % 60; times.push([`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, `${h % 12 || 12}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`]); }
  return (
    <form onSubmit={(e) => { e.preventDefault(); onGo(q); }}>
      <div className="seg">
        <label><input type="radio" name="stay" value="hourly" checked={q.stay === 'hourly'} onChange={set('stay')} /> Hourly</label>
        <label><input type="radio" name="stay" value="overnight" checked={q.stay === 'overnight'} onChange={set('stay')} /> Overnight</label>
      </div>
      <div className="sf">
        <div><label htmlFor="date">Date</label><input type="date" id="date" required min={today()} max={plus(60)} value={q.date} onChange={set('date')} /></div>
        {q.stay === 'hourly' && <div><label htmlFor="time">Start time</label><select id="time" value={q.time} onChange={set('time')}>{times.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></div>}
        {q.stay === 'hourly' && <div><label htmlFor="hours">Duration</label><select id="hours" value={q.hours} onChange={set('hours')}>{[3, 6, 12].map((h) => <option key={h} value={h}>{h} hours</option>)}</select></div>}
        <div><label htmlFor="guests">Guests</label><select id="guests" value={q.guests} onChange={set('guests')}>{Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} guest{n > 1 ? 's' : ''}</option>)}</select></div>
        <div><label htmlFor="area">Area</label><select id="area" value={q.area || ''} onChange={set('area')}><option value="">All of Puerto Galera</option>{areas.map((a) => <option key={a} value={a}>{a}</option>)}</select></div>
        <button className="btn btn-amber" type="submit">Check availability</button>
      </div>
    </form>
  );
}
const goSearch = (q) => { const c = Object.fromEntries(Object.entries(q).filter(([, v]) => v !== '' && v !== undefined && v !== null)); location.hash = '#/search?' + new URLSearchParams(c).toString(); };
const useHotels = () => {
  const [h, setH] = useState(null);
  useEffect(() => { let live = true; api('GET', '/hotels').then((r) => live && setH(r), () => live && setH({ data: [], areas: [] })); return () => { live = false; }; }, []);
  return h;
};

/* The real pictures of the home page (slot -> image id). Empty until the admin uploads some; the drawn scenes are the fallback. */
const usePhotos = () => {
  const [m, setM] = useState({});
  useEffect(() => { let live = true; api('GET', '/photos').then((r) => live && setM(r.data || {}), () => {}); return () => { live = false; }; }, []);
  return m;
};

/* ---- room search results ---- */
export function SearchPage() {
  const raw = new URLSearchParams(location.hash.split('?')[1] || '');
  const p = { stay: raw.get('stay') === 'overnight' ? 'overnight' : 'hourly', date: raw.get('date') || slot().date, time: raw.get('time') || slot().time, hours: raw.get('hours') || '3', guests: raw.get('guests') || '2' };
  if (raw.get('area')) p.area = raw.get('area');
  if (raw.get('hotel')) p.hotel = raw.get('hotel');
  const key = JSON.stringify(p);
  const hot = useHotels();
  const [st, setSt] = useState({ loading: true });
  useEffect(() => {
    let live = true; setSt({ loading: true });
    api('GET', '/availability?' + new URLSearchParams(p))
      .then((r) => live && setSt({ data: r.data, w: r.window }))
      .catch((e) => live && setSt({ error: e.message }));
    return () => { live = false; };
  }, [key]); // eslint-disable-line
  const rows = st.data || [];
  const fmt = (s) => new Date(String(s).replace(' ', 'T')).toLocaleString('en-PH', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <Layout>
      <div className="container section" style={{ paddingTop: 100 }}>
        <div className="card" style={{ marginBottom: 20 }}><SearchForm key={key} init={p} onGo={goSearch} areas={hot ? hot.areas : []} /></div>
        {st.error && <div className="flash bad">{st.error}</div>}
        {st.loading && <div className="card center">Looking for free rooms…</div>}
        {st.data && <>
          <h2>{rows.length} room type{rows.length === 1 ? '' : 's'} in {new Set(rows.map((r) => r.hotel_id)).size} hotel{new Set(rows.map((r) => r.hotel_id)).size === 1 ? '' : 's'} for {fmt(st.w.start)} – {fmt(st.w.end)}</h2>
          <div className="flash info">You choose a room <b>type</b>. The exact room is <b>assigned automatically</b> and sent to you by SMS and email.</div>
          <div className="stack" style={{ marginTop: 20 }}>
            {rows.map((t, i) => (
              <div className={'result' + (t.free < 1 ? ' full' : '')} key={t.id}>{(t.image_id || t.hotel_image_id) ? <div className="scene photo"><img src={photoUrl(t.image_id || t.hotel_image_id)} alt={t.name} loading="lazy" /></div> : <div className={'scene t' + ((i % 3) + 1)}><i /></div>}
                <div className="body"><div className="small mute" style={{ fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{t.hotel_name} · {t.hotel_area}</div><div className="row"><h3 style={{ margin: 0 }}>{t.name}</h3><VipBadge t={t} />
                  {t.free < 1 ? <span className="pill gray">Fully booked</span> : t.free <= 2 ? <span className="pill warn">Only {t.free} left</span> : <span className="pill ok">{t.free} rooms free</span>}</div>
                  <p className="mute">{t.description}</p><Included t={t} />
                  <div className="chips">{String(t.amenities || '').split(',').map((a) => a.trim()).filter(Boolean).map((a) => <span className="chip" key={a}>{a}</span>)}<span className="chip">Up to {t.max_guests} guests</span></div>
                  <p className="small mute" style={{ margin: '10px 0 0' }}>Free cancellation until {cfg.site.cancelHours} hours before check-in</p></div>
                <div className="buy"><div className="price">{peso(t.price)}</div><div className="small mute">{p.stay === 'overnight' ? 'overnight' : st.w.hours + ' hrs'} · fee added at checkout</div>
                  {t.free > 0 ? <a className="btn" style={{ marginTop: 12 }} href={'#/book?' + new URLSearchParams({ ...p, type: t.id })}>Select room</a> : <span className="small mute">Try another time</span>}</div></div>
            ))}
            {rows.length === 0 && <div className="card center">No room type fits that. Try fewer guests or another area.</div>}
          </div>
        </>}
      </div>
    </Layout>
  );
}

/* ---- landing page ---- */
const OFFERS = [
  ['Hourly or overnight', 'Book 3, 6 or 12 hours, or a full overnight stay. Pay only for the time you need.', 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z'],
  ['Room assigned instantly', 'Pay online and a free room is assigned right away. No front-desk queue.', 'M5 12l4 4 10-10'],
  ['Secure online payment', 'GCash, Maya or card through PayMongo. Card details never touch our server.', 'M4 8h16v10H4zM4 11h16'],
  ['Ticket with QR code', 'Show the QR at the desk. Add it to your calendar and download the receipt.', 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2z'],
  ['Free changes', 'Move your time or cancel before the cutoff and your payment is refunded.', 'M4 12a8 8 0 0114-5l2-2v6h-6l2-2a5 5 0 00-9 3M20 12a8 8 0 01-14 5l-2 2v-6h6l-2 2a5 5 0 009-3'],
  ['Privacy first', 'We keep only the last 4 digits of your ID. Only staff you need can see your record.', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
];
const GALLERY = [['g1.svg', 'Sunset over the bay', 'Sunsets'], ['g5.svg', 'Palm-lined beach', 'Beach'], ['g3.svg', 'A quiet room with a sea view', 'Rooms'], ['g4.svg', 'The reefs of Puerto Galera', 'Reefs'], ['g2.svg', 'Bangka boats at midday', 'Boats'], ['g6.svg', 'Night terrace under the lanterns', 'Evenings']];
const img = (n) => 'assets/img/' + n;
const osm = (la, lo, d) => 'https://www.openstreetmap.org/export/embed.html?bbox=' + encodeURIComponent(`${lo - d},${la - d * 0.6},${lo + d},${la + d * 0.6}`) + '&layer=mapnik&marker=' + encodeURIComponent(`${la},${lo}`);

export function Landing() {
  const c = cfg.site;
  const [types, setTypes] = useState(null);
  const hot = useHotels(); const hotels = hot ? hot.data : null;
  const ph = usePhotos(); const pic = (slot, fb) => (ph[slot] ? photoUrl(ph[slot]) : img(fb));
  const [place, setPlace] = useState(0);
  const [box, setBox] = useState(-1);
  const [note, setNote] = useState({ t: 'This opens your email app with the message ready to send.', bad: false });

  useEffect(() => {                                   // room cards: one price list per stay type
    let live = true;
    const d = plus(1);
    Promise.all([api('GET', '/availability?' + new URLSearchParams({ stay: 'hourly', date: d, time: '19:00', hours: 3, guests: 1 })),
      api('GET', '/availability?' + new URLSearchParams({ stay: 'overnight', date: d, time: '19:00', hours: 3, guests: 1 }))])
      .then(([h, o]) => live && setTypes(h.data.map((t) => ({ ...t, p3: t.price, pn: (o.data.find((x) => x.id === t.id) || {}).price }))))
      .catch(() => live && setTypes([]));
    return () => { live = false; };
  }, []);

  useEffect(() => {                                   // fade-in on scroll + parallax
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => en.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;
    document.querySelectorAll('.reveal:not(.in)').forEach((el) => (io ? io.observe(el) : el.classList.add('in')));
    const hero = document.querySelector('[data-parallax]');
    const on = () => {
      if (reduce) return;
      if (hero && window.scrollY < 900) hero.style.transform = 'translateY(' + Math.round(window.scrollY * 0.25) + 'px)';
      document.querySelectorAll('[data-parallax2]').forEach((el) => { const r = el.parentNode.getBoundingClientRect(); if (r.bottom > 0 && r.top < window.innerHeight) el.style.transform = 'translateY(' + Math.round((r.top - window.innerHeight / 2) * -0.08) + 'px)'; });
    };
    window.addEventListener('scroll', on, { passive: true }); on();
    return () => { window.removeEventListener('scroll', on); if (io) io.disconnect(); };
  }, [types]);

  useEffect(() => {
    if (box < 0) return undefined;
    document.body.style.overflow = 'hidden';
    const k = (e) => { if (e.key === 'Escape') setBox(-1); if (e.key === 'ArrowLeft') setBox((b) => (b + GALLERY.length - 1) % GALLERY.length); if (e.key === 'ArrowRight') setBox((b) => (b + 1) % GALLERY.length); };
    document.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', k); };
  }, [box]);

  const places = [...(hotels || []).map((h) => ({ name: h.name, area: [h.area, h.address].filter(Boolean).join(' · '), src: osm(h.lat, h.lng, 0.012) })), { name: 'All of Puerto Galera', area: 'The whole municipality', src: osm(13.5, 120.954, 0.075) }];
  const send = (e) => {
    e.preventDefault(); const f = e.target.elements;
    const n = f.name.value.trim(), m = f.email.value.trim(), t = f.message.value.trim();
    if (!n || !/^\S+@\S+\.\S+$/.test(m) || !t) { setNote({ t: 'Please fill in your name, a valid email and a message.', bad: true }); return; }
    setNote({ t: 'Opening your email app…', bad: false });
    location.href = 'mailto:' + c.email + '?subject=' + encodeURIComponent('HOTELGO: ' + f.subject.value + ' (' + n + ')') + '&body=' + encodeURIComponent(t + '\n\n' + n + ' (' + m + ')');
  };

  return (
    <Layout landing>
      <section className="lp-hero" id="top">
        <img className="lp-hero-img" src={pic('hero', 'hero.svg')} alt="" data-parallax />
        <div className="lp-hero-shade" />
        <div className="container lp-hero-in">
          <span className="lp-eyebrow fade-up">Welcome to Puerto Galera</span>
          <h1 className="fade-up d1">Rest by the sea,<br /><em>by the hour</em> or overnight.</h1>
          <p className="fade-up d2">Pick your time, pay online and we assign a free room right away. Your ticket lands on your phone and inbox.</p>
          <div className="row fade-up d3" style={{ justifyContent: 'center' }}><Jump className="btn btn-fill btn-lg" id="search">Reserve your stay</Jump><Jump className="btn btn-line btn-lg" id="about">Discover more</Jump></div>
          <Jump className="lp-scroll fade-up d4" id="search"><span>Scroll</span><i /></Jump>
        </div>
      </section>

      <section className="search" id="search"><div className="container"><div className="card reveal"><SearchForm onGo={goSearch} areas={hot ? hot.areas : []} /></div></div></section>

      <section className="section lp-about" id="about"><div className="container grid g2 lp-center">
        <div className="lp-frame reveal"><img src={pic('about', 'g5.svg')} alt="A Puerto Galera beach" loading="lazy" /><span className="lp-badge"><b>24/7</b><small>online<br />booking</small></span></div>
        <div className="reveal d1"><div className="eyebrow">Our story</div><h2>A calmer way to <em>stay by the sea</em></h2>
          <p className="mute">HOTELGO is built for the beach town: short stays between dives and ferries, quiet nights after the beach, and last-minute plans. See what is free for the exact time you want and book it in a few taps.</p>
          <p className="mute">Every room type shows its real price for your hours, and the motel team sees your booking the moment it is paid.</p>
          <ul className="lp-stats"><li><b>3 · 6 · 12</b><span>Hours or overnight</span></li><li><b>{c.holdMinutes} min</b><span>Room hold</span></li><li><b>QR</b><span>Ticket, no queue</span></li></ul></div>
      </div></section>

      <section className="lp-bandq"><img className="lp-bandq-img" src={pic('quote', 'g1.svg')} alt="" loading="lazy" data-parallax2 /><div className="lp-bandq-shade" />
        <div className="container center reveal"><blockquote>“Your stay, your hours.<br />The sea does the rest.”</blockquote><p>HOTELGO · Puerto Galera</p></div></section>

      <section className="section" id="hotels"><div className="container"><div className="center"><div className="eyebrow reveal">One platform, many hotels</div><h2 className="reveal">Hotels across <em>Puerto Galera</em></h2>
        <p className="mute reveal" style={{ maxWidth: 640, margin: '0 auto' }}>Compare hotels in Sabang, White Beach, Talipanan and more. Pick the area you like, then book a room in one place.</p></div>
        <div className="grid g3 lp-rooms">
          {hotels === null && <div className="card center" style={{ gridColumn: '1/-1' }}>Loading hotels…</div>}
          {hotels && hotels.length === 0 && <div className="card center" style={{ gridColumn: '1/-1' }}>No hotels to show right now.</div>}
          {(hotels || []).map((h, i) => (
            <article className={'card flat lp-room reveal d' + (i % 3)} key={h.id}>
              <div className="lp-room-img"><img src={h.image_id ? photoUrl(h.image_id) : img(['g5.svg', 'g1.svg', 'g4.svg', 'g2.svg'][i % 4])} alt={h.name} loading="lazy" /><span className="lp-tag">{h.area}</span></div>
              <div className="lp-room-body"><h3>{h.name}</h3><p className="mute small">{h.description}</p>
                <div className="lp-prices"><div><span className="small mute">From</span><b>{peso(h.from_price)} / 3 hrs</b></div><a className="btn btn-sm" href={'#/search?' + new URLSearchParams({ stay: 'hourly', date: slot().date, time: slot().time, hours: 3, guests: 2, hotel: h.id })}>View rooms</a></div></div>
            </article>
          ))}
        </div></div></section>

      <section className="section" id="rooms"><div className="container"><div className="center"><div className="eyebrow reveal">Accommodations</div><h2 className="reveal">Our <em>Rooms &amp; Suites</em></h2>
        <p className="mute reveal" style={{ maxWidth: 620, margin: '0 auto' }}>Each room is a quiet place to rest. Prices are the room rate set by each hotel; a small online booking fee applies at checkout.</p></div>
        <div className="grid g3 lp-rooms">
          {types === null && <div className="card center" style={{ gridColumn: '1/-1' }}>Loading rooms…</div>}
          {types && types.length === 0 && <div className="card center" style={{ gridColumn: '1/-1' }}>Rooms could not be loaded right now. Please try again in a moment.</div>}
          {(types || []).slice(0, 6).map((t, i) => (
            <article className={'card flat lp-room reveal d' + (i % 3)} key={t.id}>
              <div className="lp-room-img"><img src={t.image_id ? photoUrl(t.image_id) : t.hotel_image_id ? photoUrl(t.hotel_image_id) : img(['g3.svg', 'g1.svg', 'g5.svg', 'g4.svg'][i % 4])} alt={t.name} loading="lazy" /><span className="lp-tag">From {peso(t.p3)} / 3 hrs</span></div>
              <div className="lp-room-body"><div className="small mute" style={{ fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t.hotel_name} · {t.hotel_area}</div><h3>{t.name} <VipBadge t={t} /></h3><p className="mute small">{t.description}</p><Included t={t} />
                <ul className="lp-amen">{String(t.amenities || '').split(',').slice(0, 4).map((a) => <li key={a}>{a.trim()}</li>)}<li>Up to {t.max_guests} guests</li></ul>
                <div className="lp-prices"><div><span className="small mute">Overnight</span><b>{peso(t.pn)}</b></div><a className="btn btn-sm" href={'#/search?' + new URLSearchParams({ stay: 'hourly', date: slot().date, time: slot().time, hours: 3, guests: 2, hotel: t.hotel_id })}>Book now</a></div></div>
            </article>
          ))}
        </div>
        {types && types.length > 6 && <p className="center" style={{ marginTop: 24 }}><a className="btn btn-out" href={'#/search?' + new URLSearchParams({ stay: 'hourly', date: slot().date, time: slot().time, hours: 3, guests: 2 })}>See all {types.length} room types</a></p>}
        </div></section>

      <section className="section lp-dark" id="offer"><div className="container"><div className="center"><div className="eyebrow reveal" style={{ color: '#F5A524' }}>What we offer</div><h2 className="reveal">Everything for <em>a short stay</em></h2></div>
        <div className="grid g3 lp-offers">{OFFERS.map(([h, d, path], i) => (
          <div className={'lp-offer reveal d' + (i % 3)} key={h}><span className="ico2"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#F5A524" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg></span><h3>{h}</h3><p>{d}</p></div>
        ))}</div></div></section>

      <section className="section" id="how"><div className="container"><div className="center"><div className="eyebrow reveal">How it works</div><h2 className="reveal">Booked in <em>three steps</em></h2></div>
        <ol className="lp-steps"><li className="reveal"><span className="num">1</span><h3>Pick your time</h3><p className="mute">Choose hourly or overnight, then your date, start time and guests.</p></li>
          <li className="reveal d1"><span className="num">2</span><h3>Pay online, securely</h3><p className="mute">Pay with GCash, Maya or card. Your receipt is sent right away.</p></li>
          <li className="reveal d2"><span className="num">3</span><h3>Get your room</h3><p className="mute">A free room is assigned automatically. Show the QR ticket at the desk.</p></li></ol></div></section>

      <section className="lp-cta"><img className="lp-bandq-img" src={pic('cta', 'g6.svg')} alt="" loading="lazy" data-parallax2 /><div className="lp-bandq-shade" />
        <div className="container center reveal"><span className="lp-eyebrow">Experience the coast</span><h2>Rest. Recharge. <em>Repeat.</em></h2><Jump className="btn btn-fill btn-lg" id="search">Reserve now</Jump></div></section>

      <section className="section lp-mapsec" id="map"><div className="container"><div className="center"><div className="eyebrow reveal">Find us</div><h2 className="reveal">Around <em>Puerto Galera</em></h2>
        <p className="mute reveal" style={{ maxWidth: 640, margin: '0 auto' }}>From the town proper to the beaches and dive spots, pick a place to see it on the map.</p></div>
        <div className="lp-map reveal">
          <div className="lp-map-side">
            <div className="label" style={{ marginBottom: 8 }}>Our hotels</div>
            {places.map((pl, i) => <button type="button" key={pl.name + i} className={'lp-place' + (place === i ? ' on' : '')} onClick={() => setPlace(i)}><b>{pl.name}</b><span>{pl.area}</span></button>)}
            <div className="label" style={{ margin: '16px 0 8px' }}>Explore an area</div>
            <div className="chips">{c.areas.map((a) => <a className="chip" key={a} target="_blank" rel="noopener noreferrer" href={'https://www.openstreetmap.org/search?query=' + encodeURIComponent(a + ', Puerto Galera')}>{a} ↗</a>)}</div>
          </div>
          <div className="lp-map-frame"><iframe title="Map of Puerto Galera" loading="lazy" referrerPolicy="no-referrer" src={(places[place] || places[places.length - 1]).src} /></div>
        </div></div></section>

      <section className="section" id="gallery" style={{ paddingTop: 20 }}><div className="container"><div className="center"><div className="eyebrow reveal">Visual stories</div><h2 className="reveal">Our <em>Gallery</em></h2></div>
        <div className="lp-gallery">{GALLERY.map(([f, alt, cap], i) => (
          <button type="button" className={'lp-g g' + (i + 1) + ' reveal'} key={f} onClick={() => setBox(i)}><img src={pic('gallery' + (i + 1), f)} alt={alt} loading="lazy" /><span>{cap}</span></button>
        ))}</div></div></section>
      <section className="section" id="help" style={{ paddingTop: 20 }}><div className="container grid g2" style={{ alignItems: 'start' }}>
        <div className="reveal"><div className="eyebrow">Help</div><h2>Questions, <em>answered</em></h2><p className="mute">Cannot find yours? Write to us and we will reply.</p>
          <p><a className="btn btn-out" href={'mailto:' + c.email}>Email {c.email}</a></p>
          <p className="small"><a href="#/terms">Terms</a> · <a href="#/privacy">Privacy</a> · <a href="#/cancellation-policy">Cancellation &amp; refunds</a> · <a href="#/house-rules">House rules</a></p></div>
        <div className="reveal d1">{faq(c).map(([q, a]) => <details className="lp-faq" key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </div></section>

      <section className="section lp-contact" id="contact"><div className="container grid g2" style={{ alignItems: 'start' }}>
        <div className="reveal"><div className="eyebrow" style={{ color: '#F5A524' }}>Get in touch</div><h2>We&rsquo;d love to <em>hear from you</em></h2>
          <ul className="lp-info">
            <li><span className="ico2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A524" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 7 9-7" /></svg></span><div><small>Email</small><a href={'mailto:' + c.email}>{c.email}</a></div></li>
            <li><span className="ico2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A524" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 4h4l2 5-2 1a11 11 0 005 5l1-2 5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" /></svg></span><div><small>Phone</small><a href={'tel:' + c.phone}>{c.phone}</a></div></li>
            <li><span className="ico2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F5A524" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg></span><div><small>Location</small><span>{c.location}</span></div></li>
          </ul></div>
        <form className="lp-form reveal d1" noValidate onSubmit={send}>
          <div className="grid g2" style={{ gap: '0 14px' }}><div className="field"><label htmlFor="cf-name">Your name</label><input id="cf-name" name="name" autoComplete="name" placeholder="Juan Dela Cruz" required /></div>
            <div className="field"><label htmlFor="cf-mail">Your email</label><input id="cf-mail" name="email" type="email" autoComplete="email" placeholder="juan@example.com" required /></div></div>
          <div className="field"><label htmlFor="cf-sub">Subject</label><select id="cf-sub" name="subject"><option>Room reservation</option><option>Payment question</option><option>Cancellation or refund</option><option>Something else</option></select></div>
          <div className="field"><label htmlFor="cf-msg">Message</label><textarea id="cf-msg" name="message" placeholder="How can we help you?" required /></div>
          <button className="btn btn-fill btn-block" type="submit">Send message</button>
          <p className="small" style={{ margin: '10px 0 0', color: note.bad ? '#B3261E' : undefined }}>{note.t}</p>
        </form>
      </div></section>

      {box >= 0 && (
        <div className="lp-lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer" onClick={(e) => { if (e.target === e.currentTarget) setBox(-1); }}>
          <button type="button" className="lb-x" aria-label="Close" onClick={() => setBox(-1)}>×</button>
          <button type="button" className="lb-n lb-prev" aria-label="Previous" onClick={() => setBox((box + GALLERY.length - 1) % GALLERY.length)}>‹</button>
          <img src={pic('gallery' + (box + 1), GALLERY[box][0])} alt={GALLERY[box][1]} />
          <button type="button" className="lb-n lb-next" aria-label="Next" onClick={() => setBox((box + 1) % GALLERY.length)}>›</button>
          <p>{GALLERY[box][1]}</p>
        </div>
      )}
    </Layout>
  );
}

function faq(c) {
  return [
    ['How does hourly booking work?', 'Choose your date, start time and 3, 6 or 12 hours. We show the room types that are free for that exact time. Pay online and a room is assigned automatically.'],
    ['How long is my room held while I pay?', `Your room is held for ${c.holdMinutes} minutes after you choose it. If payment is not completed in time the hold ends and the room is released.`],
    ['Can I cancel or move my booking?', `Yes, up to ${c.cancelHours} hours before your start time from the My bookings page. A paid booking that is cancelled in time is refunded. See the Cancellation & Refund Policy for details.`],
    ['What is the booking fee?', `A small online booking fee of ${peso(c.bookingFee)} is added to the room rate. Walk-in guests who pay cash at the desk do not pay it.`],
    ['What do I need at check-in?', 'Show the QR code or reference number on your ticket and a valid ID. We store only the last 4 characters of the ID number.'],
    ['Is it safe to pay online?', 'Payments run through PayMongo hosted checkout (GCash, Maya, card). Your card or wallet details are never typed on our site.'],
    ['I did not get my SMS or email. What now?', `Open My bookings after signing in: your ticket and room number are always there. You can also write to us at ${c.email}.`],
  ];
}
