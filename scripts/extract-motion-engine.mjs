#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillPath = path.join(root, '.claude', 'skills', 'motion-engine', 'SKILL.md');
const target = path.join(os.homedir(), '.cache', 'motion-director', 'tool');
const source = await readFile(skillPath, 'utf8');
const manifestMatch = source.match(/<!-- manifest: (\{.*?\}) -->/);
if (!manifestMatch) {
  console.error('ОШИБКА: манифест движка не найден');
  process.exit(1);
}
const manifest = JSON.parse(manifestMatch[1]);
const files = [...source.matchAll(/<!-- file: (\S+) -->\n````\w*\n([\s\S]*?)\n````/g)];
if (manifest.v !== 3 || files.length !== 7) {
  console.error(`ОШИБКА: ожидались 7 файлов, движок v3; найдено ${files.length}, v${manifest.v ?? '?'}`);
  process.exit(1);
}
await mkdir(target, { recursive: true });
let bad = false;
for (const match of files) {
  const [, name, body] = match;
  const digest = createHash('sha1').update(body.replace(/\s+/g, '')).digest('hex').slice(0, 12);
  const intact = digest === manifest[name];
  console.log(`${name}: ${intact ? 'цел' : 'ОТЛИЧАЕТСЯ'}`);
  if (!intact) { bad = true; continue; }
  await writeFile(path.join(target, name), body + '\n');
}
console.log(`${files.length} файлов, движок v${manifest.v}`);
if (bad) {
  console.error('ОШИБКА: контрольные суммы движка не совпали; самотест не запускать');
  process.exit(1);
}
