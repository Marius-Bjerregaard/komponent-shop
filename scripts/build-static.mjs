// Bygger den statiske GitHub Pages-udgave i dist/: public/ + api/*-filer lavet ud fra komponenter.json.
// Siden henter api/series, api/components osv. præcis som fra serveren, så index.html er uændret.
// Stopper med fejl, hvis komponenter.json ikke hænger sammen (bruges også som tjek på pull requests).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibrary, shelvesFromFiles } from '../core.js';
import { readData, validate } from './data.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const db = readData();

const errors = validate(db);
if (errors.length) {
  console.error('komponenter.json har fejl:\n- ' + errors.join('\n- '));
  process.exit(1);
}

const reoler = path.join(root, 'public', 'reoler');
const lib = createLibrary({
  db,
  seed: { layoutVersion: db.layoutVersion }, // ingen migrering i den statiske udgave
  save: () => { throw new Error('Den statiske side kan ikke gemme'); },
  listShelves: () => (fs.existsSync(reoler) ? shelvesFromFiles(fs.readdirSync(reoler)) : []),
  datasheets: JSON.parse(fs.readFileSync(path.join(root, 'datablade.json'), 'utf8')),
});

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(path.join(root, 'public'), dist, { recursive: true, filter: f => !/\.DS_Store$|\.assetsignore$/.test(f) });
fs.mkdirSync(path.join(dist, 'api'));
const endpoints = { series: '/api/series', cabinets: '/api/cabinets', shelves: '/api/shelves', components: '/api/components' };
for (const [file, p] of Object.entries(endpoints)) {
  const out = await lib.handle({ method: 'GET', path: p, params: { limit: 1e9 }, authorized: false, readBody: async () => ({}) });
  fs.writeFileSync(path.join(dist, 'api', file), JSON.stringify(out.body));
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log(`dist/: ${db.components.length} komponenter, ${db.cabinets.length} reoler, ${db.series.length} serier`);
