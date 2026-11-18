// Komponent-bibliotek på Cloudflare Workers.
// Statiske filer (public/) serveres direkte af Cloudflare; /api/* og /mcp sendes til ét
// Durable Object, som holder databasen i hukommelsen og gemmer den i sin egen SQLite.
import { DurableObject } from 'cloudflare:workers';
import { createLibrary } from '../core.js';
import seed from '../seed.json';
import shelves from './shelves.json'; // genereres af scripts/build-shelves.mjs ved build

const CHUNK = 400_000; // tegn pr. række (SQLite-rækker må højst fylde 2 MB)

export class Library extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS db_chunks (i INTEGER PRIMARY KEY, v TEXT NOT NULL)');
    const rows = this.sql.exec('SELECT v FROM db_chunks ORDER BY i').toArray();
    const fresh = !rows.length;
    const db = fresh ? structuredClone(seed) : JSON.parse(rows.map(r => r.v).join(''));
    this.lib = createLibrary({ db, seed, save: d => this.save(d), listShelves: () => shelves });
    if (fresh) this.save(db);
    if (this.lib.migrate()) console.log('Database migreret til layout v' + seed.layoutVersion);
  }

  save(db) {
    const s = JSON.stringify(db);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM db_chunks');
      for (let i = 0, n = 0; i < s.length; i += CHUNK, n++) this.sql.exec('INSERT INTO db_chunks (i, v) VALUES (?, ?)', n, s.slice(i, i + CHUNK));
    });
  }

  async fetch(request) {
    const url = new URL(request.url);
    const token = this.env.API_TOKEN;
    // Modsat Docker-versionen: uden API_TOKEN er alt, der skriver, låst (siden er offentlig på nettet).
    const authorized = !!token && request.headers.get('Authorization') === 'Bearer ' + token;
    const out = await this.lib.handle({
      method: request.method, path: url.pathname, params: Object.fromEntries(url.searchParams), authorized,
      readBody: async () => { const t = await request.text(); return t ? JSON.parse(t) : {}; },
    });
    if (!out) return new Response('Not found', { status: 404 });
    if (out.body === undefined) return new Response(null, { status: out.status, headers: out.headers });
    return Response.json(out.body, { status: out.status, headers: { 'Cache-Control': 'no-store', ...out.headers } });
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === '/mcp' || pathname.startsWith('/api/')) {
      return env.LIBRARY.get(env.LIBRARY.idFromName('main')).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
