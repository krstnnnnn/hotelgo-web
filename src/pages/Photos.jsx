import { useState } from 'react';
import { api } from '../api';
import { Loading, PhotoBox, Top, useLoad } from '../ui';
import { photoUrl } from '../site/config';

/* Platform admin: the real pictures on the HOTELGO home page (top picture, banners, gallery). */
export function Photos() {
  const list = useLoad(() => api('GET', '/photos'));
  const [mine, setMine] = useState({});
  const d = list.data;
  return (
    <>
      <Top title="Home page photos" sub="Upload real photos for the home page. Until a photo is uploaded, the drawn picture is shown. Tip: wide photos (about 1600 x 900) look best for the large banners." />
      <Loading state={list} />
      {d && (
        <div className="photo-grid">
          {d.slots.map((s) => {
            const id = s.slot in mine ? mine[s.slot] : d.data[s.slot] || null;
            return (
              <div className="card" key={s.slot}>
                <b>{s.label}</b>
                <PhotoBox kind="site" slot={s.slot} current={id} src={photoUrl(id)} wide onChange={(v) => setMine({ ...mine, [s.slot]: v })} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
