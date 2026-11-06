import { useState } from 'react';
import { api } from '../api';
import { Confirm, Field, FormModal, Loading, Pill, Table, Top, peso, useLoad, useToast } from '../ui';

/* Coupons / promo codes: a welcome voucher for first-time guests, or an offer for an occasion (Christmas, summer ...). Owner only. */
const blank = { code: '', title: '', kind: 'percent', value: 10, max_discount: 0, min_spend: 0, first_booking_only: 0, starts_on: '', ends_on: '', stay_from: '', stay_to: '', max_uses: 0, per_user_limit: 1, is_public: 1, is_active: 1, hotel_id: '' };
const day = (s) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const off = (c) => (c.kind === 'percent' ? Number(c.value) + '% off' + (Number(c.max_discount) > 0 ? ' (max ' + peso(c.max_discount) + ')' : '') : peso(c.value) + ' off');
const rules = (c) => [Number(c.first_booking_only) && 'First booking only', Number(c.min_spend) > 0 && 'Min. rate ' + peso(c.min_spend), (c.starts_on || c.ends_on) && 'Use ' + (c.starts_on ? 'from ' + day(c.starts_on) : '') + (c.ends_on ? ' until ' + day(c.ends_on) : ''), (c.stay_from || c.stay_to) && 'Stay ' + (c.stay_from ? day(c.stay_from) : '…') + ' – ' + (c.stay_to ? day(c.stay_to) : '…'), Number(c.per_user_limit) > 0 && Number(c.per_user_limit) + ' per guest'].filter(Boolean).join(' · ');

export default function Coupons({ user }) {
  const list = useLoad(() => api('GET', '/coupons'));
  const hotels = useLoad(() => (user.platform ? api('GET', '/manage/hotels') : Promise.resolve({ data: [] })));
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const toast = useToast();
  return (
    <>
      <Top title="Coupons" sub="Promo codes for new guests or special occasions. Guests type the code at checkout; the front desk can type it for a walk-in.">
        <button className="btn" onClick={() => setEdit({ ...blank })}>+ New coupon</button>
      </Top>
      <div className="card">
        <Loading state={list} />
        {list.data && <Table head={['Code', 'Offer', 'Rules', 'Used', 'Status', '']} empty="No coupons yet. Make a welcome coupon for first-time guests."
          rows={list.data.data.map((c) => (
            <tr key={c.id}>
              <td><b>{c.code}</b><div className="muted small">{c.title}{user.platform && <> · {c.hotel_name || 'All hotels'}</>}</div></td>
              <td>{off(c)}</td><td className="small">{rules(c) || '—'}</td>
              <td>{c.used}{Number(c.max_uses) > 0 ? ' / ' + c.max_uses : ''}</td>
              <td><Pill v={Number(c.is_active) ? 'active' : 'off'} text={Number(c.is_active) ? (Number(c.is_public) ? 'On · shown' : 'On · secret') : 'Off'} /></td>
              <td><div className="row"><button className="btn small" onClick={() => setEdit(c)}>Edit</button><button className="btn small danger" onClick={() => setDel(c)}>Delete</button></div></td>
            </tr>
          ))} />}
      </div>
      {edit && <CouponForm c={edit} hotels={user.platform ? (hotels.data?.data || []) : null} onClose={() => setEdit(null)} onSaved={list.reload} />}
      {del && <Confirm title={'Delete ' + del.code} text="A coupon that was already used on a booking cannot be deleted. Switch it off instead." onClose={() => setDel(null)}
        onYes={async () => { await api('DELETE', '/coupons/' + del.id); toast('Coupon deleted.'); list.reload(); }} />}
    </>
  );
}

function CouponForm({ c, hotels, onClose, onSaved }) {
  const [f, setF] = useState({ ...c, hotel_id: c.hotel_id || '' }); const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tick = (k) => (e) => setF({ ...f, [k]: e.target.checked ? 1 : 0 });
  return (
    <FormModal title={c.id ? 'Edit coupon' : 'New coupon'} onClose={onClose} wide onSave={async () => {
      const body = { ...f, value: Number(f.value), max_discount: Number(f.max_discount) || 0, min_spend: Number(f.min_spend) || 0, max_uses: Number(f.max_uses) || 0, per_user_limit: Number(f.per_user_limit) || 0, hotel_id: Number(f.hotel_id) || 0 };
      if (c.id) await api('PUT', '/coupons/' + c.id, body); else await api('POST', '/coupons', body);
      toast('Coupon saved.'); onSaved();
    }}>
      <div className="grid2">
        <Field label="Code (letters and numbers)"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })} required minLength={3} maxLength={20} placeholder="WELCOME10" /></Field>
        <Field label="Title"><input value={f.title} onChange={set('title')} required minLength={2} maxLength={80} placeholder="New guest welcome" /></Field>
      </div>
      <div className="grid2">
        <Field label="Discount type"><select value={f.kind} onChange={set('kind')}><option value="percent">Percent off the room rate</option><option value="fixed">Fixed amount off (₱)</option></select></Field>
        <Field label={f.kind === 'percent' ? 'Percent off (1–100)' : 'Pesos off'}><input type="number" min="1" max={f.kind === 'percent' ? 100 : 100000} step="0.01" value={f.value} onChange={set('value')} required /></Field>
      </div>
      <div className="grid2">
        {f.kind === 'percent' && <Field label="Most it can take off (₱, 0 = no limit)"><input type="number" min="0" step="0.01" value={f.max_discount} onChange={set('max_discount')} /></Field>}
        <Field label="Minimum room rate (₱, 0 = none)"><input type="number" min="0" step="0.01" value={f.min_spend} onChange={set('min_spend')} /></Field>
      </div>
      <div className="grid2">
        <Field label="Can be used from (optional)"><input type="date" value={f.starts_on || ''} onChange={set('starts_on')} /></Field>
        <Field label="Can be used until (optional)"><input type="date" value={f.ends_on || ''} onChange={set('ends_on')} /></Field>
      </div>
      <div className="grid2">
        <Field label="Stay starts from (optional, for an event)"><input type="date" value={f.stay_from || ''} onChange={set('stay_from')} /></Field>
        <Field label="Stay starts until (optional)"><input type="date" value={f.stay_to || ''} onChange={set('stay_to')} /></Field>
      </div>
      <div className="grid2">
        <Field label="Total uses (0 = unlimited)"><input type="number" min="0" value={f.max_uses} onChange={set('max_uses')} /></Field>
        <Field label="Uses per guest (0 = unlimited)"><input type="number" min="0" value={f.per_user_limit} onChange={set('per_user_limit')} /></Field>
      </div>
      {hotels && <Field label="Hotel"><select value={f.hotel_id} onChange={set('hotel_id')}><option value="">All hotels</option>{hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>}
      <label className="chk"><input type="checkbox" checked={!!Number(f.first_booking_only)} onChange={tick('first_booking_only')} /> First booking only (new guests)</label>
      <label className="chk"><input type="checkbox" checked={!!Number(f.is_public)} onChange={tick('is_public')} /> Show on the website as a current offer (untick for a secret code)</label>
      <label className="chk"><input type="checkbox" checked={!!Number(f.is_active)} onChange={tick('is_active')} /> Switched on</label>
    </FormModal>
  );
}
