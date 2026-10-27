import { useState } from 'react';
import { api } from '../api';
import { Confirm, Field, FormModal, Loading, PhotoBox, Pill, Table, Top, useLoad, useToast } from '../ui';
import { photoUrl } from '../site/config';

const AREAS = ['Poblacion', 'Sabang', 'White Beach', 'Talipanan', 'Aninuan', 'Balatero', 'Big La Laguna', 'Small La Laguna', 'Muelle'];
const blank = { name: '', area: 'Sabang', address: '', description: '', lat: 13.5188, lng: 120.9647, phone: '', email: '', is_active: 1 };

/* Platform admin: every hotel on HOTELGO. Hotel owner: only their own hotel profile. */
export function Hotels({ user }) {
  const list = useLoad(() => api('GET', '/manage/hotels'));
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const toast = useToast();
  const platform = !!user.platform;
  return (
    <>
      <Top title={platform ? 'Hotels' : 'My hotel'} sub={platform ? 'Every hotel that sells rooms through HOTELGO, in different parts of Puerto Galera.' : 'The details guests see for your hotel.'}>
        {platform && <button className="btn" onClick={() => setEdit({ ...blank })}>+ New hotel</button>}
      </Top>
      <div className="card">
        <Loading state={list} />
        {list.data && <Table head={['', 'Hotel', 'Area', 'Rooms', 'Contact', 'Visible', '']} empty="No hotels yet."
          rows={list.data.data.map((h) => (
            <tr key={h.id}><td>{h.image_id ? <img className="thumb" src={photoUrl(h.image_id)} alt="" /> : null}</td><td><b>{h.name}</b><div className="muted small">{h.address}</div></td><td>{h.area}</td><td>{h.rooms}</td><td>{h.phone}<div className="muted small">{h.email}</div></td>
              <td><Pill v={Number(h.is_active) ? 'active' : 'off'} text={Number(h.is_active) ? 'Yes' : 'Hidden'} /></td>
              <td><div className="row"><button className="btn small" onClick={() => setEdit(h)}>Edit</button>{platform && <button className="btn small danger" onClick={() => setDel(h)}>Delete</button>}</div></td></tr>
          ))} />}
      </div>
      {edit && <HotelForm h={edit} onClose={() => setEdit(null)} onSaved={list.reload} onPhoto={list.reload} />}
      {del && <Confirm title={'Delete ' + del.name} text="A hotel that still has room types, staff or bookings cannot be deleted. Untick “Visible to guests” to hide it instead." onClose={() => setDel(null)}
        onYes={async () => { await api('DELETE', '/manage/hotels/' + del.id); toast('Hotel deleted.'); list.reload(); }} />}
    </>
  );
}

function HotelForm({ h, onClose, onSaved, onPhoto }) {
  const [f, setF] = useState(h); const [img, setImg] = useState(h.image_id || null); const toast = useToast();
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    const body = { ...f, lat: Number(f.lat), lng: Number(f.lng), is_active: Number(f.is_active) ? 1 : 0 };
    if (h.id) await api('PUT', '/manage/hotels/' + h.id, body); else await api('POST', '/manage/hotels', body);
    toast('Hotel saved.'); onSaved();
  };
  return (
    <FormModal title={h.id ? 'Edit hotel' : 'New hotel'} onClose={onClose} onSave={save}>
      {h.id ? <><div className="label">Hotel photo (shown on the home page)</div><PhotoBox kind="hotel" id={h.id} current={img} src={photoUrl(img)} onChange={(v) => { setImg(v); onPhoto(); }} /></> : <p className="muted small">Save the hotel first, then edit it to add its photo.</p>}
      <Field label="Hotel name"><input value={f.name} onChange={set('name')} required minLength={2} maxLength={120} /></Field>
      <div className="grid2">
        <Field label="Area"><input list="hg-areas" value={f.area || ''} onChange={set('area')} maxLength={80} /><datalist id="hg-areas">{AREAS.map((a) => <option key={a} value={a} />)}</datalist></Field>
        <Field label="Phone"><input value={f.phone || ''} onChange={set('phone')} maxLength={30} /></Field>
      </div>
      <Field label="Address"><input value={f.address || ''} onChange={set('address')} maxLength={255} /></Field>
      <Field label="Short description"><textarea rows="2" maxLength={500} value={f.description || ''} onChange={set('description')} /></Field>
      <div className="grid2">
        <Field label="Map latitude"><input type="number" step="0.000001" value={f.lat} onChange={set('lat')} required /></Field>
        <Field label="Map longitude"><input type="number" step="0.000001" value={f.lng} onChange={set('lng')} required /></Field>
      </div>
      <Field label="Email"><input type="email" value={f.email || ''} onChange={set('email')} maxLength={150} /></Field>
      <p className="muted small" style={{ marginTop: 0 }}>Tip: open the place on OpenStreetMap or Google Maps, right-click it and copy the latitude and longitude.</p>
      <label className="chk"><input type="checkbox" checked={!!Number(f.is_active)} onChange={(e) => setF({ ...f, is_active: e.target.checked ? 1 : 0 })} /> Visible to guests</label>
    </FormModal>
  );
}
