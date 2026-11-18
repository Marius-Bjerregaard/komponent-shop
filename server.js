// Komponent-bibliotek til Node/Docker: web-UI + REST API + MCP-server (ingen afhængigheder).
// Selve logikken ligger i core.js og deles med Cloudflare-versionen (src/worker.js).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibrary, shelvesFromFiles } from './core.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const TOKEN = process.env.API_TOKEN || '';
const PUBLIC = path.join(__dirname, 'public');

// ---------- data ----------
const seed = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed.json'), 'utf8'));
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.copyFileSync(path.join(__dirname, 'seed.json'), DB_FILE);
function save(db) {
  fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 1));
  fs.renameSync(DB_FILE + '.tmp', DB_FILE);
}
function listShelves() {
  const dir = path.join(PUBLIC, 'reoler');
  return fs.existsSync(dir) ? shelvesFromFiles(fs.readdirSync(dir)) : [];
}
const lib = createLibrary({
  db: JSON.parse(fs.readFileSync(DB_FILE, 'utf8')),
  save, seed, listShelves,
  backup: (_db, version) => fs.copyFileSync(DB_FILE, DB_FILE + '.before-v' + version),
});
if (lib.migrate()) console.log('Database migreret til layout v' + seed.layoutVersion);

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
const readBody = req => () => new Promise((ok, bad) => {
  let b = ''; req.on('data', d => b += d);
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch (e) { bad(e); } });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  try {
    const out = await lib.handle({
      method: req.method, path: p, params: Object.fromEntries(url.searchParams),
      authorized: !TOKEN || req.headers.authorization === 'Bearer ' + TOKEN,
      readBody: readBody(req),
    });
    if (out) {
      if (out.body === undefined) { res.writeHead(out.status, out.headers); return res.end(); }
      res.writeHead(out.status, { 'Content-Type': 'application/json; charset=utf-8', ...out.headers });
      return res.end(JSON.stringify(out.body));
    }
    // static
    let f = path.normalize(path.join(PUBLIC, decodeURIComponent(p === '/' ? '/index.html' : p)));
    if (!f.startsWith(PUBLIC) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(PUBLIC, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
    fs.createReadStream(f).pipe(res);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
}).listen(PORT, () => console.log('Komponent-bibliotek på port ' + PORT));
