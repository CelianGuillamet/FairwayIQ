import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), 'listing.fr.md');
const source = readFileSync(file, 'utf8');
const lines = source.split('\n');

const HEADING = /^#{2,3}\s+(.*?)\s*\((\d+) max\)\s*$/;
const START = '<!-- limites:debut -->';
const END = '<!-- limites:fin -->';

const rows = [];
const problems = [];

for (let index = 0; index < lines.length; index++) {
  const match = HEADING.exec(lines[index]);
  if (!match) continue;

  const [, label, max] = match;
  const open = lines.findIndex((line, offset) => offset > index && line.startsWith('```'));
  const close = lines.findIndex((line, offset) => offset > open && line.startsWith('```'));

  if (open === -1 || close === -1) {
    problems.push(`${label} : bloc de texte introuvable`);
    continue;
  }

  const text = lines.slice(open + 1, close).join('\n');
  const length = [...text].length;
  rows.push({ label, max: Number(max), length });

  if (length > Number(max)) problems.push(`${label} : ${length} caractères pour ${max} maximum`);
  if (/^Mots-clés/.test(label) && /,\s|\s,/.test(text)) problems.push(`${label} : espace autour d’une virgule`);
  if (/^Mots-clés/.test(label) && text.includes('\n')) problems.push(`${label} : retour à la ligne`);
}

const table = [
  '| Champ | Limite | Caractères | Marge | Statut |',
  '|---|---:|---:|---:|---|',
  ...rows.map(({ label, max, length }) => `| ${label} | ${max} | ${length} | ${max - length} | ${length <= max ? 'OK' : 'DÉPASSE'} |`),
].join('\n');

if (process.argv.includes('--write')) {
  const from = source.indexOf(START);
  const to = source.indexOf(END);

  if (from === -1 || to === -1 || to < from) {
    problems.push('repères de tableau absents dans listing.fr.md');
  } else {
    writeFileSync(file, `${source.slice(0, from + START.length)}\n${table}\n${source.slice(to)}`);
  }
} else {
  console.log(table);
}

if (problems.length > 0) {
  console.error(problems.map((problem) => `ERREUR ${problem}`).join('\n'));
  process.exit(1);
}
