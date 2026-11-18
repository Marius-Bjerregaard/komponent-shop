// Flyt databasen fra hjemmeserveren (eller en db.json-fil) til Cloudflare-versionen.
//
//   API_TOKEN=<token på Cloudflare> node scripts/flyt-data.mjs <fra> <til>
//
// <fra>: URL til den gamle server (fx https://komponenter.ditdomæne.dk) eller sti til en db.json
// <til>: URL til den nye worker (fx https://komponent-shop.<konto>.workers.dev)
// Den nye database overskrives helt. Den gamle røres ikke.
import fs from 'node:fs';

const [from, to] = process.argv.slice(2);
const token = process.env.API_TOKEN;
if (!from || !to || !token) {
  console.error('Brug: API_TOKEN=<token> node scripts/flyt-data.mjs <gammel-url eller db.json> <ny-url>');
  process.exit(1);
}
const base = u => u.replace(/\/+$/, '');
async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

let data;
if (fs.existsSync(from)) {
  data = JSON.parse(fs.readFileSync(from, 'utf8'));
  console.log(`Læst ${from}`);
} else {
  const b = base(from);
  const [series, cabinets, components] = await Promise.all([
    getJson(b + '/api/series'), getJson(b + '/api/cabinets'), getJson(b + '/api/components?limit=1000000'),
  ]);
  data = { series, cabinets, components };
  console.log(`Hentet fra ${b}`);
}
console.log(`  ${data.series.length} serier, ${data.cabinets.length} reoler, ${data.components.length} komponenter`);

const r = await fetch(base(to) + '/api/import', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(data),
});
const out = await r.json().catch(() => ({}));
if (!r.ok) { console.error(`Fejl fra ${base(to)}: HTTP ${r.status}`, out.error || ''); process.exit(1); }
console.log(`Importeret til ${base(to)}:`, out);
