import fs from 'node:fs/promises';
import path from 'node:path';
import * as XLSX from 'xlsx';

let refreshing = false;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'player';

const downloadPhoto = async (id: string) => {
  const url =
    'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(id);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(20000) });
      const type = response.headers.get('content-type') || '';
      if (response.ok && type.startsWith('image/'))
        return {
          bytes: Buffer.from(await response.arrayBuffer()),
          extension: type.includes('webp')
            ? 'webp'
            : type.includes('png')
              ? 'png'
              : 'jpg',
        };
    } catch {}
    await wait(500 * (attempt + 1));
  }
  return null;
};

export async function POST(request: Request) {
  const configuredPassword = process.env.ADMIN_PASSWORD;
  const suppliedPassword = request.headers.get('x-admin-password');
  if (!configuredPassword)
    return Response.json(
      { error: 'Set ADMIN_PASSWORD on the server before refreshing players.' },
      { status: 503 },
    );
  if (suppliedPassword !== configuredPassword)
    return Response.json(
      { error: 'Incorrect server admin password.' },
      { status: 401 },
    );

  if (refreshing)
    return Response.json({ error: 'A database download is already running.' }, { status: 409 });
  refreshing = true;
  let stagedDirectory = '';
  try {
    const body = (await request.json()) as { url?: string };
    const source = new URL(body.url || '');
    if (
      source.protocol !== 'https:' ||
      source.hostname !== 'docs.google.com' ||
      !source.pathname.startsWith('/spreadsheets/d/e/')
    )
      return Response.json(
        { error: 'Use a published Google Sheets XLS/XLSX link.' },
        { status: 400 },
      );
    source.searchParams.set('cache', Date.now().toString());
    const clientRoot =
      process.env.NODE_ENV === 'production'
        ? path.resolve('dist/client')
        : path.resolve('public');
    const liveDirectory = path.resolve(clientRoot, 'players');
    if (path.dirname(liveDirectory) !== clientRoot)
      throw new Error('Unsafe player photo path.');
    // Explicit authenticated refresh discards old photos before any download.
    await fs.rm(liveDirectory, { recursive: true, force: true });
    const databasePath = path.resolve('data', 'downloaded-player-database.json');
    await fs.mkdir(path.dirname(databasePath), { recursive: true });
    await fs.rm(databasePath, { force: true });
    const response = await fetch(source, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
    if (!response.ok)
      throw new Error('Spreadsheet returned ' + response.status);
    const workbook = XLSX.read(await response.arrayBuffer(), { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
    const registrations = rows
      .map((row) => {
        const find = (word: string) =>
          Object.entries(row).find(([heading]) =>
            heading.toLowerCase().includes(word),
          )?.[1];
        return {
          name: String(find('name') || '').trim(),
          age: Number(find('age') || 0),
          photo: String(find('photo') || '').trim(),
        };
      })
      .filter((player) => player.name);
    if (!registrations.length) throw new Error('No players were found.');

    stagedDirectory = path.resolve(clientRoot, 'players-refresh-' + Date.now());
    if (
      path.dirname(liveDirectory) !== clientRoot ||
      path.dirname(stagedDirectory) !== clientRoot
    )
      throw new Error('Unsafe player photo path.');
    await fs.mkdir(stagedDirectory, { recursive: true });

    const players = new Array<{ name: string; age: number; image: string }>(
      registrations.length,
    );
    const used = new Set<string>();
    let cursor = 0;
    let downloaded = 0;
    let placeholders = 0;
    const worker = async () => {
      while (cursor < registrations.length) {
        const index = cursor++;
        const player = registrations[index];
        let slug = slugify(player.name);
        const base = slug;
        let suffix = 2;
        while (used.has(slug)) slug = base + '-' + suffix++;
        used.add(slug);
        let image = '/player-placeholder.svg';
        try {
          const photoUrl = new URL(player.photo);
          const id = photoUrl.searchParams.get('id') || photoUrl.pathname.match(/\/d\/([^/]+)/)?.[1];
          const photo = id ? await downloadPhoto(id) : null;
          if (photo) {
            const file = slug + '.' + photo.extension;
            await fs.writeFile(path.join(stagedDirectory, file), photo.bytes);
            image = '/players/' + file + '?v=' + Date.now();
            downloaded += 1;
          } else placeholders += 1;
        } catch {
          placeholders += 1;
        }
        players[index] = { name: player.name, age: player.age, image };
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(10, registrations.length) }, () =>
        worker(),
      ),
    );

    await fs.rename(stagedDirectory, liveDirectory);
    await fs.writeFile(databasePath, JSON.stringify({
      players, downloaded, placeholders, downloadedAt: new Date().toISOString(),
    }));
    return Response.json({ players, downloaded, placeholders });
  } catch (error) {
    if (stagedDirectory)
      await fs
        .rm(stagedDirectory, { recursive: true, force: true })
        .catch(() => {});
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : 'Database refresh failed.',
      },
      { status: 500 },
    );
  } finally {
    refreshing = false;
  }
}
