/* The look of every sign-in page (sign in, register, verify, forgot, reset): a photo slider of the hotels on the left,
   the form card on the right. It also holds the "Continue with Google" button. */
import { useEffect, useRef, useState } from 'react';
import { api, startSession } from '../api';
import { photoUrl } from './config';

const peso = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 0 });
const FALLBACK = [{ key: 'f', image: 'assets/img/hero.svg', name: 'Rest by the sea', area: 'Puerto Galera', chips: [] }];

/* the slides: the real hotels with a photo; the drawn pictures when there is none yet */
function useSlides() {
  const [slides, setSlides] = useState(FALLBACK);
  useEffect(() => {
    let live = true;
    api('GET', '/hotels').then((r) => {
      const s = (r.data || []).map((h, i) => ({
        key: 'h' + h.id, image: h.image_id ? photoUrl(h.image_id) : 'assets/img/' + ['g5.svg', 'g1.svg', 'g4.svg', 'g2.svg'][i % 4],
        name: h.name, area: h.area || 'Puerto Galera', chips: [h.from_price ? 'From ' + peso(h.from_price) + ' / 3 hrs' : ''].filter(Boolean),
      }));
      if (live && s.length) setSlides(s);
    }, () => {});
    return () => { live = false; };
  }, []);
  return slides;
}

export function AuthShell({ children }) {
  const slides = useSlides(); const [i, setI] = useState(0);
  useEffect(() => { setI(0); }, [slides.length]);
  useEffect(() => { if (slides.length < 2) return undefined; const t = setInterval(() => setI((v) => (v + 1) % slides.length), 5000); return () => clearInterval(t); }, [slides.length]);
  const s = slides[i] || slides[0]; const step = (d) => setI((i + d + slides.length) % slides.length);
  return (
    <div className="aus">
      <aside className="aus-left">
        <div className="aus-top"><a className="logo" href="#/" aria-label="HOTELGO home"><i><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" fill="#fff" /><circle cx="12" cy="10" r="3" fill="#F5A524" /></svg></i><span>HOTEL<b>GO</b></span></a></div>
        <div className="aus-photo">
          {slides.map((x, n) => <img key={x.key} className={'aus-img' + (n === i ? ' on' : '')} src={x.image} alt={n === i ? x.name : ''} />)}
          <div className="aus-shade" />
          <div className="aus-head"><span className="aus-eyebrow">Puerto Galera, Oriental Mindoro</span><h2>Find your stay in <em>Puerto Galera</em></h2></div>
          <div className="aus-cap">
            <span className="aus-pin"><svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" fill="#F5A524" /></svg>{s.area}</span>
            <h3>{s.name}</h3>
            <div className="aus-chips">{s.chips.map((c) => <span key={c}>{c}</span>)}</div>
            <div className="aus-dots" role="tablist" aria-label="Hotels">{slides.map((x, n) => <button type="button" key={x.key} className={n === i ? 'on' : ''} aria-label={'Show ' + x.name} onClick={() => setI(n)} />)}</div>
          </div>
          {slides.length > 1 && <div className="aus-arrows"><button type="button" aria-label="Previous" onClick={() => step(-1)}>‹</button><button type="button" aria-label="Next" onClick={() => step(1)}>›</button></div>}
          <svg className="aus-wave" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70c80-40 160-40 240 0s160 40 240 0 90-30 120-10v60H0z" fill="#0E7C86" /><path d="M0 90c90-36 170-30 250 4s170 30 350-14v40H0z" fill="#F5A524" opacity=".95" /><path d="M0 104c100-30 190-14 280 6s210 6 320-18v28H0z" fill="#0B2233" /></svg>
        </div>
      </aside>
      <main className="aus-right">{children}</main>
    </div>
  );
}

/* "Continue with Google": Google's own button (it hands us a signed ID token; the server checks it). Hidden until the owner has set GOOGLE_CLIENT_ID. */
let gsiLoading = null;
const loadGsi = () => {
  if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
  if (!gsiLoading) gsiLoading = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = () => { gsiLoading = null; no(new Error('Could not load Google.')); }; document.head.appendChild(s); });
  return gsiLoading;
};

export function GoogleButton({ onUser, onDone, onError, children }) {
  const [on, setOn] = useState(null); const box = useRef(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const c = await api('GET', '/guest/google');
        if (!c.enabled) { if (live) setOn(false); return; }
        await loadGsi();
        if (!live) return;
        setOn(true);
        window.google.accounts.id.initialize({
          client_id: c.client_id, ux_mode: 'popup',
          callback: async (resp) => {
            try { const j = await api('POST', '/guest/google', { credential: resp.credential }); const u = startSession(j, 'guest', true); onUser(u); onDone(); }
            catch (x) { onError(x.message); }
          },
        });
        const w = Math.min(400, Math.max(220, (box.current && box.current.offsetWidth) || 340));
        window.google.accounts.id.renderButton(box.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center', width: w });
      } catch { if (live) setOn(false); }
    })();
    return () => { live = false; };
  }, []);   // eslint-disable-line
  if (on === false) return null;
  return <><div className="aus-or"><span>or</span></div><div className="aus-google" ref={box} data-testid="google-button" aria-label="Continue with Google" />{children}</>;
}
