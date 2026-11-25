// Henter index.json fra komponent-datablade (GitHub Pages) og skriver datablade.json med fulde links.
// Kør efter du har tilføjet datablade i det repo: npm run opdater-datablade
import fs from 'node:fs';
const BASE = 'https://marius-bjerregaard.github.io/komponent-datablade/';
const r = await fetch(BASE + 'index.json');
if (!r.ok) throw new Error('Kunne ikke hente index.json: HTTP ' + r.status);
const index = await r.json();
const out = { _info: 'Genereres af scripts/opdater-datablade.mjs fra ' + BASE + 'index.json. Ret i repoet komponent-datablade, ikke her.' };
for (const [part, files] of Object.entries(index)) out[part] = files.map(f => ({ title: f.title, url: BASE + f.url }));
fs.writeFileSync(new URL('../datablade.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log(`datablade.json: ${Object.keys(out).length - 1} partnumre`);
