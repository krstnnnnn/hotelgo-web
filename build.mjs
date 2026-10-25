// Bundles src/ into dist/ (index.html, app.js, app.css, config.js, favicon.svg).
//   npm run build   -> one build (this is what Render runs)
//   npm run dev     -> build, watch for changes and serve on http://localhost:5173
// The address of the API comes from the API_URL environment variable (see .env.example),
// or from public/config.js when API_URL is not set.
import * as esbuild from 'esbuild';
import { mkdirSync, writeFileSync, copyFileSync, readFileSync, existsSync } from 'node:fs';
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
const apiUrl = (process.env.API_URL || '').trim();
if (apiUrl) {
  if (!/^https?:\/\/[^\s"'<>]+$/.test(apiUrl)) { console.error('API_URL must look like https://your-api.onrender.com/api'); process.exit(1); }
  writeFileSync(join(out, 'config.js'), `window.HOTELGO_CONFIG = { apiUrl: ${JSON.stringify(apiUrl)} };\n`);
  console.log('API address:', apiUrl);
} else {
  copyFileSync(join(here, 'public', 'config.js'), join(out, 'config.js'));
  console.log('API address: from public/config.js (set API_URL to override)');
}

if (process.argv.includes('--serve') || process.argv.includes('--watch')) {
  const a = await esbuild.context(js); const b = await esbuild.context(css);
  await a.watch(); await b.watch();
  if (process.argv.includes('--serve')) {
    const { port } = await a.serve({ servedir: out, port: 5173, host: '127.0.0.1' });
    console.log(`Open http://localhost:${port}`);
  }
} else {
  await esbuild.build(js); await esbuild.build(css);
}
