// Bundles src/ into dist/ (index.html, app.js, app.css, config.js, favicon.svg).
//   npm run build   -> one build (this is what Render runs)
//   npm run dev     -> build, watch for changes and serve on http://localhost:5173
// The address of the API comes from the API_URL environment variable (see .env.example),
// or from public/config.js when API_URL is not set.
import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'dist');
mkdirSync(out, { recursive: true });

// optional local .env (never committed): API_URL=http://localhost:8000/api
const envFile = join(here, '.env');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const js = {
  entryPoints: [join(here, 'src', 'main.jsx')],
  bundle: true, minify: true, sourcemap: false, target: ['es2020'],
  outfile: join(out, 'app.js'), jsx: 'automatic', loader: { '.css': 'css' },
  define: { 'process.env.NODE_ENV': '"production"' }, legalComments: 'none', logLevel: 'info',
};
const css = { entryPoints: [join(here, 'src', 'styles.css')], bundle: true, minify: true, outfile: join(out, 'app.css'), logLevel: 'info' };

copyFileSync(join(here, 'public', 'index.html'), join(out, 'index.html'));
copyFileSync(join(here, 'public', 'favicon.svg'), join(out, 'favicon.svg'));
cpSync(join(here, 'public', 'assets'), join(out, 'assets'), { recursive: true });   // website stylesheet + pictures
const apiUrl = (process.env.API_URL || '').trim();
const staffPath = (process.env.STAFF_PATH || '').trim().replace(/^[#/]+|\/+$/g, '');
if (apiUrl && !/^https?:\/\/[^\s"'<>]+$/.test(apiUrl)) { console.error('API_URL must look like https://your-api.onrender.com/api'); process.exit(1); }
if (staffPath && !/^[A-Za-z0-9][A-Za-z0-9_-]{7,60}$/.test(staffPath)) { console.error('STAFF_PATH must be one secret word of 8-60 letters, numbers, - or _'); process.exit(1); }
if (apiUrl || staffPath) {
  // start from public/config.js, then apply the build settings on top
  const cfg = { apiUrl: 'http://localhost:8000/api', staffPath: '' };
  const m = readFileSync(join(here, 'public', 'config.js'), 'utf8').match(/HOTELGO_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
  if (m) { try { Object.assign(cfg, Function('return ' + m[1])()); } catch { /* keep defaults */ } }
  if (apiUrl) cfg.apiUrl = apiUrl;
  if (staffPath) cfg.staffPath = staffPath;
  writeFileSync(join(out, 'config.js'), `window.HOTELGO_CONFIG = ${JSON.stringify(cfg)};\n`);
  console.log('API address:', cfg.apiUrl, '| staff door:', cfg.staffPath ? '#/' + cfg.staffPath : '(not set)');
} else {
  copyFileSync(join(here, 'public', 'config.js'), join(out, 'config.js'));
  console.log('Settings: from public/config.js (set API_URL / STAFF_PATH to override)');
}

if (process.argv.includes('--serve') || process.argv.includes('--watch')) {
  const a = await esbuild.context(js); const b = await esbuild.context(css);
  await a.watch(); await b.watch();
  if (process.argv.includes('--serve')) {
    const { port } = await a.serve({ servedir: out, port: 5173, host: '127.0.0.1', fallback: join(out, 'index.html') });
    console.log(`Open http://localhost:${port}`);
  }
} else {
  await esbuild.build(js); await esbuild.build(css);
}
