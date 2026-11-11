// Komponent-bibliotek: web-UI + REST API + MCP-server (ingen afhængigheder)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TOKEN = process.env.API_TOKEN || '';
const PUBLIC = path.join(__dirname, 'public');

// ---------- data ----------
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.copyFileSync(path.join(__dirname, 'seed.json'), DB_FILE);
let db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
function save() {
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 1));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
const norm = s => String(s ?? '').toLowerCase().replace(/[\s\-_.]/g, '');

function search({ q = '', series = '', function: fn = '', limit = 500 } = {}) {
  const terms = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return db.components.filter(c => {
    if (series && c.series !== series) return false;
    if (fn && c.function !== fn) return false;
    const hay = [c.part, c.description, c.function, c.notes, c.location, seriesName(c.series)].join(' ').toLowerCase();
    const hayN = norm(hay);
    return terms.every(t => hay.includes(t) || hayN.includes(norm(t)));
  }).slice(0, limit);
}
const seriesName = id => (db.series.find(s => s.id === id) || {}).name || id;

function addComponent(c) {
  if (!c.part) throw new Error('part er påkrævet');
  if (!db.series.find(s => s.id === c.series)) throw new Error(`Ukendt serie "${c.series}". Brug list_series eller add_series.`);
  const id = Math.max(0, ...db.components.map(x => x.id)) + 1;
  const comp = { id, part: c.part, series: c.series, function: c.function || 'Andet', description: c.description || '',
    location: c.location || '', quantity: c.quantity ?? null, notes: c.notes || '' };
  db.components.push(comp); save(); return comp;
}
function updateComponent(id, patch) {
  const c = db.components.find(x => x.id === Number(id));
  if (!c) throw new Error('Komponent ikke fundet: ' + id);
  if (patch.series && !db.series.find(s => s.id === patch.series)) throw new Error('Ukendt serie');
  for (const k of ['part', 'series', 'function', 'description', 'location', 'quantity', 'notes']) if (k in patch) c[k] = patch[k];
  save(); return c;
}
function deleteComponent(id) {
  const i = db.components.findIndex(x => x.id === Number(id));
  if (i < 0) throw new Error('Komponent ikke fundet: ' + id);
  const [c] = db.components.splice(i, 1); save(); return c;
}
function addSeries({ id, name, color = '#888888' }) {
  if (!id || !name) throw new Error('id og name er påkrævet');
  if (db.series.find(s => s.id === id)) throw new Error('Serie findes allerede');
  const s = { id, name, color }; db.series.push(s); save(); return s;
}
function listSeries() {
  return db.series.map(s => {
    const comps = db.components.filter(c => c.series === s.id);
    return { ...s, count: comps.length, functions: [...new Set(comps.map(c => c.function))].sort() };
  });
}
function listShelves() {
  const dir = path.join(PUBLIC, 'reoler');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .sort((a, b) => a.localeCompare(b, 'da', { numeric: true }))
    .map(f => { const m = f.match(/^(\d+)\s*-\s*(.*)\.\w+$/); return { file: 'reoler/' + encodeURIComponent(f), number: m ? Number(m[1]) : null, title: m ? m[2] : f.replace(/\.\w+$/, '') }; });
}

// ---------- MCP (Streamable HTTP, JSON-RPC) ----------
const str = { type: 'string' };
const TOOLS = [
  { name: 'search_components', description: 'Søg i komponentbiblioteket (fritekst på partnummer, beskrivelse, funktion). Kan filtreres på serie-id og funktion.',
    inputSchema: { type: 'object', properties: { q: str, series: str, function: str, limit: { type: 'number' } } }, run: a => search(a) },
  { name: 'list_series', description: 'List alle serier med antal komponenter og funktioner (underkategorier).',
    inputSchema: { type: 'object', properties: {} }, run: () => listSeries() },
  { name: 'add_component', description: 'Tilføj en komponent. series skal være et eksisterende serie-id. function er underkategorien (fx "Logiske gates", "Tællere", "BJT NPN").',
    inputSchema: { type: 'object', required: ['part', 'series'], properties: { part: str, series: str, function: str, description: str, location: str, quantity: { type: 'number' }, notes: str } },
    run: a => addComponent(a) },
  { name: 'add_components', description: 'Tilføj mange komponenter på én gang.',
    inputSchema: { type: 'object', required: ['components'], properties: { components: { type: 'array', items: { type: 'object' } } } },
    run: a => a.components.map(addComponent) },
  { name: 'update_component', description: 'Opdater felter på en komponent (via id).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' }, part: str, series: str, function: str, description: str, location: str, quantity: { type: 'number' }, notes: str } },
    run: ({ id, ...p }) => updateComponent(id, p) },
  { name: 'delete_component', description: 'Slet en komponent (via id).',
    inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'number' } } }, run: a => deleteComponent(a.id) },
  { name: 'add_series', description: 'Opret en ny serie (fx "Kondensatorer"). id er en kort slug.',
    inputSchema: { type: 'object', required: ['id', 'name'], properties: { id: str, name: str, color: str } }, run: a => addSeries(a) },
  { name: 'list_shelves', description: 'List reolbillederne i rækkefølge (nummer fra filnavnet).',
    inputSchema: { type: 'object', properties: {} }, run: () => listShelves() },
];
function mcp(msg) {
  const { id, method, params = {} } = msg;
  const ok = result => ({ jsonrpc: '2.0', id, result });
  if (method === 'initialize') return ok({ protocolVersion: params.protocolVersion || '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'komponent-bibliotek', version: '1.0.0' } });
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: TOOLS.map(({ run, ...t }) => t) });
  if (method === 'tools/call') {
    const t = TOOLS.find(x => x.name === params.name);
    if (!t) return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Ukendt værktøj' } };
    try { return ok({ content: [{ type: 'text', text: JSON.stringify(t.run(params.arguments || {}), null, 1) }] }); }
    catch (e) { return ok({ content: [{ type: 'text', text: 'Fejl: ' + e.message }], isError: true }); }
  }
  if (id === undefined) return null; // notifications
  return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const authed = req => !TOKEN || req.headers.authorization === 'Bearer ' + TOKEN;
const body = req => new Promise((ok, bad) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } }); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    if (p === '/mcp') {
      if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
      if (req.method !== 'POST') { res.writeHead(405, { Allow: 'POST' }); return res.end(); }
      const msg = await body(req);
      const out = Array.isArray(msg) ? msg.map(mcp).filter(Boolean) : mcp(msg);
      if (!out || (Array.isArray(out) && !out.length)) { res.writeHead(202); return res.end(); }
      return send(res, 200, out);
    }
    if (p === '/api/series' && req.method === 'GET') return send(res, 200, listSeries());
    if (p === '/api/shelves') return send(res, 200, listShelves());
    if (p === '/api/components' && req.method === 'GET') return send(res, 200, search(Object.fromEntries(url.searchParams)));
    if (p.startsWith('/api/')) {
      if (!authed(req)) return send(res, 401, { error: 'unauthorized' });
      const m = p.match(/^\/api\/components\/(\d+)$/);
      if (p === '/api/components' && req.method === 'POST') return send(res, 201, addComponent(await body(req)));
      if (m && req.method === 'PATCH') return send(res, 200, updateComponent(m[1], await body(req)));
      if (m && req.method === 'DELETE') return send(res, 200, deleteComponent(m[1]));
      if (p === '/api/series' && req.method === 'POST') return send(res, 201, addSeries(await body(req)));
      return send(res, 404, { error: 'not found' });
    }
    // static
    let f = path.normalize(path.join(PUBLIC, decodeURIComponent(p === '/' ? '/index.html' : p)));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) { send(res, 400, { error: e.message }); }
}).listen(PORT, () => console.log('Komponent-bibliotek på port ' + PORT));
