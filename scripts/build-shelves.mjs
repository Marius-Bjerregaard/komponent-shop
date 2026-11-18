// Workers kan ikke liste filer, så listen over reolbilleder laves ved build: public/reoler -> src/shelves.json
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { shelvesFromFiles } from '../core.js';

const dir = fileURLToPath(new URL('../public/reoler/', import.meta.url));
const out = fileURLToPath(new URL('../src/shelves.json', import.meta.url));
const shelves = fs.existsSync(dir) ? shelvesFromFiles(fs.readdirSync(dir)) : [];
fs.writeFileSync(out, JSON.stringify(shelves, null, 1) + '\n');
console.log(`src/shelves.json: ${shelves.length} reolbilleder`);
