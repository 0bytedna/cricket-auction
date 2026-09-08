import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';

const databaseUrl =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTJSkmTO0aDVXFo1oY7TlqOo7GkfAlrrlxl7mBgMhDKAe5rSPnQVHDDD5gxQ6ptpv7S1L5JMT_-kZyR/pub?output=xlsx';
const outputDirectory = path.resolve('public/players');
const manifestPath = path.resolve('player-import.json');
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const slugify = (name) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'player';
const playerSets = ['A+', 'A', 'B', 'C'];
const parsePlayerSet = (value) => {
  const normalized = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  return playerSets.includes(normalized) ? normalized : 'C';
};

const downloadPhoto = async (id) => {
  const url =
    'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && contentType.startsWith('image/'))
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          extension: contentType.includes('webp')
            ? 'webp'
            : contentType.includes('png')
              ? 'png'
              : 'jpg',
        };
      lastError = new Error('Drive returned ' + response.status);
    } catch (error) {
      lastError = error;
    }
    await wait(700 * (attempt + 1));
  }
  throw lastError || new Error('Photo download failed');
};

const spreadsheet = await fetch(databaseUrl + '&cache=' + Date.now());
if (!spreadsheet.ok)
  throw new Error('Player spreadsheet download failed: ' + spreadsheet.status);

const workbook = XLSX.read(await spreadsheet.arrayBuffer(), { type: 'array' });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet);
const usedNames = new Set();
const registrations = rows
  .map((row) => {
    const find = (word) =>
      Object.entries(row).find(([heading]) =>
        heading.toLowerCase().includes(word),
      )?.[1];
    return {
      name: String(find('name') || '').trim(),
      age: Number(find('age') || 0),
      photo: String(find('photo') || '').trim(),
      set: parsePlayerSet(find('set')),
    };
  })
  .filter((player) => player.name);

await fs.mkdir(outputDirectory, { recursive: true });
const manifest = new Array(registrations.length);
let nextIndex = 0;
let downloaded = 0;
let placeholders = 0;

const worker = async () => {
  while (nextIndex < registrations.length) {
    const index = nextIndex++;
    const player = registrations[index];
    let slug = slugify(player.name);
    const baseSlug = slug;
    let suffix = 2;
    while (usedNames.has(slug)) slug = baseSlug + '-' + suffix++;
    usedNames.add(slug);
    let file = '../player-placeholder.svg';
    try {
      const id = new URL(player.photo).searchParams.get('id');
      if (!id) throw new Error('Missing Drive ID');
      const photo = await downloadPhoto(id);
      file = slug + '.' + photo.extension;
      await fs.writeFile(path.join(outputDirectory, file), photo.bytes);
      downloaded += 1;
    } catch {
      placeholders += 1;
    }
    manifest[index] = {
      name: player.name,
      age: player.age,
      set: player.set,
      file,
    };
    process.stdout.write(
      '\rPlayers prepared: ' +
        (downloaded + placeholders) +
        '/' +
        registrations.length,
    );
  }
};

await Promise.all(
  Array.from({ length: Math.min(4, registrations.length) }, () => worker()),
);
await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  '\nPlayer database ready: ' +
    downloaded +
    ' photos, ' +
    placeholders +
    ' placeholders.',
);
