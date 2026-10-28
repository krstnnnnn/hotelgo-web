import { useState } from 'react';
import { api } from '../api';
import { Confirm, Field, FormModal, Loading, Modal, Pill, Table, Top, useLoad, useToast, when } from '../ui';

export function Staff({ user }) {
  const list = useLoad(() => api('GET', '/staff'));
  const [edit, setEdit] = useState(null); const [del, setDel] = useState(null); const [made, setMade] = useState(null); const toast = useToast();
  return (
    <>
      <Top title="Staff & roles" sub="Front-desk accounts. New accounts get a temporary password."><button className="btn" onClick={() => setEdit({})}>+ New staff</button></Top>
      <div className="card">
        <Loading state={list} />
        {list.data && <Table head={['Name', 'Email', 'Mobile', ...(user.platform ? ['Hotel'] : []), 'Role', 'Active', 'Last sign-in', '']} empty="No staff."
          rows={list.data.data.map((u) => (
            <tr key={u.id}><td><b>{u.full_name}</b></td><td>{u.email}</td><td>{u.mobile}</td>{user.platform && <td>{u.hotel_name || 'All hotels'}</td>}<td>{u.role === 'admin' ? (u.hotel_id ? 'Hotel owner' : 'Platform admin') : 'Front desk'}</td><td><Pill v={Number(u.is_active) ? 'active' : 'off'} text={Number(u.is_active) ? 'Yes' : 'Disabled'} /></td><td>{when(u.last_login_at) || '—'}</td>
              <td className="row">{(u.role === 'staff' || (u.role === 'admin' && u.hotel_id && user.platform)) && u.id !== user.id && <>
                <button className="btn small" onClick={() => setEdit(u)}>Edit</button>
                <button className="btn small ghost" onClick={async () => { try { await api('PUT', '/staff/' + u.id, { is_active: Number(u.is_active) ? 0 : 1 }); list.reload(); } catch (e) { toast(e.message, 'bad'); } }}>{Number(u.is_active) ? 'Disable' : 'Enable'}</button>
                <button className="btn small danger" onClick={() => setDel(u)}>Delete</button></>}</td></tr>
          ))} />}
      </div>
      {edit && <StaffForm u={edit} user={user} onClose={() => setEdit(null)} onSaved={(temp) => { list.reload(); if (temp) setMade(temp); }} />}
      {made && <Modal title="Account created" onClose={() => setMade(null)}><p>Give this temporary password to the staff member. <b>It is shown only once.</b> They must change it at first sign-in.</p><p><code style={{ fontSize: 18 }}>{made}</code></p><button className="btn" onClick={() => setMade(null)}>Done</button></Modal>}
      {del && <Confirm title={'Delete ' + del.full_name} text="This removes the staff account. It cannot be undone." onClose={() => setDel(null)}
        onYes={async () => { await api('DELETE', '/staff/' + del.id); toast('Staff account deleted.'); list.reload(); }} />}
    </>
  );
}

function StaffForm({ u, user, onClose, onSaved }) {
  const hotels = useLoad(() => (user.platform ? api('GET', '/manage/hotels') : Promise.resolve({ data: [] })));
  const [f, setF] = useState({ full_name: u.full_name || '', email: u.email || '', mobile: u.mobile || '', hotel_id: '', role: 'staff' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    if (u.id) { await api('PUT', '/staff/' + u.id, { full_name: f.full_name, mobile: f.mobile }); onSaved(); }
    else { const r = await api('POST', '/staff', { ...f, hotel_id: Number(f.hotel_id) || (hotels.data?.data?.[0]?.id ?? undefined) }); onSaved(r.temporary_password); }
  };
  return (
    <FormModal title={u.id ? 'Edit staff' : 'New staff account'} onClose={onClose} onSave={save}>
      {!u.id && user.platform && <div className="grid2">
        <Field label="Hotel"><select value={f.hotel_id || hotels.data?.data?.[0]?.id || ''} onChange={set('hotel_id')} required>{(hotels.data?.data || []).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select></Field>
        <Field label="Role"><select value={f.role} onChange={set('role')}><option value="staff">Front desk</option><option value="owner">Hotel owner</option></select></Field>
      </div>}
      <Field label="Full name"><input value={f.full_name} onChange={set('full_name')} required /></Field>
      <Field label="Email"><input type="email" value={f.email} onChange={set('email')} required disabled={!!u.id} /></Field>
      <Field label="Mobile"><input value={f.mobile} onChange={set('mobile')} required /></Field>
    </FormModal>
  );
}

export function Audit() {
  const d = useLoad(() => api('GET', '/audit'));
  return (
    <>
      <Top title="Audit log" sub="Who did what, newest first. Entries cannot be edited or deleted." />
      <div className="card"><Loading state={d} />{d.data && <Table head={['When', 'Who', 'Action', 'Detail', 'IP']} empty="Nothing logged yet."
        rows={d.data.data.map((a) => <tr key={a.id}><td>{when(a.created_at)}</td><td>{a.full_name || '—'}</td><td>{a.action}</td><td className="muted">{a.detail}</td><td className="muted">{a.ip}</td></tr>)} />}</div>
    </>
  );
}
