// Fælles hjælpere til komponenter.json (dataene for GitHub Pages-siden).
// Formatet har én komponent/reol/serie pr. linje, så ændringer giver små, læsbare diffs i pull requests.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DATA_FILE = fileURLToPath(new URL('../komponenter.json', import.meta.url));

export function formatData(db) {
  const list = arr => '[\n' + arr.map(x => '  ' + JSON.stringify(x)).join(',\n') + '\n ]';
  return '{\n' +
    ` "layoutVersion": ${JSON.stringify(db.layoutVersion ?? 0)},\n` +
    ` "series": ${list(db.series)},\n` +
    ` "cabinets": ${list(db.cabinets)},\n` +
    ` "components": ${list([...db.components].sort((a, b) => a.id - b.id))}\n` +
    '}\n';
}

export const readData = () => JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
export const writeData = db => fs.writeFileSync(DATA_FILE, formatData(db));

// Tjekker at dataene hænger sammen. Returnerer en liste af fejl (tom = alt ok).
export function validate(db) {
  const errors = [];
  const series = new Set(db.series.map(s => s.id));
  const cabs = new Map(db.cabinets.map(k => [k.id, k]));
  if (series.size !== db.series.length) errors.push('To serier har samme id');
  if (cabs.size !== db.cabinets.length) errors.push('To reoler har samme id');
  const ids = new Set(), slots = new Map();
  for (const c of db.components) {
    const name = `${c.part} (id ${c.id})`;
    if (!Number.isInteger(c.id)) errors.push(`${name}: id skal være et heltal`);
    else if (ids.has(c.id)) errors.push(`${name}: id bruges af flere komponenter`);
    ids.add(c.id);
    if (!c.part) errors.push(`id ${c.id}: mangler part`);
    if (!series.has(c.series)) errors.push(`${name}: ukendt serie "${c.series}"`);
    if (c.datasheet && !/^https?:\/\//i.test(c.datasheet)) errors.push(`${name}: datasheet skal være et http(s)-link`);
    if (c.cabinet == null) continue;
    const k = cabs.get(c.cabinet);
    if (!k) { errors.push(`${name}: ukendt reol "${c.cabinet}"`); continue; }
    if (!(c.row >= 1 && c.row <= k.rows && c.col >= 1 && c.col <= k.cols)) errors.push(`${name}: række ${c.row}, skuffe ${c.col} findes ikke i ${k.id} (${k.rows}×${k.cols})`);
    const key = `${c.cabinet}|${c.row}|${c.col}`;
    if (slots.has(key)) errors.push(`${name}: skuffen er allerede optaget af ${slots.get(key)}`);
    slots.set(key, name);
  }
  return errors;
}
