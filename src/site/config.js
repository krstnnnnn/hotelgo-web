/* Public settings of the website. Override any of them from public/config.js:
   window.HOTELGO_CONFIG = { apiUrl: '...', staffPath: '...', site: { email: '...', phone: '...' } } */
const user = window.HOTELGO_CONFIG || {};
export const cfg = {
  apiUrl: String(user.apiUrl || 'http://localhost:8000/api').replace(/\/+$/, ''),
  staffPath: String(user.staffPath || '').replace(/^[#/]+|\/+$/g, ''),
  site: {
    name: 'HOTELGO', address: 'Puerto Galera, Oriental Mindoro', lat: 13.5188, lng: 120.9647,
    email: 'hotelgoph@gmail.com', phone: '+639708655964', location: 'Puerto Galera, Oriental Mindoro, Philippines',
    holdMinutes: 10, cancelHours: 2, bookingFee: 30,
    areas: ['Poblacion', 'Sabang', 'White Beach', 'Talipanan', 'Aninuan', 'Balatero', 'Big La Laguna', 'Small La Laguna', 'Muelle'],
    ...(user.site || {}),
  },
};
/* Address of the PHP website (the API server), used for sign-in, booking and the legal pages */
export const SITE = cfg.apiUrl.replace(/\/api$/, '');
